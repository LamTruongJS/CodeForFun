import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/ui'
import { ConfirmHost, ToastHost } from './Common'
import { LoadErrorGate } from './LoadErrorGate'

export const NAV = [
  { to: '/', label: 'Tổng hợp', short: 'Tổng hợp', color: '#8E2C48', icon: '📊' },
  { to: '/guests/trai', label: 'Nhà Trai', short: 'Nhà Trai', color: '#2E75B6', icon: '🤵' },
  { to: '/guests/gai', label: 'Nhà Gái', short: 'Nhà Gái', color: '#C0504D', icon: '👰' },
  { to: '/catering', label: 'Khẩu phần ăn', short: 'Ăn uống', color: '#70AD47', icon: '🍽️' },
  { to: '/tasks', label: 'Công việc', short: 'Công việc', color: '#ED7D31', icon: '✅' },
  { to: '/data', label: 'Dữ liệu', short: 'Dữ liệu', color: '#7F6000', icon: '💾' },
]

export function Layout() {
  const logout = useAuth((s) => s.logout)
  const nav = useNavigate()
  const doLogout = () => {
    logout()
    nav('/login', { replace: true })
  }
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 h-[52px] border-b border-[#e7c4cf] bg-white/95 backdrop-blur md:h-[60px]">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-3 md:px-5">
          <div className="text-lg font-bold whitespace-nowrap text-wine md:text-xl">💍 Kế hoạch đám cưới</div>
          <nav className="ml-4 hidden flex-1 gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className="rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-colors"
                style={({ isActive }) =>
                  isActive ? { background: n.color, color: '#fff' } : { color: n.color, boxShadow: `inset 0 -3px 0 ${n.color}33` }
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button onClick={doLogout} className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-sm whitespace-nowrap hover:bg-gray-50">
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pt-3 pb-24 md:px-5 md:pt-5 md:pb-10">
        <Outlet />
      </main>

      {/* Thanh điều hướng dưới cùng cho điện thoại */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-gray-200 bg-white md:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="flex flex-col items-center pt-1.5 pb-1">
            {({ isActive }) => (
              <>
                <span
                  className="flex h-7 w-11 items-center justify-center rounded-full text-lg transition-colors"
                  style={{ background: isActive ? n.color + '26' : 'transparent' }}
                >
                  {n.icon}
                </span>
                <span className="text-[11px] leading-tight" style={{ color: isActive ? n.color : '#777', fontWeight: isActive ? 700 : 400 }}>
                  {n.short}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <ToastHost />
      <ConfirmHost />
      <LoadErrorGate />
    </div>
  )
}
