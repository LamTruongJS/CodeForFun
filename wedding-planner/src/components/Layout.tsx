import type { ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/ui'
import { ConfirmHost, ToastHost } from './Common'
import { SaveIndicator, SyncGate } from './SyncGate'
import { HERO_PHOTO } from '../lib/photos'
import { ChatBot } from './ChatBot'
import { flushNow, stopSync } from '../store/sync'

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
  const doLogout = async () => {
    await flushNow()
    stopSync()
    logout()
    nav('/login', { replace: true })
  }
  return (
    <div className="min-h-dvh">
      {/* Nền: quầng hồng + vàng nhạt như trang đăng nhập */}
      <div className="pointer-events-none fixed -top-48 -left-48 -z-10 h-[560px] w-[560px] rounded-full bg-[#f6dbe3] opacity-50 blur-3xl" />
      <div className="pointer-events-none fixed -right-40 -bottom-48 -z-10 h-[600px] w-[600px] rounded-full bg-[#f3e2c2] opacity-50 blur-3xl" />

      <header className="sticky top-0 z-30 h-[60px] border-b border-[#eee0d2] bg-[#fbf6f1]/85 backdrop-blur-md md:h-[64px]">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 md:px-6 2xl:max-w-[1600px] 2xl:px-8">
          <NavLink to="/" className="flex min-w-0 items-center gap-2.5 whitespace-nowrap">
            <img src={HERO_PHOTO.sm} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover object-[50%_20%] ring-2 ring-gold-soft ring-offset-2 ring-offset-[#fbf6f1]" />
            <span className="min-w-0 leading-tight">
              <span className="block font-display text-[16px] font-bold text-wine md:text-[17px]">Lâm Trường &amp; Lệ Huyền</span>
              <span className="block text-[9.5px] font-semibold tracking-[0.28em] text-gold uppercase">Kế hoạch đám cưới</span>
            </span>
          </NavLink>
          <nav className="ml-4 hidden flex-1 gap-1 md:flex lg:ml-8">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `rounded-full px-3.5 py-1.5 text-[14px] font-medium whitespace-nowrap transition-colors ${
                    isActive ? 'bg-wine text-white shadow-[0_4px_12px_-4px_rgba(142,44,72,.6)]' : 'text-[#5b4d52] hover:bg-[#f3e7da]'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <SaveIndicator />
          </div>
          <button
            onClick={doLogout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-4 pb-28 md:px-6 md:pt-6 md:pb-12 2xl:max-w-[1600px] 2xl:px-8">
        <SyncGate>
          <Outlet />
        </SyncGate>
      </main>

      {/* Thanh điều hướng dưới cùng cho điện thoại */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-[#eee0d2] bg-[#fbf6f1]/95 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-6">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className="flex flex-col items-center gap-0.5 pt-2 pb-1.5">
              {({ isActive }) => (
                <>
                  <span
                    className="flex h-8 w-12 items-center justify-center rounded-full transition-colors"
                    style={{ background: isActive ? '#8e2c481a' : 'transparent', color: isActive ? '#8e2c48' : '#9a8d92' }}
                  >
                    {n.icon}
                  </span>
                  <span className="text-[10.5px] leading-tight" style={{ color: isActive ? '#8e2c48' : '#8a7d82', fontWeight: isActive ? 600 : 400 }}>
                    {n.short}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <ChatBot />
      <ToastHost />
      <ConfirmHost />
    </div>
  )
}
