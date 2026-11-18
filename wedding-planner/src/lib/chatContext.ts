import { bySortOrder, cateringForSide, guestTotals, summary, taskCostBySide, taskRemaining } from './calc'
import { fmtMoney } from './format'
import type { AppData, GuestSide } from './types'

const SIDE: Record<GuestSide, string> = { TRAI: 'Nhà Trai', GAI: 'Nhà Gái' }
const TASK_SIDE = { TRAI: 'Họ trai', GAI: 'Họ gái', CHUNG: 'Họ trai và gái (chia đôi)' } as const
const STATUS = { DANG_LAM: 'Đang làm', DA_LAM: 'Đã làm' } as const

const money = (v: number | null | undefined) => (v ? `${fmtMoney(v)} đ` : '0 đ')

/**
 * Dữ liệu kế hoạch dạng văn bản gọn để gửi cho trợ lý Claude.
 * Có sẵn các con số đã tính (tổng hợp, số bàn, thành tiền) để Claude không phải tự cộng.
 */
export function buildChatContext(data: AppData): string {
  const L: string[] = []

  L.push('## TỔNG HỢP (đã tính sẵn)')
  for (const r of summary(data)) {
    const f = (v: number) => (r.kind === 'count' ? String(v) : v === 0 ? '0 đ' : `${v < 0 ? '-' : ''}${fmtMoney(Math.abs(v))} đ`)
    L.push(`- ${r.label}: Nhà Trai ${f(r.TRAI)} | Nhà Gái ${f(r.GAI)} | Tổng ${f(r.total)}`)
  }
  const unassigned = taskCostBySide(data.tasks).unassignedCount
  if (unassigned) L.push(`- Lưu ý: ${unassigned} công việc có số tiền nhưng chưa chọn Bên nên chưa tính vào chi phí.`)

  for (const side of ['TRAI', 'GAI'] as const) {
    const c = cateringForSide(data, side)
    L.push('', `## KHẨU PHẦN ĂN — ${SIDE[side]}`)
    L.push(
      `Số khách ${c.people}, ${c.peoplePerTable} người/bàn → ${c.guestTables} bàn theo khách + ${c.relativeTables} bàn họ hàng = ${c.tables} bàn tiệc cưới.`,
    )
    L.push('Tiệc cưới:')
    for (const x of c.items) {
      const qty = x.item.quantityMode === 'AUTO_TABLES' ? `${x.quantity} (theo số bàn)` : String(x.quantity)
      L.push(`- ${x.item.name}${x.item.unit ? ` (${x.item.unit})` : ''}: đơn giá ${money(x.item.unitPrice)} × ${qty} = ${money(x.total)}`)
    }
    L.push(`Cộng tiệc cưới: ${money(c.itemsTotal)}`)
    L.push(`Nhóm họ: ${c.nhomHo.tables} bàn`)
    if (c.nhomHo.items.length === 0) L.push('- (chưa có hạng mục)')
    for (const x of c.nhomHo.items) {
      const qty = x.item.quantityMode === 'AUTO_TABLES' ? `${x.quantity} (theo số bàn nhóm họ)` : String(x.quantity)
      L.push(`- ${x.item.name}${x.item.unit ? ` (${x.item.unit})` : ''}: đơn giá ${money(x.item.unitPrice)} × ${qty} = ${money(x.total)}`)
    }
    L.push(`Cộng nhóm họ: ${money(c.nhomHo.total)}`, `TỔNG khẩu phần ${SIDE[side]}: ${money(c.total)}`)
  }

  L.push('', '## CÔNG VIỆC')
  for (const t of bySortOrder(data.tasks)) {
    const parts = [
      `${t.sortOrder}. ${t.name}`,
      `số tiền ${money(t.amount)}`,
      `đã cọc ${money(t.deposit)}`,
      `còn lại ${money(taskRemaining(t))}`,
      `bên: ${t.side ? TASK_SIDE[t.side] : 'chưa chọn'}`,
      `tiến độ: ${t.status ? STATUS[t.status] : 'chưa làm'}`,
    ]
    if (t.note) parts.push(`ghi chú: ${t.note}`)
    L.push('- ' + parts.join(' | '))
  }

  for (const side of ['TRAI', 'GAI'] as const) {
    const g = guestTotals(data.guests, side)
    L.push('', `## KHÁCH MỜI — ${SIDE[side]} (${g.count} thiệp, ${g.attendees} người dự kiến đi)`)
    const list = bySortOrder(data.guests.filter((x) => x.side === side))
    if (list.length === 0) L.push('- (chưa có khách)')
    for (const x of list) {
      const parts = [`${x.sortOrder}. ${x.name}`, x.address ?? 'chưa có địa chỉ', `${x.attendees} người`]
      if (x.expectedGift) parts.push(`mừng dự kiến ${money(x.expectedGift)}`)
      if (x.actualGift) parts.push(`mừng thực tế ${money(x.actualGift)}`)
      if (x.note) parts.push(`ghi chú: ${x.note}`)
      L.push('- ' + parts.join(' | '))
    }
  }

  return L.join('\n')
}
