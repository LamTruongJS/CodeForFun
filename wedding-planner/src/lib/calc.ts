import type { AppData, CateringItem, Guest, GuestSide, Task } from './types'

const n = (v: number | null | undefined) => v ?? 0

export const bySortOrder = <T extends { sortOrder: number }>(list: T[]) =>
  [...list].sort((a, b) => a.sortOrder - b.sortOrder)

// 6.1 Khách mời
export function guestTotals(guests: Guest[], side: GuestSide) {
  const list = guests.filter((g) => g.side === side)
  return {
    count: list.length,
    attendees: list.reduce((s, g) => s + n(g.attendees), 0),
    expected: list.reduce((s, g) => s + n(g.expectedGift), 0),
    actual: list.reduce((s, g) => s + n(g.actualGift), 0),
  }
}

// 6.2 Khẩu phần ăn
export function tablesFor(people: number, peoplePerTable: number) {
  return peoplePerTable <= 0 ? 0 : Math.ceil(people / peoplePerTable)
}

export function itemQuantity(item: Pick<CateringItem, 'quantityMode' | 'quantity'>, tables: number) {
  return item.quantityMode === 'AUTO_TABLES' ? tables : n(item.quantity)
}

export function itemTotal(item: Pick<CateringItem, 'quantityMode' | 'quantity' | 'unitPrice'>, tables: number) {
  return n(item.unitPrice) * itemQuantity(item, tables)
}

export function cateringForSide(
  data: Pick<AppData, 'guests' | 'cateringItems' | 'cateringSettings'>,
  side: GuestSide,
) {
  const people = guestTotals(data.guests, side).attendees
  const peoplePerTable = data.cateringSettings.find((s) => s.side === side)?.peoplePerTable ?? 10
  const tables = tablesFor(people, peoplePerTable)
  const items = bySortOrder(data.cateringItems.filter((i) => i.side === side)).map((item) => ({
    item,
    quantity: itemQuantity(item, tables),
    total: itemTotal(item, tables),
  }))
  return { people, peoplePerTable, tables, items, total: items.reduce((s, x) => s + x.total, 0) }
}

// 6.3 Công việc
export const taskRemaining = (t: Pick<Task, 'amount' | 'deposit'>) => n(t.amount) - n(t.deposit)

export function taskTotals(tasks: Pick<Task, 'amount' | 'deposit'>[]) {
  return {
    amount: tasks.reduce((s, t) => s + n(t.amount), 0),
    deposit: tasks.reduce((s, t) => s + n(t.deposit), 0),
    remaining: tasks.reduce((s, t) => s + taskRemaining(t), 0),
  }
}

// 6.4 Chi phí công việc chia theo nhà
export function taskCostBySide(tasks: Pick<Task, 'amount' | 'side'>[]) {
  const sum = (side: Task['side']) =>
    tasks.filter((t) => t.side === side).reduce((s, t) => s + n(t.amount), 0)
  const half = Math.round(sum('CHUNG') / 2)
  return {
    TRAI: sum('TRAI') + half,
    GAI: sum('GAI') + half,
    unassignedCount: tasks.filter((t) => t.side === null && n(t.amount) > 0).length,
  }
}

// 6.5 Tổng hợp
export type SummaryRow = {
  stt: number
  label: string
  TRAI: number
  GAI: number
  total: number
  kind: 'count' | 'money'
  highlight?: boolean
  negativeRed?: boolean
}

export function summary(data: AppData): SummaryRow[] {
  const g = { TRAI: guestTotals(data.guests, 'TRAI'), GAI: guestTotals(data.guests, 'GAI') }
  const c = { TRAI: cateringForSide(data, 'TRAI'), GAI: cateringForSide(data, 'GAI') }
  const t = taskCostBySide(data.tasks)
  const row = (
    stt: number,
    label: string,
    f: (s: GuestSide) => number,
    kind: SummaryRow['kind'],
    extra: Partial<SummaryRow> = {},
  ): SummaryRow => {
    const a = f('TRAI')
    const b = f('GAI')
    return { stt, label, TRAI: a, GAI: b, total: a + b, kind, ...extra }
  }
  const cost = (s: GuestSide) => c[s].total + t[s]
  return [
    row(1, 'Số lượt mời', (s) => g[s].count, 'count'),
    row(2, 'Số lượng khách đi', (s) => g[s].attendees, 'count'),
    row(3, 'Tiền mừng dự kiến (VNĐ)', (s) => g[s].expected, 'money'),
    row(4, 'Tiền mừng thực tế (VNĐ)', (s) => g[s].actual, 'money'),
    row(5, 'Chênh lệch thực tế so với dự kiến (VNĐ)', (s) => g[s].actual - g[s].expected, 'money', {
      negativeRed: true,
    }),
    row(6, 'Số bàn dự kiến', (s) => c[s].tables, 'count'),
    row(7, 'Chi phí khẩu phần ăn (VNĐ)', (s) => c[s].total, 'money'),
    row(8, 'Chi phí công việc (VNĐ, phần chung chia đôi)', (s) => t[s], 'money'),
    row(9, 'Tổng chi phí (VNĐ)', cost, 'money', { highlight: true }),
    row(10, 'Tiền mừng thực tế trừ tổng chi phí (VNĐ)', (s) => g[s].actual - cost(s), 'money', {
      highlight: true,
      negativeRed: true,
    }),
  ]
}
