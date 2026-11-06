import { create } from 'zustand'
import { AUTH_ACCOUNT, AUTH_KEY } from '../config/auth'

// ---------- Đăng nhập (chỉ hình thức) ----------
const readAuth = () => {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null')?.loggedIn === true
  } catch {
    return false
  }
}

type AuthState = { loggedIn: boolean; login: (u: string, p: string) => boolean; logout: () => void }

export const useAuth = create<AuthState>((set) => ({
  loggedIn: readAuth(),
  login: (u, p) => {
    if (u.trim() !== AUTH_ACCOUNT.username || p !== AUTH_ACCOUNT.password) return false
    localStorage.setItem(AUTH_KEY, JSON.stringify({ loggedIn: true, at: new Date().toISOString() }))
    set({ loggedIn: true })
    return true
  },
  logout: () => {
    localStorage.removeItem(AUTH_KEY) // chỉ xóa auth, không xóa dữ liệu
    set({ loggedIn: false })
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
