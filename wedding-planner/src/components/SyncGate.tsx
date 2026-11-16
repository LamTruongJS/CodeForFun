import { useEffect } from 'react'
import { fmtDateTime } from '../lib/format'
import { loadFromServer, startSync, useSync } from '../store/sync'
import { MODAL_PANEL, Modal } from './Modal'

/** Tải dữ liệu từ server trước khi hiện trang; lỗi thì cho thử lại. */
export function SyncGate({ children }: { children: React.ReactNode }) {
  const { status, loadError } = useSync()
  useEffect(() => startSync(), [])

  if (status === 'ready') return <>{children}</>
  if (status === 'loading')
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32 text-gray-500">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#f0d9e0] border-t-wine" />
        Đang tải dữ liệu…
      </div>
    )
  return (
    <Modal label="Không tải được dữ liệu" z={80}>
      <div className={`${MODAL_PANEL} max-w-md p-6`}>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-[#2b2326]">Không tải được dữ liệu</h2>
        <p className="mt-2 overflow-y-auto text-[14px] whitespace-pre-line text-gray-600">{loadError}</p>
        <button
          className="mt-6 h-12 w-full shrink-0 rounded-2xl bg-gradient-to-b from-[#9b3352] to-[#7d2640] font-semibold text-white shadow-md shadow-wine/25 transition active:scale-[.98]"
          onClick={() => loadFromServer()}
        >
          Thử lại
        </button>
      </div>
    </Modal>
  )
}

/** Chỉ báo trạng thái lưu ở thanh trên cùng. */
export function SaveIndicator() {
  const { status, save, saveError, lastSavedAt } = useSync()
  if (status !== 'ready') return null
  const map = {
    saved: { dot: '#22a35a', text: 'Đã lưu' },
    pending: { dot: '#e0a020', text: 'Đang lưu…' },
    saving: { dot: '#e0a020', text: 'Đang lưu…' },
    error: { dot: '#dc2626', text: 'Chưa lưu được' },
  }[save]
  const title = save === 'error' ? `${saveError} — sẽ tự thử lại` : lastSavedAt ? `Lưu lúc ${fmtDateTime(lastSavedAt)}` : ''
  return (
    <span title={title} className="flex items-center gap-1.5 text-[12px] whitespace-nowrap text-gray-500">
      <span className={`h-2 w-2 rounded-full ${save === 'saving' || save === 'pending' ? 'animate-pulse' : ''}`} style={{ background: map.dot }} />
      {map.text}
    </span>
  )
}
