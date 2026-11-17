import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { useConfirmStore, useToast } from '../store/ui'
import { MODAL_PANEL, Modal } from './Modal'

const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)') : null
/** true khi màn hình ≥ 768px (hiển thị bảng), false trên điện thoại (hiển thị thẻ). */
export function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      mq?.addEventListener('change', cb)
      return () => mq?.removeEventListener('change', cb)
    },
    () => mq?.matches ?? true,
  )
}

export function PageTitle({ children, right, eyebrow = 'Lâm Trường & Lệ Huyền · 20.12.2026' }: { children: ReactNode; right?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[10.5px] font-semibold tracking-[0.3em] text-gold uppercase md:text-[11px]">{eyebrow}</p>
        <h1 className="mt-1 font-display text-[26px] leading-tight font-bold text-wine md:text-[34px]">{children}</h1>
        <div className="mt-1.5 flex items-center gap-2 text-gold-soft">
          <span className="h-px w-10 bg-gold-soft" />
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.5 1.1 4.4 2.4h2c.9-1.3 2.3-2.4 4.4-2.4 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21Z" />
          </svg>
          <span className="h-px w-10 bg-gold-soft" />
        </div>
      </div>
      {right}
    </div>
  )
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'outline' | 'danger'
  className?: string
  type?: 'button' | 'submit'
}) {
  const v = {
    primary: 'bg-gradient-to-b from-[#9b3352] to-[#7d2640] text-white shadow-md shadow-wine/20 hover:brightness-110',
    outline: 'border-[1.5px] border-[#e6dade] bg-white text-gray-700 hover:bg-[#faf5f7]',
    danger: 'border-[1.5px] border-red-200 bg-white text-red-600 hover:bg-red-50',
  }[variant]
  return (
    <button type={type} onClick={onClick} className={`h-10 rounded-full px-5 text-[14px] font-semibold whitespace-nowrap transition active:scale-[.98] ${v} ${className}`}>
      {children}
    </button>
  )
}

/** Dòng TỔNG CỘNG dính khi cuộn. */
export function TotalsBar({ items }: { items: { label: string; value: string; strong?: boolean; color?: string }[] }) {
  // Ghi chiều cao thanh vào biến CSS để tiêu đề bảng dính ngay bên dưới khi cuộn trang
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement.style
    const ro = new ResizeObserver(() => root.setProperty('--totals-h', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.removeProperty('--totals-h')
    }
  }, [])
  return (
    <div ref={ref} className="z-20 mb-4 rounded-2xl border border-[#ead9c4] bg-gradient-to-br from-[#fffaf3] to-[#f8ece0] px-4 py-3 shadow-[0_6px_20px_-10px_rgba(120,70,40,.35)] md:sticky md:top-[72px] md:flex md:items-center md:gap-6 md:px-5 md:py-2.5">
      <div className="mb-1.5 font-display text-[13px] font-semibold tracking-[0.12em] text-gold uppercase md:mb-0 md:shrink-0 md:border-r md:border-[#e6d2b5] md:pr-6">Tổng cộng</div>
      <div className={`grid flex-1 gap-x-3 gap-y-2 ${items.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {items.map((it) => (
          <div key={it.label} className="min-w-0">
            <div className="truncate text-[12px] text-gray-500">{it.label}</div>
            <div className="num text-[15px] font-bold whitespace-nowrap md:text-lg" style={{ color: it.color ?? '#2b2326' }}>
              {it.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600"
      aria-label="Xóa"
      title="Xóa"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
      </svg>
    </button>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[#e6d3da] bg-white/60 p-8 text-center text-gray-500">{children}</div>
}

export function ToastHost() {
  const toasts = useToast((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`anim-sheet flex max-w-md items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium text-white shadow-lg ${
            t.kind === 'error' ? 'bg-red-600' : 'bg-[#2b2326]'
          }`}
        >
          <span>{t.kind === 'error' ? '⚠' : '✓'}</span>
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function ConfirmHost() {
  const req = useConfirmStore((s) => s.req)
  if (!req) return null
  return (
    <Modal label={req.title} onClose={() => req.resolve(false)} z={70}>
      <div className={`${MODAL_PANEL} max-w-sm p-6`}>
        <h2 className="font-display text-xl font-bold text-[#2b2326]">{req.title}</h2>
        {req.message && <p className="mt-2 text-[14px] whitespace-pre-line text-gray-600">{req.message}</p>}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button onClick={() => req.resolve(false)} className="h-11 rounded-2xl bg-gray-100 font-medium text-gray-700 transition hover:bg-gray-200">
            Hủy
          </button>
          <button
            autoFocus
            onClick={() => req.resolve(true)}
            className={`h-11 rounded-2xl font-semibold text-white transition active:scale-[.98] ${req.danger ? 'bg-red-600' : 'bg-wine'}`}
          >
            {req.okText ?? 'Đồng ý'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Nút + nổi ở góc phải dưới (điện thoại). */
export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed right-4 bottom-[84px] z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a83a5b] to-[#7d2640] text-white shadow-lg shadow-wine/30 transition active:scale-95 md:hidden"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}
