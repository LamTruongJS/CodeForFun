import type { AppData } from './types'

/** Gọi API dữ liệu dùng chung (/api/data). Token = Basic base64(user:pass), lưu lúc đăng nhập. */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export type Remote = { data: unknown; version: string | null }

export const makeToken = (u: string, p: string) => 'Basic ' + btoa(String.fromCharCode(...new TextEncoder().encode(`${u.trim()}:${p}`)))

async function call(token: string, init: RequestInit & { query?: string } = {}) {
  let r: Response
  try {
    r = await fetch('/api/data' + (init.query ?? ''), {
      ...init,
      cache: 'no-store',
      headers: { Authorization: token, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    })
  } catch {
    throw new ApiError('Không kết nối được server — kiểm tra mạng', 0)
  }
  if (r.status === 204) return null
  const body = await r.json().catch(() => ({}))
  if (r.status === 409) return { conflict: true as const, ...(body as Remote) }
  if (!r.ok) throw new ApiError(body?.error ?? `Lỗi server (${r.status})`, r.status)
  return body
}

/** Lấy dữ liệu. Có `since` thì trả null nếu chưa có gì mới. */
export const fetchRemote = (token: string, since?: string | null) =>
  call(token, { query: since ? `?v=${encodeURIComponent(since)}` : '' }) as Promise<Remote | null>

/** Lưu toàn bộ dữ liệu; trả { version } hoặc { conflict, data, version } nếu người khác vừa sửa trước. */
export const saveRemote = (token: string, data: AppData, baseVersion: string | null) =>
  call(token, { method: 'PUT', body: JSON.stringify({ data, baseVersion }) }) as Promise<
    { version: string } | ({ conflict: true } & Remote)
  >

// ---------- Trợ lý Claude ----------
/** 1 lượt hội thoại theo định dạng Messages API (content có thể là các khối text / tool_use / tool_result…) */
export type ChatBlock = { type: string; [k: string]: unknown }
export type ChatTurn = { role: 'user' | 'assistant'; content: string | ChatBlock[] }
export type ChatFinal = { content: ChatBlock[]; stop_reason: string | null }

/**
 * Hỏi trợ lý Claude; gọi onText với từng đoạn chữ khi về tới (hiện dần trên giao diện).
 * Huỷ giữa chừng bằng signal.
 */
export async function streamChat(
  token: string,
  messages: ChatTurn[],
  context: string,
  onText: (t: string) => void,
  signal?: AbortSignal,
): Promise<ChatFinal | null> {
  let r: Response
  try {
    r = await fetch('/api/chat', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context }),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError('Không kết nối được server — kiểm tra mạng', 0)
  }
  if (!r.ok || !r.body) {
    const body = await r.json().catch(() => ({}))
    throw new ApiError(body?.error ?? `Lỗi server (${r.status})`, r.status)
  }
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let final: ChatFinal | null = null
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      const ev = JSON.parse(line) as { type: string; text?: string; error?: string } & Partial<ChatFinal>
      if (ev.type === 'text' && ev.text) onText(ev.text)
      else if (ev.type === 'message') final = { content: ev.content ?? [], stop_reason: ev.stop_reason ?? null }
      else if (ev.type === 'error') throw new ApiError(ev.error ?? 'Lỗi trợ lý', 500)
    }
  }
  return final
}
