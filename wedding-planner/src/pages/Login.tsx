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
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-blush to-white p-4">
      <form
        className="w-full max-w-sm rounded-2xl border border-[#e7c4cf] bg-white p-6 shadow-lg"
        onSubmit={(e) => {
          e.preventDefault()
          if (login(u, p)) nav('/', { replace: true })
          else setErr('Tên đăng nhập hoặc mật khẩu không đúng')
        }}
      >
        <div className="mb-1 text-center text-4xl">💍</div>
        <h1 className="mb-6 text-center text-2xl font-bold text-wine">Kế hoạch đám cưới</h1>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-gray-600">Tên đăng nhập</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-wine focus:ring-2 focus:ring-wine/20"
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
          <span className="mb-1 block text-sm text-gray-600">Mật khẩu</span>
          <input
            type="password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-wine focus:ring-2 focus:ring-wine/20"
            value={p}
            autoComplete="current-password"
            onChange={(e) => {
              setP(e.target.value)
              setErr('')
            }}
          />
        </label>
        {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        <button type="submit" className="w-full rounded-lg bg-wine py-2.5 text-lg font-bold text-white hover:opacity-90">
          Đăng nhập
        </button>
      </form>
    </div>
  )
}
