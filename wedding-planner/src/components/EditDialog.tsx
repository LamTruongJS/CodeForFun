import { useState, type ReactNode } from 'react'
import { fmtInput, formatTyping, parseIntInput } from '../lib/format'
import { MODAL_PANEL, Modal, ModalClose } from './Modal'
import { Select, type SelectOption } from './Select'

type Base = { key: string; label: string; half?: boolean }
export type FieldDef =
  | (Base & { type: 'text' | 'textarea'; required?: boolean; placeholder?: string; icon?: ReactNode })
  | (Base & {
      type: 'number'
      required?: boolean
      placeholder?: string
      /** 'money' → nền vàng nhạt + hậu tố "đ"; 'stepper' → nút − / + */
      variant?: 'money' | 'stepper' | 'plain'
      suffix?: string
      disabledWhen?: (v: Values) => boolean
    })
  | (Base & { type: 'select'; options: SelectOption[]; placeholder: string })
  | (Base & { type: 'toggle'; hint?: string })

export type Values = Record<string, string | number | boolean | null>

/** Hộp thoại thêm / sửa, luôn nằm giữa màn hình. */
export function EditDialog({
  title,
  subtitle,
  fields,
  initial,
  onSave,
  onDelete,
  onClose,
  extra,
}: {
  title: string
  subtitle?: string
  fields: FieldDef[]
  initial: Values
  onSave: (v: Values) => void
  onDelete?: () => void
  onClose: () => void
  extra?: (v: Values) => ReactNode
}) {
  // Số được giữ dạng chuỗi trong lúc nhập
  const [vals, setVals] = useState<Record<string, string | boolean>>(() => {
    const o: Record<string, string | boolean> = {}
    for (const f of fields) {
      const v = initial[f.key]
      o[f.key] = f.type === 'toggle' ? Boolean(v) : f.type === 'number' ? fmtInput(v as number | null) : ((v as string) ?? '')
    }
    return o
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const parsed = (): { ok: boolean; out: Values; errs: Record<string, string> } => {
    const out: Values = {}
    const errs: Record<string, string> = {}
    for (const f of fields) {
      const raw = vals[f.key]
      if (f.type === 'toggle') out[f.key] = Boolean(raw)
      else if (f.type === 'number') {
        if (f.disabledWhen?.(out)) {
          out[f.key] = null
          continue
        }
        const r = parseIntInput(String(raw))
        if (!r.ok) errs[f.key] = r.error
        else if (f.required && r.value == null) errs[f.key] = 'Không được để trống'
        else out[f.key] = r.value
      } else {
        const s = String(raw).trim()
        if ('required' in f && f.required && !s) errs[f.key] = 'Không được để trống'
        out[f.key] = s || null
      }
    }
    return { ok: Object.keys(errs).length === 0, out, errs }
  }

  const live = parsed().out
  const submit = () => {
    const r = parsed()
    setErrors(r.errs)
    if (r.ok) onSave(r.out)
  }
  const set = (key: string, v: string | boolean) => {
    setVals((s) => ({ ...s, [key]: v }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }
  /** Ô số: tự thêm dấu chấm hàng nghìn khi đang gõ, giữ vị trí con trỏ. */
  const setNumber = (key: string, el: HTMLInputElement) => {
    const f = formatTyping(el.value, el.selectionStart ?? el.value.length)
    set(key, f.value)
    requestAnimationFrame(() => {
      if (document.activeElement === el) el.setSelectionRange(f.caret, f.caret)
    })
  }

  const renderField = (f: FieldDef) => {
    const err = errors[f.key]
    const cls = `field ${err ? 'invalid' : ''}`

    if (f.type === 'toggle')
      return (
        <label key={f.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[#f6f1f3] px-4 py-3">
          <span>
            <span className="block font-medium">{f.label}</span>
            {f.hint && <span className="block text-[13px] text-gray-500">{f.hint}</span>}
          </span>
          <input type="checkbox" className="sr-only" checked={Boolean(vals[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
          <Switch on={Boolean(vals[f.key])} />
        </label>
      )

    let control: ReactNode
    if (f.type === 'textarea') {
      control = <textarea className={cls} rows={2} value={String(vals[f.key])} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
    } else if (f.type === 'select') {
      control = (
        <Select
          value={String(vals[f.key]) || null}
          options={f.options}
          placeholder={f.placeholder}
          emptyLabel={f.placeholder}
          ariaLabel={f.label}
          className={err ? 'invalid' : ''}
          onChange={(v) => set(f.key, v ?? '')}
        />
      )
    } else if (f.type === 'number') {
      const disabled = f.disabledWhen?.(live) ?? false
      const raw = String(vals[f.key])
      const reformat = () => {
        const r = parseIntInput(raw)
        if (r.ok) set(f.key, fmtInput(r.value))
      }
      if (f.variant === 'stepper') {
        const cur = parseIntInput(raw)
        const n = cur.ok ? (cur.value ?? 0) : 0
        control = (
          <div className="flex items-center gap-2">
            <StepBtn label="Giảm" disabled={n <= 0} onClick={() => set(f.key, String(Math.max(0, n - 1)))}>
              −
            </StepBtn>
            <input
              className={`${cls} num text-center text-lg font-semibold`}
              inputMode="numeric"
              value={raw}
              onChange={(e) => setNumber(f.key, e.target)}
              onBlur={reformat}
            />
            <StepBtn label="Tăng" onClick={() => set(f.key, String(n + 1))}>
              +
            </StepBtn>
          </div>
        )
      } else {
        const suffix = f.suffix
        control = (
          <div className="relative">
            <input
              className={`${cls} num ${f.variant === 'money' ? 'money' : ''} ${suffix ? 'pr-14' : ''} text-right`}
              inputMode="numeric"
              autoComplete="off"
              value={disabled ? '' : raw}
              placeholder={disabled ? 'Tự tính' : (f.placeholder ?? '0')}
              disabled={disabled}
              onChange={(e) => setNumber(f.key, e.target)}
              onBlur={reformat}
            />
            {suffix && !disabled && (
              <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[12px] font-medium text-gray-400">{suffix}</span>
            )}
          </div>
        )
      }
    } else {
      control = (
        <div className="relative">
          {f.icon && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-gray-400">{f.icon}</span>}
          <input
            className={`${cls} ${f.icon ? 'pl-10' : ''}`}
            value={String(vals[f.key])}
            onChange={(e) => set(f.key, e.target.value)}
            placeholder={f.placeholder}
            autoComplete="off"
            autoFocus={f.key === 'name' && !initial.name}
          />
        </div>
      )
    }

    return (
      <label key={f.key} className={`block min-w-0 ${f.half ? '' : 'col-span-2'}`}>
        <span className="mb-1.5 block text-[13px] font-medium text-gray-600">
          {f.label}
          {f.type === 'number' && f.variant === 'money' && <span className="font-normal text-gray-400"> (VNĐ)</span>}
          {'required' in f && f.required && <span className="text-wine"> *</span>}
        </span>
        {control}
        {err && (
          <span className="mt-1.5 flex items-center gap-1 text-[13px] text-red-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
            </svg>
            {err}
          </span>
        )}
      </label>
    )
  }

  return (
    <Modal label={title} onClose={onClose}>
      <form
        className={`${MODAL_PANEL} max-w-lg`}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] leading-tight font-bold text-wine">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-[13px] text-gray-500">{subtitle}</p>}
          </div>
          <ModalClose onClick={onClose} />
        </div>

        <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-4 overflow-y-auto px-5 pt-2 pb-5">
          {fields.map(renderField)}
          {extra && <div className="col-span-2">{extra(live)}</div>}
        </div>

        <div className="flex items-center gap-2 border-t border-gray-100 bg-white px-5 py-3">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex h-12 items-center gap-1.5 rounded-2xl px-3 font-medium text-red-600 transition hover:bg-red-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
              </svg>
              Xóa
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-auto h-12 rounded-2xl px-5 font-medium text-gray-600 transition hover:bg-gray-100">
            Hủy
          </button>
          <button
            type="submit"
            className="h-12 min-w-[120px] rounded-2xl bg-gradient-to-b from-[#9b3352] to-[#7d2640] px-6 font-semibold text-white shadow-md shadow-wine/25 transition active:scale-[.98]"
          >
            Lưu
          </button>
        </div>
      </form>
    </Modal>
  )
}

function StepBtn({ children, onClick, disabled, label }: { children: ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-[1.5px] border-[#ebe3e6] bg-white text-2xl text-wine transition active:scale-95 disabled:opacity-35"
    >
      {children}
    </button>
  )
}

export function Switch({ on }: { on: boolean }) {
  return (
    <span className={`relative inline-block h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-[#70AD47]' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </span>
  )
}
