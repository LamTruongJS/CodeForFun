import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type SelectOption = {
  value: string
  label: string
  /** chữ phụ bên phải, VD số lượng */
  hint?: string
  /** màu chip (nếu có) */
  bg?: string
  fg?: string
  bold?: boolean
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

/**
 * Dropdown tự vẽ thay cho <select> gốc của trình duyệt.
 * - Danh sách nổi (portal) tự lật lên trên nếu thiếu chỗ phía dưới.
 * - Có ô tìm kiếm khi nhiều lựa chọn.
 * - Bàn phím: ↑ ↓ Enter Esc.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder,
  emptyLabel,
  trigger,
  className = '',
  searchable,
  ariaLabel,
}: {
  value: string | null
  options: SelectOption[]
  onChange: (v: string | null) => void
  /** chữ hiện khi chưa chọn */
  placeholder: string
  /** nếu có: thêm lựa chọn "trống" ở đầu danh sách với nhãn này */
  emptyLabel?: string
  /** tự vẽ nút bấm (VD dạng chip); mặc định là ô giống .field */
  trigger?: (cur: SelectOption | undefined, open: boolean) => ReactNode
  className?: string
  searchable?: boolean
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties>({})

  const all = useMemo<(SelectOption & { empty?: boolean })[]>(
    () => (emptyLabel ? [{ value: '', label: emptyLabel, empty: true }, ...options] : options),
    [options, emptyLabel],
  )
  const canSearch = searchable ?? options.length > 8
  const list = useMemo(() => (q.trim() ? all.filter((o) => norm(o.label).includes(norm(q.trim()))) : all), [all, q])
  const cur = options.find((o) => o.value === value)

  const close = (focus = true) => {
    setOpen(false)
    setQ('')
    if (focus) btnRef.current?.focus()
  }
  const pick = (o: SelectOption & { empty?: boolean }) => {
    onChange(o.empty ? null : o.value)
    close()
  }

  // Vị trí danh sách: dưới nút, lật lên nếu thiếu chỗ; giới hạn trong màn hình.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const width = Math.min(Math.max(r.width, 240), vw - 16)
      const left = Math.min(Math.max(8, r.left), vw - width - 8)
      const below = vh - r.bottom - 12
      const above = r.top - 12
      const up = below < 260 && above > below
      const maxHeight = Math.min(360, up ? above : below)
      setPos(up ? { left, width, bottom: vh - r.top + 6, maxHeight } : { left, width, top: r.bottom + 6, maxHeight })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  // Đóng khi bấm ra ngoài / cuộn trang
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!popRef.current?.contains(t) && !btnRef.current?.contains(t)) close(false)
    }
    const onScroll = (e: Event) => {
      if (!popRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  // Khi mở: đánh dấu lựa chọn hiện tại
  useEffect(() => {
    if (open) setActive(Math.max(0, all.findIndex((o) => (o.empty ? value == null : o.value === value))))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    popRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation() // không đóng luôn popup cha
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(list.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (list[active]) pick(list[active])
    } else if (e.key === 'Tab') close(false)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={trigger ? `inline-flex max-w-full ${className}` : `field flex items-center justify-between gap-2 text-left ${open ? 'is-open' : ''} ${className}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        onKeyDown={onKey}
      >
        {trigger ? (
          trigger(cur, open)
        ) : (
          <>
            <span className={`min-w-0 truncate ${cur ? '' : 'text-[#b5a9ad]'}`}>{cur ? <OptionLabel o={cur} /> : placeholder}</span>
            <Chevron open={open} />
          </>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            role="listbox"
            className="anim-pop fixed z-[100] flex flex-col overflow-hidden rounded-2xl border border-[#efe5e9] bg-white shadow-[0_16px_40px_-12px_rgba(60,20,35,.35)]"
            style={pos}
            onKeyDown={onKey}
            onClick={(e) => e.stopPropagation()}
          >
            {canSearch && (
              <div className="border-b border-[#f3ecef] p-2">
                <input
                  // điện thoại: không tự bật bàn phím che mất danh sách
                  autoFocus={window.matchMedia('(pointer: fine)').matches}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    setActive(0)
                  }}
                  placeholder="Tìm…"
                  autoComplete="off"
                  className="h-10 w-full rounded-xl bg-[#f7f3f5] px-3 text-[15px] outline-none focus:bg-white focus:ring-2 focus:ring-wine/15"
                />
              </div>
            )}
            <div className="overflow-y-auto overscroll-contain p-1.5">
              {list.length === 0 && <div className="px-3 py-6 text-center text-[14px] text-gray-400">Không có kết quả</div>}
              {list.map((o, i) => {
                const selected = o.empty ? value == null : o.value === value
                return (
                  <button
                    key={o.value || '__empty'}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors ${
                      i === active ? 'bg-[#f8eef1]' : ''
                    } ${selected ? 'font-semibold text-wine' : 'text-[#2b2326]'}`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {o.empty ? <span className="text-gray-500">{o.label}</span> : <OptionLabel o={o} />}
                    </span>
                    {o.hint && <span className="shrink-0 rounded-full bg-[#f3ecef] px-2 py-0.5 text-[12px] font-medium text-gray-500">{o.hint}</span>}
                    <span className="w-4 shrink-0 text-wine">
                      {selected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function OptionLabel({ o }: { o: SelectOption }) {
  if (!o.bg) return <>{o.label}</>
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[13px]"
      style={{ background: o.bg, color: o.fg, fontWeight: o.bold ? 700 : 500 }}
    >
      {o.label}
    </span>
  )
}

export function Chevron({ open, className = '' }: { open?: boolean; className?: string }) {
  return (
    <svg
      className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''} ${className}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
