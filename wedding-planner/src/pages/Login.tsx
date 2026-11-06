import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/ui'

export function LoginPage() {
  const { loggedIn, login } = useAuth()
  const nav = useNavigate()
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  if (loggedIn) return <Navigate to="/" replace />
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,#f8e5ea,#faf6f7_60%)] p-4">
      <form
        className="w-full max-w-sm rounded-[28px] border border-[#f0dfe5] bg-white/90 p-7 shadow-[0_20px_60px_-20px_rgba(142,44,72,.35)] backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault()
          if (login(u, p)) nav('/', { replace: true })
          else setErr('Tên đăng nhập hoặc mật khẩu không đúng')
        }}
      >
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#b4466a] to-[#7d2640] text-white shadow-lg shadow-wine/30"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.5 1.1 4.4 2.4h2c.9-1.3 2.3-2.4 4.4-2.4 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21Z" /></svg></div>
        <h1 className="text-center font-display text-[28px] font-bold text-wine">Kế hoạch đám cưới</h1>
        <p className="mb-6 text-center text-[13px] text-gray-500">Đăng nhập để tiếp tục</p>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-[13px] font-medium text-gray-600">Tên đăng nhập</span>
          <input
            className="field"
            value={u}
            autoComplete="username"
            autoCapitalize="none"
            onChange={(e) => {
              setU(e.target.value)
              setErr('')
            }}
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] font-medium text-gray-600">Mật khẩu</span>
          <input
            type="password"
            className="field"
            value={p}
            autoComplete="current-password"
            onChange={(e) => {
              setP(e.target.value)
              setErr('')
            }}
          />
        </label>
        {err && <div className="mb-3 rounded-2xl bg-red-50 px-4 py-2.5 text-[13px] text-red-700">{err}</div>}
        <button type="submit" className="h-12 w-full rounded-2xl bg-gradient-to-b from-[#9b3352] to-[#7d2640] font-semibold text-white shadow-md shadow-wine/25 transition active:scale-[.98]">
          Đăng nhập
        </button>
      </form>
    </div>
  )
}
