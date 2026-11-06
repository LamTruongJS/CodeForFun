import { useSyncExternalStore, type ReactNode } from 'react'
import { useConfirmStore, useToast } from '../store/ui'

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

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-lg leading-tight font-bold tracking-wide text-wine sm:text-xl md:text-2xl">{children}</h1>
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
    primary: 'bg-wine text-white hover:opacity-90',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50',
    danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  }[variant]
  return (
    <button type={type} onClick={onClick} className={`rounded-lg px-4 py-2 font-semibold whitespace-nowrap ${v} ${className}`}>
      {children}
    </button>
  )
}

/** Dòng TỔNG CỘNG dính khi cuộn. */
export function TotalsBar({ items }: { items: { label: string; value: string; strong?: boolean; color?: string }[] }) {
  return (
    <div className="sticky top-[52px] z-20 mb-3 rounded-lg border border-[#e7c4cf] bg-blush px-3 py-2 shadow-sm md:top-[60px]">
      <div className="mb-1 text-xs font-bold tracking-wider text-wine">TỔNG CỘNG</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:flex sm:flex-wrap sm:gap-x-8">
        {items.map((it) => (
          <div key={it.label} className="flex items-baseline justify-between gap-2 sm:block">
            <span className="text-sm text-gray-600">{it.label}</span>{' '}
            <span className="num font-bold" style={{ color: it.color }}>
              {it.value}
            </span>
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
  return <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-gray-500">{children}</div>
}

export function ToastHost() {
  const toasts = useToast((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`anim-sheet max-w-md rounded-lg px-4 py-2.5 text-white shadow-lg ${t.kind === 'error' ? 'bg-red-600' : 'bg-green-700'}`}
        >
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => req.resolve(false)}>
      <div className="anim-sheet w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{req.title}</h2>
        {req.message && <p className="mt-2 whitespace-pre-line text-gray-600">{req.message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => req.resolve(false)}>
            Hủy
          </Btn>
          <button
            autoFocus
            onClick={() => req.resolve(true)}
            className={`rounded-lg px-4 py-2 font-semibold text-white ${req.danger ? 'bg-red-600' : 'bg-wine'}`}
          >
            {req.okText ?? 'Đồng ý'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Nút + nổi ở góc phải dưới (điện thoại). */
export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed right-4 bottom-[76px] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-wine text-3xl text-white shadow-lg active:scale-95 md:hidden"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      +
    </button>
  )
}
