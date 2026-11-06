import type { ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/ui'
import { ConfirmHost, ToastHost } from './Common'
import { LoadErrorGate } from './LoadErrorGate'

const I = ({ d }: { d: ReactNode }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)

export const NAV = [
  {
    to: '/',
    label: 'Tổng hợp',
    short: 'Tổng hợp',
    color: '#8E2C48',
    icon: <I d={<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />} />,
  },
  {
    to: '/guests/trai',
    label: 'Nhà Trai',
    short: 'Nhà Trai',
    color: '#2E75B6',
    icon: <I d={<><circle cx="12" cy="7" r="4" /><path d="M5 21v-1a7 7 0 0 1 14 0v1M10 15l2 2 2-2" /></>} />,
  },
  {
    to: '/guests/gai',
    label: 'Nhà Gái',
    short: 'Nhà Gái',
    color: '#C0504D',
    icon: <I d={<><circle cx="12" cy="7" r="4" /><path d="M4 21l3-7h10l3 7M12 3c-2 0-4 1-4.5 3" /></>} />,
  },
  {
    to: '/catering',
    label: 'Khẩu phần ăn',
    short: 'Ăn uống',
    color: '#5E9B37',
    icon: <I d={<path d="M7 2v20M4 2v6a3 3 0 0 0 6 0V2M17 22V2c-2.5 1-4 4-4 8h4" />} />,
  },
  {
    to: '/tasks',
    label: 'Công việc',
    short: 'Công việc',
    color: '#E07020',
    icon: <I d={<><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M8 13l3 3 5-6" /></>} />,
  },
  {
    to: '/data',
    label: 'Dữ liệu',
    short: 'Dữ liệu',
    color: '#7F6000',
    icon: <I d={<><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>} />,
  },
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
      <header className="sticky top-0 z-30 h-[56px] border-b border-[#f0e4e8] bg-white/85 backdrop-blur-md md:h-[64px]">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 md:px-6">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#b4466a] to-[#7d2640] text-white shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.5 1.1 4.4 2.4h2c.9-1.3 2.3-2.4 4.4-2.4 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21Z" />
              </svg>
            </span>
            <span className="font-display text-lg font-bold text-wine md:text-xl">Kế hoạch đám cưới</span>
          </div>
          <nav className="ml-6 hidden flex-1 gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className="rounded-full px-3.5 py-1.5 text-[14px] font-medium whitespace-nowrap transition-colors hover:bg-black/[.04]"
                style={({ isActive }) => (isActive ? { background: n.color, color: '#fff' } : { color: '#5b4d52' })}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={doLogout}
            className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-4 pb-28 md:px-6 md:pt-6 md:pb-12">
        <Outlet />
      </main>

      {/* Thanh điều hướng dưới cùng cho điện thoại */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-[#f0e4e8] bg-white/95 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-6">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className="flex flex-col items-center gap-0.5 pt-2 pb-1.5">
              {({ isActive }) => (
                <>
                  <span
                    className="flex h-8 w-12 items-center justify-center rounded-full transition-colors"
                    style={{ background: isActive ? n.color + '1f' : 'transparent', color: isActive ? n.color : '#9a8d92' }}
                  >
                    {n.icon}
                  </span>
                  <span className="text-[10.5px] leading-tight" style={{ color: isActive ? n.color : '#8a7d82', fontWeight: isActive ? 600 : 400 }}>
                    {n.short}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <ToastHost />
      <ConfirmHost />
      <LoadErrorGate />
    </div>
  )
}
