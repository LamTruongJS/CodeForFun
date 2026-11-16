import { create } from 'zustand'
import { ApiError, fetchRemote, saveRemote, type Remote } from '../lib/api'
import { parseImport } from '../lib/schema'
import type { AppData } from '../lib/types'
import { LEGACY_DATA_KEY, loadSeed, useAppStore } from './useAppStore'
import { toast, useAuth } from './ui'

/**
 * Đồng bộ dữ liệu với server (/api/data):
 * - Mở web: tải dữ liệu từ server (server trống → đưa dữ liệu cũ trong trình duyệt hoặc seed lên).
 * - Mỗi thay đổi: gom trong SAVE_DELAY rồi lưu lên server.
 * - Mỗi POLL_MS (khi tab đang mở): hỏi server có bản mới không → có thì tải về (người khác vừa sửa).
 * - Người khác lưu trước (409): tải bản mới nhất về, báo cho người dùng.
 */

const SAVE_DELAY = 600
const POLL_MS = 4000
const RETRY_MS = 5000

export type SyncStatus = 'loading' | 'ready' | 'error'
export type SaveState = 'saved' | 'pending' | 'saving' | 'error'

type SyncState = {
  status: SyncStatus
  loadError: string | null
  save: SaveState
  saveError: string | null
  lastSavedAt: string | null
}

export const useSync = create<SyncState>(() => ({
  status: 'loading',
  loadError: null,
  save: 'saved',
  saveError: null,
  lastSavedAt: null,
}))

let version: string | null = null
let applyingRemote = false
let dirty = false
let saving = false
let saveTimer: ReturnType<typeof setTimeout> | undefined
let pollTimer: ReturnType<typeof setInterval> | undefined
let started = false

const token = () => useAuth.getState().token ?? ''

function handleAuthError(e: unknown) {
  if (e instanceof ApiError && e.status === 401) {
    toast('Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại')
    stopSync()
    useAuth.getState().logout()
    return true
  }
  return false
}

function applyRemote(r: Remote) {
  if (r.data == null) {
    // Kho trên server bị xóa trắng → đưa bản đang mở lên lại
    version = null
    dirty = true
    scheduleSave()
    return
  }
  const parsed = parseImport(r.data)
  if (!parsed.ok) throw new Error('Dữ liệu trên server bị lỗi:\n' + parsed.error)
  applyingRemote = true
  useAppStore.setState({ data: parsed.data })
  applyingRemote = false
  version = r.version
  useSync.setState({ lastSavedAt: parsed.data.updatedAt })
}

/** Dữ liệu cũ còn trong localStorage của trình duyệt (bản trước khi có server). */
function legacyLocalData(): AppData | null {
  try {
    const raw = localStorage.getItem(LEGACY_DATA_KEY)
    if (!raw) return null
    const r = parseImport(JSON.parse(raw))
    return r.ok ? r.data : null
  } catch {
    return null
  }
}

export async function loadFromServer() {
  useSync.setState({ status: 'loading', loadError: null })
  try {
    const r = await fetchRemote(token())
    if (r && r.data != null) {
      applyRemote(r)
    } else {
      // Server chưa có dữ liệu → đưa dữ liệu cũ của trình duyệt này (nếu có) hoặc dữ liệu gốc lên
      const initial = legacyLocalData() ?? loadSeed()
      const res = await saveRemote(token(), initial, null)
      if ('conflict' in res) applyRemote(res)
      else {
        applyingRemote = true
        useAppStore.setState({ data: { ...initial, updatedAt: res.version } })
        applyingRemote = false
        version = res.version
        useSync.setState({ lastSavedAt: res.version })
      }
    }
    try {
      localStorage.removeItem(LEGACY_DATA_KEY) // không lưu dữ liệu trong trình duyệt nữa
    } catch {
      /* ignore */
    }
    dirty = false
    useSync.setState({ status: 'ready', save: 'saved', saveError: null })
  } catch (e) {
    if (handleAuthError(e)) return
    useSync.setState({ status: 'error', loadError: e instanceof Error ? e.message : String(e) })
  }
}

function scheduleSave(delay = SAVE_DELAY) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flush, delay)
}

async function flush() {
  if (saving || !dirty) return
  saving = true
  dirty = false
  const data = useAppStore.getState().data
  useSync.setState({ save: 'saving' })
  try {
    const res = await saveRemote(token(), data, version)
    if ('conflict' in res) {
      applyRemote(res)
      dirty = false
      toast('Có người khác vừa sửa trước — đã tải bản mới nhất, thao tác vừa rồi chưa được lưu, vui lòng làm lại')
    } else {
      version = res.version
      // cập nhật updatedAt hiển thị mà không coi là thay đổi mới
      applyingRemote = true
      useAppStore.setState((s) => ({ data: { ...s.data, updatedAt: res.version } }))
      applyingRemote = false
      useSync.setState({ lastSavedAt: res.version })
    }
    useSync.setState({ save: dirty ? 'pending' : 'saved', saveError: null })
  } catch (e) {
    if (handleAuthError(e)) return
    dirty = true // giữ lại để thử lưu lại
    useSync.setState({ save: 'error', saveError: e instanceof Error ? e.message : String(e) })
    scheduleSave(RETRY_MS)
  } finally {
    saving = false
  }
  if (dirty) scheduleSave()
}

async function poll() {
  if (document.visibilityState !== 'visible' || dirty || saving || useSync.getState().status !== 'ready') return
  try {
    const r = await fetchRemote(token(), version ?? '')
    if (r && !dirty && !saving) applyRemote(r)
  } catch (e) {
    handleAuthError(e) // lỗi mạng khi hỏi thì bỏ qua, lần sau hỏi lại
  }
}

const onVisible = () => {
  if (document.visibilityState === 'visible') poll()
  else if (dirty) flush() // rời tab / khóa màn hình điện thoại → lưu ngay
}
const onBeforeUnload = (e: BeforeUnloadEvent) => {
  if (dirty || saving) {
    flush()
    e.preventDefault()
  }
}

let unsubscribe: (() => void) | undefined

/** Bắt đầu đồng bộ (gọi khi đã đăng nhập). */
export function startSync() {
  if (started) return
  started = true
  unsubscribe = useAppStore.subscribe((s, prev) => {
    if (applyingRemote || s.data === prev.data) return
    dirty = true
    useSync.setState({ save: 'pending' })
    scheduleSave()
  })
  pollTimer = setInterval(poll, POLL_MS)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', poll)
  window.addEventListener('beforeunload', onBeforeUnload)
  loadFromServer()
}

export function stopSync() {
  if (!started) return
  started = false
  unsubscribe?.()
  clearInterval(pollTimer)
  clearTimeout(saveTimer)
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('focus', poll)
  window.removeEventListener('beforeunload', onBeforeUnload)
  version = null
  dirty = false
  useSync.setState({ status: 'loading', loadError: null, save: 'saved', saveError: null })
}

/** Lưu ngay (VD trước khi đăng xuất). */
export const flushNow = () => {
  clearTimeout(saveTimer)
  return flush()
}
