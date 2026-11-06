import { useEffect, useState, type ReactNode } from 'react'
import { fmtInput, parseIntInput } from '../lib/format'

export type FieldDef =
  | { key: string; label: string; type: 'text' | 'textarea'; required?: boolean; placeholder?: string }
  | { key: string; label: string; type: 'number'; required?: boolean; placeholder?: string; disabledWhen?: (v: Values) => boolean }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; placeholder: string }
  | { key: string; label: string; type: 'toggle' }

export type Values = Record<string, string | number | boolean | null>

/** Form dạng "bottom sheet" cho điện thoại (modal giữa màn hình trên desktop). */
export function EditSheet({
  title,
  fields,
  initial,
  onSave,
  onDelete,
  onClose,
  extra,
}: {
  title: string
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const parsed = (): { ok: boolean; out: Values; errs: Record<string, string> } => {
    const out: Values = {}
    const errs: Record<string, string> = {}
    for (const f of fields) {
      const raw = vals[f.key]
      if (f.type === 'toggle') out[f.key] = Boolean(raw)
      else if (f.type === 'number') {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <form
        className="anim-sheet flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl md:max-w-lg md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-bold text-wine">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-2xl leading-none text-gray-500 hover:bg-gray-100" aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {fields.map((f) => {
            const err = errors[f.key]
            const base = `w-full rounded-lg border px-3 py-2.5 text-base outline-none focus:border-wine focus:ring-2 focus:ring-wine/20 ${
              err ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`
            const set = (v: string | boolean) => {
              setVals((s) => ({ ...s, [f.key]: v }))
              setErrors((e) => ({ ...e, [f.key]: '' }))
            }
            if (f.type === 'toggle')
              return (
                <label key={f.key} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
                  <span>{f.label}</span>
                  <input type="checkbox" className="h-5 w-5 accent-[#8E2C48]" checked={Boolean(vals[f.key])} onChange={(e) => set(e.target.checked)} />
                </label>
              )
            const disabled = f.type === 'number' && f.disabledWhen?.(live)
            return (
              <label key={f.key} className="block">
                <span className="mb-1 block text-sm text-gray-600">
                  {f.label}
                  {'required' in f && f.required && <span className="text-red-600"> *</span>}
                </span>
                {f.type === 'textarea' ? (
                  <textarea className={base} rows={2} value={String(vals[f.key])} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} />
                ) : f.type === 'select' ? (
                  <select className={base + ' bg-white'} value={String(vals[f.key])} onChange={(e) => set(e.target.value)}>
                    <option value="">{f.placeholder}</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={`${base} ${f.type === 'number' ? 'num text-right' : ''} ${disabled ? 'bg-calc text-gray-500' : ''} ${
                      f.type === 'number' && !disabled ? 'bg-input' : ''
                    }`}
                    inputMode={f.type === 'number' ? 'numeric' : undefined}
                    value={disabled ? '(tự tính)' : String(vals[f.key])}
                    disabled={disabled}
                    onChange={(e) => set(e.target.value)}
                    placeholder={f.placeholder}
                    autoFocus={f.key === 'name' && !initial.name}
                  />
                )}
                {err && <span className="mt-1 block text-sm text-red-600">{err}</span>}
              </label>
            )
          })}
          {extra?.(live)}
        </div>
        <div className="safe-bottom flex gap-2 border-t px-4 py-3">
          {onDelete && (
            <button type="button" onClick={onDelete} className="rounded-lg border border-red-300 px-4 py-2.5 text-red-700 hover:bg-red-50">
              Xóa
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-gray-300 px-4 py-2.5 hover:bg-gray-50">
            Hủy
          </button>
          <button type="submit" className="rounded-lg bg-wine px-5 py-2.5 font-bold text-white hover:opacity-90">
            Lưu
          </button>
        </div>
      </form>
    </div>
  )
}
