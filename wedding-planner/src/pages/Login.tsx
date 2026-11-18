import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/ui'
import { ARCH_PHOTO, WEDDING_DATE } from '../lib/photos'

const HEART = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.5 1.1 4.4 2.4h2c.9-1.3 2.3-2.4 4.4-2.4 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21Z'
// Ảnh cổng cưới (bản không chữ, đã cắt cho hai người nằm giữa khung vòm)
const PHOTO = ARCH_PHOTO

export function LoginPage() {
  const { loggedIn, login } = useAuth()
  const nav = useNavigate()
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (loggedIn) return <Navigate to="/" replace />

  return (
    <div className="relative min-h-dvh overflow-clip bg-[#fbf6f1] text-[#2b2326]">
      {/* Nền: quầng hồng + vàng nhạt */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-[#f6dbe3] opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-40 h-[560px] w-[560px] rounded-full bg-[#f3e2c2] opacity-60 blur-3xl" />

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center gap-5 px-5 py-5 lg:flex-row lg:gap-20 lg:px-10 lg:py-10">
        {/* Ảnh trong khung vòm */}
        <div className="relative shrink-0">
          <div className="absolute -inset-2 rounded-t-[calc(min(10.5dvh,119px)+8px)] rounded-b-[30px] max-lg:[@media(min-height:740px)]:rounded-t-[calc(min(12.25dvh,119px)+8px)] border border-[#d9b87a]/70 lg:-inset-4 lg:rounded-t-[206px] lg:rounded-b-[36px]" />
          <div className="relative aspect-[7/10] h-[30dvh] max-h-[340px] overflow-hidden rounded-t-[min(10.5dvh,119px)] rounded-b-[24px] max-lg:[@media(min-height:740px)]:h-[35dvh] max-lg:[@media(min-height:740px)]:rounded-t-[min(12.25dvh,119px)] shadow-[0_30px_60px_-25px_rgba(90,30,50,.55)] lg:aspect-auto lg:h-[560px] lg:max-h-none lg:w-[380px] lg:rounded-t-[190px] lg:rounded-b-[30px]">
            <picture className="block h-full w-full">
              <source media="(min-width: 1024px)" srcSet={PHOTO.src} />
              <img src={PHOTO.sm} alt="Lâm Trường và Lệ Huyền" className="block h-full w-full object-cover object-center" />
            </picture>
          </div>
          <span className="absolute -bottom-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[#fbf6f1] text-wine shadow-sm lg:-bottom-5 lg:h-10 lg:w-10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d={HEART} />
            </svg>
          </span>
        </div>

        {/* Thiệp: tên, ngày, đếm ngược, đăng nhập */}
        <div className="w-full max-w-[400px] text-center lg:text-left">
          <p className="text-[10.5px] font-semibold tracking-[0.42em] text-[#b08a43] uppercase lg:text-[11px]">Save the date</p>
          <h1 className="mt-1.5 font-display leading-[1.05] font-bold text-wine lg:mt-3">
            <span className="block text-[32px] lg:text-[56px]">Lâm Trường</span>
            <span className="block font-display text-[20px] leading-none font-semibold text-[#c79a4b] italic lg:my-0.5 lg:text-[30px]">&amp;</span>
            <span className="block text-[32px] lg:text-[56px]">Lệ Huyền</span>
          </h1>
          <div className="mt-2 flex items-center justify-center gap-3 text-[#8a6a2a] lg:mt-4 lg:justify-start">
            <span className="h-px w-8 bg-[#d9b87a]" />
            <span className="text-[13px] font-medium tracking-[0.3em] lg:text-[15px]">20 · 12 · 2026</span>
            <span className="h-px w-8 bg-[#d9b87a]" />
          </div>
          <Countdown />

          <form
            className="mt-4 rounded-[24px] border border-[#efe2d6] bg-white/80 p-4 text-left lg:mt-8 lg:rounded-[26px] lg:p-5 shadow-[0_20px_50px_-30px_rgba(90,30,50,.45)] backdrop-blur"
            onSubmit={async (e) => {
              e.preventDefault()
              if (busy) return
              setBusy(true)
              const error = await login(u, p)
              setBusy(false)
              if (error) setErr(error)
              else nav('/', { replace: true })
            }}
          >
            <p className="mb-4 hidden text-[13px] text-gray-500 lg:block">Kế hoạch đám cưới · đăng nhập để tiếp tục</p>
            <div className="grid gap-2.5 lg:gap-3">
              <input
                className="field !h-11 lg:!h-12"
                placeholder="Tên đăng nhập"
                aria-label="Tên đăng nhập"
                value={u}
                autoComplete="username"
                autoCapitalize="none"
                onChange={(e) => {
                  setU(e.target.value)
                  setErr('')
                }}
              />
              <input
                type="password"
                className="field !h-11 lg:!h-12"
                placeholder="Mật khẩu"
                aria-label="Mật khẩu"
                value={p}
                autoComplete="current-password"
                onChange={(e) => {
                  setP(e.target.value)
                  setErr('')
                }}
              />
            </div>
            {err && <div className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-[13px] text-red-700">{err}</div>}
            <button
              type="submit"
              disabled={busy}
              className="mt-3 h-11 w-full rounded-2xl lg:mt-4 lg:h-12 bg-gradient-to-b from-[#9b3352] to-[#7d2640] font-semibold text-white shadow-md shadow-wine/25 transition hover:brightness-110 active:scale-[.98] disabled:opacity-70"
            >
              {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

/** Đếm ngược tới ngày cưới: Ngày · Giờ · Phút (cập nhật mỗi 30 giây). */
function Countdown() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const ms = WEDDING_DATE.getTime() - now
  if (ms <= 0) {
    return <p className="mt-5 font-display text-[18px] font-semibold text-wine">Chúc mừng hạnh phúc 💍</p>
  }
  const parts: [number, string][] = [
    [Math.floor(ms / 86_400_000), 'Ngày'],
    [Math.floor(ms / 3_600_000) % 24, 'Giờ'],
    [Math.floor(ms / 60_000) % 60, 'Phút'],
  ]
  return (
    <div className="mt-3 flex justify-center gap-2 lg:mt-6 lg:justify-start lg:gap-2.5">
      {parts.map(([v, l]) => (
        <div key={l} className="w-[64px] rounded-2xl border border-[#efe2d6] bg-white/70 py-1.5 text-center shadow-sm lg:w-[74px] lg:py-2">
          <div className="num font-display text-[22px] leading-none font-bold text-wine lg:text-[26px]">{String(v).padStart(2, '0')}</div>
          <div className="mt-1 text-[10.5px] font-medium tracking-[0.2em] text-[#a08a6a] uppercase">{l}</div>
        </div>
      ))}
    </div>
  )
}
