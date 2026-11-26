import { z } from 'zod'
import { useAppStore } from '../store/useAppStore'
import { fmtMoney } from './format'
import type { AppData, CateringItem, Guest, GuestSide, Task } from './types'

/**
 * Công cụ sửa dữ liệu của trợ lý Claude.
 * Claude chỉ ĐỀ XUẤT thay đổi (tool "propose_changes"); người dùng bấm "Áp dụng" thì mới ghi.
 * Mỗi dòng được chỉ bằng STT + tên hiện tại; tên không khớp → không sửa (tránh sửa nhầm).
 */

const side = z.enum(['TRAI', 'GAI'])
const group = z.enum(['TIEC', 'NHOM_HO'])
const money = z.number().int().nonnegative().nullable()
const text = z.string().trim().nullable()
const stt = z.number().int().positive()
const currentName = z.string().min(1)

const guestFields = z
  .object({
    name: z.string().trim().min(1),
    cardWritten: z.boolean(),
    address: text,
    attendees: z.number().int().nonnegative(),
    expectedGift: money,
    actualGift: money,
    note: text,
  })
  .partial()
const taskFields = z
  .object({
    name: z.string().trim().min(1),
    amount: money,
    deposit: money,
    side: z.enum(['TRAI', 'GAI', 'CHUNG']).nullable(),
    status: z.enum(['DANG_LAM', 'DA_LAM']).nullable(),
    note: text,
  })
  .partial()
const itemFields = z
  .object({
    name: z.string().trim().min(1),
    unit: text,
    unitPrice: money,
    quantityMode: z.enum(['MANUAL', 'AUTO_TABLES']),
    quantity: money,
  })
  .partial()
const settingFields = z
  .object({
    peoplePerTable: z.number().int().positive(),
    relativeTables: z.number().int().nonnegative(),
    nhomHoTables: z.number().int().nonnegative(),
  })
  .partial()

export const changeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_guest'), side, fields: guestFields.extend({ name: z.string().trim().min(1) }) }),
  z.object({ action: z.literal('update_guest'), side, stt, current_name: currentName, fields: guestFields }),
  z.object({ action: z.literal('delete_guest'), side, stt, current_name: currentName }),
  z.object({ action: z.literal('add_task'), fields: taskFields.extend({ name: z.string().trim().min(1) }) }),
  z.object({ action: z.literal('update_task'), stt, current_name: currentName, fields: taskFields }),
  z.object({ action: z.literal('delete_task'), stt, current_name: currentName }),
  z.object({ action: z.literal('add_catering_item'), side, group, fields: itemFields.extend({ name: z.string().trim().min(1) }) }),
  z.object({ action: z.literal('update_catering_item'), side, group, stt, current_name: currentName, fields: itemFields }),
  z.object({ action: z.literal('delete_catering_item'), side, group, stt, current_name: currentName }),
  z.object({ action: z.literal('update_catering_setting'), side, fields: settingFields }),
])
export const proposalSchema = z.object({ summary: z.string().optional(), changes: z.array(changeSchema).min(1).max(500) })

export type Change = z.infer<typeof changeSchema>
export type Proposal = z.infer<typeof proposalSchema>

// ---------- Tìm dòng được nhắc tới ----------
const norm = (s: string) =>
  s.normalize('NFC').toLowerCase().replace(/[–—-]/g, '-').replace(/\s+/g, ' ').trim()

type Target =
  | { kind: 'guest'; row: Guest }
  | { kind: 'task'; row: Task }
  | { kind: 'item'; row: CateringItem }

function findTarget(data: AppData, c: Change): Target | string | null {
  const check = <R extends { name: string; sortOrder: number }>(rows: R[], label: string, n: number, name: string): R | string => {
    const row = rows.find((r) => r.sortOrder === n)
    if (!row) return `Không có dòng STT ${n} trong ${label}`
    if (norm(row.name) !== norm(name)) return `STT ${n} trong ${label} là “${row.name}”, không phải “${name}” — không sửa`
    return row
  }
  switch (c.action) {
    case 'update_guest':
    case 'delete_guest': {
      const r = check(data.guests.filter((g) => g.side === c.side), SIDE_LABEL[c.side], c.stt, c.current_name)
      return typeof r === 'string' ? r : { kind: 'guest', row: r }
    }
    case 'update_task':
    case 'delete_task': {
      const r = check(data.tasks, 'Công việc', c.stt, c.current_name)
      return typeof r === 'string' ? r : { kind: 'task', row: r }
    }
    case 'update_catering_item':
    case 'delete_catering_item': {
      const r = check(
        data.cateringItems.filter((i) => i.side === c.side && i.group === c.group),
        `${GROUP_LABEL[c.group]} ${SIDE_LABEL[c.side]}`,
        c.stt,
        c.current_name,
      )
      return typeof r === 'string' ? r : { kind: 'item', row: r }
    }
    default:
      return null
  }
}

// ---------- Mô tả dễ đọc cho thẻ xác nhận ----------
const SIDE_LABEL: Record<GuestSide, string> = { TRAI: 'Nhà Trai', GAI: 'Nhà Gái' }
const GROUP_LABEL = { TIEC: 'Tiệc cưới', NHOM_HO: 'Nhóm họ' } as const
const FIELD_LABEL: Record<string, string> = {
  name: 'Tên',
  cardWritten: 'Viết thiệp',
  address: 'Địa chỉ',
  attendees: 'Dự kiến đi',
  expectedGift: 'Mừng dự kiến',
  actualGift: 'Mừng thực tế',
  note: 'Ghi chú',
  amount: 'Số tiền',
  deposit: 'Đã cọc',
  side: 'Bên',
  status: 'Tiến độ',
  unit: 'ĐVT',
  unitPrice: 'Đơn giá',
  quantityMode: 'Số lượng theo',
  quantity: 'Số lượng',
  peoplePerTable: 'Người / bàn',
  relativeTables: 'Bàn của họ hàng',
  nhomHoTables: 'Số bàn nhóm họ',
}
const MONEY_FIELDS = new Set(['expectedGift', 'actualGift', 'amount', 'deposit', 'unitPrice'])
const VALUE_LABEL: Record<string, string> = {
  TRAI: 'Họ trai',
  GAI: 'Họ gái',
  CHUNG: 'Họ trai và gái',
  DANG_LAM: 'Đang làm',
  DA_LAM: 'Đã làm',
  MANUAL: 'nhập tay',
  AUTO_TABLES: 'số bàn',
}

function fmtValue(key: string, v: unknown): string {
  if (key === 'status' && v == null) return 'Chưa làm'
  if (key === 'side' && v == null) return 'Chưa chọn'
  if (v === null || v === undefined || v === '') return '(trống)'
  if (key === 'cardWritten') return v ? '✓ đã viết' : 'chưa viết'
  if (MONEY_FIELDS.has(key) && typeof v === 'number') return `${fmtMoney(v)} đ`
  if (typeof v === 'string' && VALUE_LABEL[v]) return VALUE_LABEL[v]
  return String(v)
}

const fieldsText = (fields: Record<string, unknown>, before?: Record<string, unknown>) =>
  Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${FIELD_LABEL[k] ?? k}: ${before ? `${fmtValue(k, before[k])} → ` : ''}${fmtValue(k, v)}`)
    .join(' · ')

export type ChangeLine = { title: string; detail: string; kind: 'add' | 'update' | 'delete'; error?: string }

/** Mô tả từng thay đổi (dựa trên dữ liệu hiện tại), kèm lỗi nếu không tìm thấy đúng dòng. */
export function describeChanges(data: AppData, changes: Change[]): ChangeLine[] {
  return changes.map((c) => {
    const t = findTarget(data, c)
    const error = typeof t === 'string' ? t : undefined
    const before = t && typeof t !== 'string' ? (t.row as unknown as Record<string, unknown>) : undefined
    switch (c.action) {
      case 'add_guest':
        return { kind: 'add', title: `Thêm khách ${SIDE_LABEL[c.side]}: ${c.fields.name}`, detail: fieldsText({ ...c.fields, name: undefined }) }
      case 'update_guest':
        return { kind: 'update', title: `${SIDE_LABEL[c.side]} #${c.stt} ${c.current_name}`, detail: fieldsText(c.fields, before), error }
      case 'delete_guest':
        return { kind: 'delete', title: `Xoá khách ${SIDE_LABEL[c.side]} #${c.stt} ${c.current_name}`, detail: '', error }
      case 'add_task':
        return { kind: 'add', title: `Thêm công việc: ${c.fields.name}`, detail: fieldsText({ ...c.fields, name: undefined }) }
      case 'update_task':
        return { kind: 'update', title: `Công việc #${c.stt} ${c.current_name}`, detail: fieldsText(c.fields, before), error }
      case 'delete_task':
        return { kind: 'delete', title: `Xoá công việc #${c.stt} ${c.current_name}`, detail: '', error }
      case 'add_catering_item':
        return { kind: 'add', title: `Thêm hạng mục ${GROUP_LABEL[c.group]} ${SIDE_LABEL[c.side]}: ${c.fields.name}`, detail: fieldsText({ ...c.fields, name: undefined }) }
      case 'update_catering_item':
        return { kind: 'update', title: `${GROUP_LABEL[c.group]} ${SIDE_LABEL[c.side]} #${c.stt} ${c.current_name}`, detail: fieldsText(c.fields, before), error }
      case 'delete_catering_item':
        return { kind: 'delete', title: `Xoá hạng mục ${GROUP_LABEL[c.group]} ${SIDE_LABEL[c.side]} #${c.stt} ${c.current_name}`, detail: '', error }
      case 'update_catering_setting': {
        const s = data.cateringSettings.find((x) => x.side === c.side) as unknown as Record<string, unknown>
        return { kind: 'update', title: `Khẩu phần ${SIDE_LABEL[c.side]}`, detail: fieldsText(c.fields, s) }
      }
    }
  })
}

/**
 * Áp dụng các thay đổi vào dữ liệu (qua các hàm của store → tự lưu lên server như khi người dùng sửa).
 * Tìm hết các dòng TRƯỚC khi sửa để STT không bị lệch khi có thao tác xoá.
 */
export function applyChanges(changes: Change[]): { applied: number; errors: string[] } {
  const store = useAppStore.getState()
  const data = store.data
  const errors: string[] = []
  const plan: (() => void)[] = []

  for (const c of changes) {
    const t = findTarget(data, c)
    if (typeof t === 'string') {
      errors.push(t)
      continue
    }
    const id = t?.row.id ?? ''
    switch (c.action) {
      case 'add_guest':
        plan.push(() => store.addGuest(c.side, c.fields))
        break
      case 'update_guest':
        plan.push(() => store.updateGuest(id, c.fields))
        break
      case 'delete_guest':
        plan.push(() => store.deleteGuest(id))
        break
      case 'add_task':
        plan.push(() => store.addTask(c.fields))
        break
      case 'update_task':
        plan.push(() => store.updateTask(id, c.fields))
        break
      case 'delete_task':
        plan.push(() => store.deleteTask(id))
        break
      case 'add_catering_item':
        plan.push(() => store.addItem(c.side, { ...c.fields, group: c.group }))
        break
      case 'update_catering_item':
        plan.push(() => store.updateItem(id, c.fields))
        break
      case 'delete_catering_item':
        plan.push(() => store.deleteItem(id))
        break
      case 'update_catering_setting':
        plan.push(() => store.updateSetting(c.side, c.fields))
        break
    }
  }
  for (const run of plan) run()
  return { applied: plan.length, errors }
}
