import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { fmtInput, formatTyping, parseIntInput } from '../lib/format'
import { toast } from '../store/ui'
import { Select } from './Select'

const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') e.currentTarget.blur()
  if (e.key === 'Escape') {
    e.currentTarget.dataset.cancel = '1'
    e.currentTarget.blur()
  }
}

/** Ô chữ sửa trực tiếp, lưu khi rời ô hoặc Enter. */
export function InlineText({
  value,
  onSave,
  required,
  placeholder,
  className = '',
}: {
  value: string | null
  onSave: (v: string | null) => void
  required?: boolean
  placeholder?: string
  className?: string
}) {
  const [draft, setDraft] = useState(value ?? '')
  const [err, setErr] = useState(false)
  useEffect(() => setDraft(value ?? ''), [value])
  return (
    <input
      className={`cell ${err ? 'err' : ''} ${className}`}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => {
        setDraft(e.target.value)
        setErr(false)
      }}
      onKeyDown={blurOnEnter}
      onBlur={(e) => {
        if (e.currentTarget.dataset.cancel) {
          delete e.currentTarget.dataset.cancel
          return setDraft(value ?? '')
        }
        const v = draft.trim()
        if (required && !v) {
          toast('Tên không được để trống')
          setErr(true)
          setDraft(value ?? '')
          setTimeout(() => setErr(false), 1500)
          return
        }
        if (v !== (value ?? '')) onSave(v || null)
        else setDraft(value ?? '')
      }}
    />
  )
}

/** Ô số nguyên ≥ 0, hiển thị dạng 3.800.000, từ chối chữ / số âm. */
export function InlineNumber({
  value,
  onSave,
  required,
  className = '',
  placeholder,
}: {
  value: number | null
  onSave: (v: number | null) => void
  required?: boolean
  className?: string
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  return (
    <input
      ref={ref}
      inputMode="numeric"
      className={`cell num ${err ? 'err' : ''} ${className}`}
      value={focused ? draft : fmtInput(value)}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true)
        setDraft(fmtInput(value))
        requestAnimationFrame(() => e.target.select())
      }}
      onChange={(e) => {
        // tự thêm dấu chấm hàng nghìn khi đang gõ
        const el = e.target
        const f = formatTyping(el.value, el.selectionStart ?? el.value.length)
        setDraft(f.value)
        setErr(false)
        requestAnimationFrame(() => {
          if (document.activeElement === el) el.setSelectionRange(f.caret, f.caret)
        })
      }}
      onKeyDown={blurOnEnter}
      onBlur={(e) => {
        setFocused(false)
        if (e.currentTarget.dataset.cancel) {
          delete e.currentTarget.dataset.cancel
          return
        }
        const r = parseIntInput(draft)
        if (!r.ok || (required && r.value == null)) {
          toast(r.ok ? 'Ô này không được để trống' : `"${draft}" không hợp lệ — ${r.error}`)
          setErr(true)
          setTimeout(() => setErr(false), 1500)
          return
        }
        if (r.value !== value) onSave(r.value)
      }}
    />
  )
}

export type ChipOption<V extends string> = { value: V; label: string; bg: string; fg: string; bold?: boolean }

/** Dropdown dạng chip bo tròn ôm chữ. */
export function ChipSelect<V extends string>({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: V | null
  options: ChipOption<V>[]
  onChange: (v: V | null) => void
  placeholder: string
}) {
  return (
    <Select
      value={value}
      options={options}
      emptyLabel="Bỏ chọn"
      placeholder={placeholder}
      ariaLabel={placeholder}
      onChange={(v) => onChange(v as V | null)}
      trigger={(cur, open) => (
        <span
          className={`chip inline-flex items-center gap-1 ${cur ? '' : 'empty'} ${open ? 'ring-2 ring-wine/30' : ''}`}
          style={cur ? { background: cur.bg, color: cur.fg, fontWeight: cur.bold ? 700 : 500 } : undefined}
        >
          {cur ? cur.label : placeholder}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-60">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      )}
    />
  )
}

export const SIDE_OPTIONS: ChipOption<'TRAI' | 'GAI' | 'CHUNG'>[] = [
  { value: 'TRAI', label: 'Họ trai', bg: '#9FC5E8', fg: '#1F4E79' },
  { value: 'GAI', label: 'Họ gái', bg: '#F4CCCC', fg: '#85200C' },
  { value: 'CHUNG', label: 'Họ trai và gái', bg: '#D9D2E9', fg: '#4A2C7A' },
]
export const STATUS_OPTIONS: ChipOption<'DANG_LAM' | 'DA_LAM'>[] = [
  { value: 'DANG_LAM', label: 'Đang làm', bg: '#F1C232', fg: '#fff', bold: true },
  { value: 'DA_LAM', label: 'Đã làm', bg: '#137333', fg: '#fff', bold: true },
]
