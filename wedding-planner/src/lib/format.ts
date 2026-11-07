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

/** Thêm dấu chấm hàng nghìn cho chuỗi chữ số: "5000000" → "5.000.000". */
export const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/**
 * Định dạng ngay khi đang gõ, giữ đúng vị trí con trỏ.
 * - Chỉ xử lý khi chuỗi chỉ gồm chữ số / dấu chấm / khoảng trắng.
 * - Có chữ cái hoặc dấu "-" → giữ nguyên để khi lưu vẫn báo lỗi rõ ràng.
 * @param caret vị trí con trỏ trong chuỗi vừa gõ
 */
export function formatTyping(raw: string, caret: number = raw.length): { value: string; caret: number } {
  if (!/^[\d.\s]*$/.test(raw)) return { value: raw, caret }
  const allDigits = raw.replace(/\D/g, '')
  let before = raw.slice(0, caret).replace(/\D/g, '').length
  // bỏ số 0 thừa ở đầu ("007" → "7"), nhưng giữ "0"
  const lead = allDigits.length - allDigits.replace(/^0+(?=\d)/, '').length
  const digits = allDigits.slice(lead)
  before = Math.max(0, before - lead)
  const value = groupDigits(digits)
  // đặt con trỏ ngay sau chữ số thứ `before`
  let pos = 0
  for (let seen = 0; pos < value.length && seen < before; pos++) if (/\d/.test(value[pos])) seen++
  return { value, caret: pos }
}
