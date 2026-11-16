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
