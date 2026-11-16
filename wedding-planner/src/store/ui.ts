import { create } from 'zustand'
import { AUTH_KEY } from '../config/auth'
import { ApiError, fetchRemote, makeToken } from '../lib/api'

// ---------- Đăng nhập (kiểm tra bằng server) ----------
const readToken = (): string | null => {
  try {
    const t = JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null')?.token
    return typeof t === 'string' ? t : null
  } catch {
    return null
  }
}

type AuthState = {
  token: string | null
  loggedIn: boolean
  /** Trả về thông báo lỗi, hoặc null nếu đăng nhập được */
  login: (u: string, p: string) => Promise<string | null>
  logout: () => void
}

export const useAuth = create<AuthState>((set) => ({
  token: readToken(),
  loggedIn: readToken() != null,
  login: async (u, p) => {
    const token = makeToken(u, p)
    try {
      await fetchRemote(token, '__check__')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return 'Tên đăng nhập hoặc mật khẩu không đúng'
      // Server chưa cấu hình kho dữ liệu vẫn cho đăng nhập để thấy thông báo lỗi rõ ràng
      if (!(e instanceof ApiError && e.status === 503)) return e instanceof Error ? e.message : String(e)
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token, at: new Date().toISOString() }))
    set({ token, loggedIn: true })
    return null
  },
  logout: () => {
    localStorage.removeItem(AUTH_KEY)
    set({ token: null, loggedIn: false })
  },
}))

// ---------- Toast ----------
type Toast = { id: number; text: string; kind: 'error' | 'success' }
type ToastState = { toasts: Toast[]; push: (text: string, kind?: Toast['kind']) => void }

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (text, kind = 'error') => {
    const id = Date.now() + Math.random()
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500)
  },
}))
export const toast = (text: string, kind?: Toast['kind']) => useToast.getState().push(text, kind)

// ---------- Hộp thoại xác nhận ----------
type ConfirmReq = { title: string; message?: string; okText?: string; danger?: boolean; resolve: (v: boolean) => void }
type ConfirmState = { req: ConfirmReq | null }
export const useConfirmStore = create<ConfirmState>(() => ({ req: null }))

export function confirmDialog(opts: Omit<ConfirmReq, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) =>
    useConfirmStore.setState({
      req: {
        ...opts,
        resolve: (v) => {
          useConfirmStore.setState({ req: null })
          resolve(v)
        },
      },
    }),
  )
}
