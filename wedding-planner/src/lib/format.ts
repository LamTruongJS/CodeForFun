const nf = new Intl.NumberFormat('vi-VN')

/** Tiền tự tính: 0 / null → "-" */
export const fmtMoney = (v: number | null | undefined) => (v ? nf.format(v) : '-')
/** Số người, số bàn: null → "0" */
export const fmtInt = (v: number | null | undefined) => nf.format(v ?? 0)
/** Hiển thị số trong ô nhập (trống nếu null) */
export const fmtInput = (v: number | null | undefined) => (v == null ? '' : nf.format(v))

export type ParseResult = { ok: true; value: number | null } | { ok: false; error: string }

/** Phân tích số người dùng nhập. Cho phép dấu chấm / khoảng trắng ngăn cách hàng nghìn. */
export function parseIntInput(raw: string): ParseResult {
  const s = raw.trim().replace(/[.\s]/g, '')
  if (s === '') return { ok: true, value: null }
  if (s.startsWith('-')) return { ok: false, error: 'Không được nhập số âm' }
  if (!/^\d+$/.test(s)) return { ok: false, error: 'Chỉ nhận số nguyên ≥ 0' }
  const value = Number(s)
  if (!Number.isSafeInteger(value)) return { ok: false, error: 'Số quá lớn' }
  return { ok: true, value }
}

const p2 = (x: number) => String(x).padStart(2, '0')

export function fmtDateTime(iso: string | undefined) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${p2(d.getHours())}:${p2(d.getMinutes())} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function todayStamp() {
  const d = new Date()
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}
