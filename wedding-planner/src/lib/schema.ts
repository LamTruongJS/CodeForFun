import { z } from 'zod'
import type { AppData } from './types'

const guestSide = z.enum(['TRAI', 'GAI'])
const money = z.number().int().nonnegative().nullable().default(null)
const nstr = z.string().nullable().default(null)
const name = z.string().trim().min(1, 'Tên không được để trống')

const guest = z.object({
  id: z.string().optional(),
  side: guestSide,
  sortOrder: z.number(),
  name,
  address: nstr,
  attendees: z.number().int().nonnegative().default(1),
  expectedGift: money,
  actualGift: money,
  note: nstr,
})

const setting = z.object({
  side: guestSide,
  peoplePerTable: z.number().int().nonnegative().default(10),
  relativeTables: z.number().int().nonnegative().default(0),
  nhomHoTables: z.number().int().nonnegative().default(0),
  // Trường cũ (bản trước: nhóm họ chỉ có ăn + nước) — đọc để chuyển thành hạng mục
  nhomHoPricePerTable: z.number().nullable().optional(),
  nhomHoDrinkQty: z.number().nullable().optional(),
  nhomHoDrinkPrice: z.number().nullable().optional(),
})

const item = z.object({
  id: z.string().optional(),
  side: guestSide,
  group: z.enum(['TIEC', 'NHOM_HO']).default('TIEC'),
  sortOrder: z.number(),
  name,
  unit: nstr,
  unitPrice: money,
  quantityMode: z.enum(['MANUAL', 'AUTO_TABLES']).default('MANUAL'),
  quantity: money,
})

const task = z.object({
  id: z.string().optional(),
  sortOrder: z.number(),
  name,
  amount: money,
  deposit: money,
  side: z.enum(['TRAI', 'GAI', 'CHUNG']).nullable().default(null),
  status: z.enum(['DANG_LAM', 'DA_LAM']).nullable().default(null),
  note: nstr,
})

/** Chấp nhận cả file seed gốc (không id, không schemaVersion) lẫn file đã xuất. */
export const importSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  cateringSettings: z.array(setting),
  cateringItems: z.array(item),
  guests: z.array(guest),
  tasks: z.array(task),
  updatedAt: z.string().optional(),
})

export function formatZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 5)
    .map((i) => `• ${i.path.join('.') || '(gốc)'}: ${i.message}`)
    .join('\n')
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

/** Chuẩn hóa: sinh id còn thiếu, đánh lại sortOrder, đảm bảo đủ 2 nhà trong cateringSettings. */
export function normalize(input: z.infer<typeof importSchema>): AppData {
  const reorder = <T extends { sortOrder: number }>(list: T[], key?: (x: T) => string) => {
    const groups = new Map<string, T[]>()
    for (const x of list) {
      const k = key ? key(x) : ''
      groups.set(k, [...(groups.get(k) ?? []), x])
    }
    return [...groups.values()].flatMap((g) =>
      [...g].sort((a, b) => a.sortOrder - b.sortOrder).map((x, i) => ({ ...x, sortOrder: i + 1 })),
    )
  }
  const items = input.cateringItems.map((x) => ({ ...x, id: x.id ?? uid() }))
  const settings = (['TRAI', 'GAI'] as const).map((side) => {
    const s = input.cateringSettings.find((x) => x.side === side)
    // Chuyển nhóm họ kiểu cũ (đơn giá 1 bàn / nước uống) thành hạng mục, nếu chưa có hạng mục nhóm họ nào
    if (s && !items.some((i) => i.side === side && i.group === 'NHOM_HO')) {
      if (s.nhomHoPricePerTable) {
        items.push({ id: uid(), side, group: 'NHOM_HO', sortOrder: 1, name: 'Thức ăn', unit: 'Bàn', unitPrice: s.nhomHoPricePerTable, quantityMode: 'AUTO_TABLES', quantity: null })
      }
      if (s.nhomHoDrinkQty || s.nhomHoDrinkPrice) {
        items.push({ id: uid(), side, group: 'NHOM_HO', sortOrder: 2, name: 'Nước uống', unit: null, unitPrice: s.nhomHoDrinkPrice ?? null, quantityMode: 'MANUAL', quantity: s.nhomHoDrinkQty ?? null })
      }
    }
    return { side, peoplePerTable: s?.peoplePerTable ?? 10, relativeTables: s?.relativeTables ?? 0, nhomHoTables: s?.nhomHoTables ?? 0 }
  })
  return {
    schemaVersion: 1,
    cateringSettings: settings,
    cateringItems: reorder(items, (x) => `${x.side}:${x.group}`),
    guests: reorder(input.guests.map((x) => ({ ...x, id: x.id ?? uid() })), (x) => x.side),
    tasks: reorder(input.tasks.map((x) => ({ ...x, id: x.id ?? uid() }))),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
}

export function parseImport(raw: unknown): { ok: true; data: AppData } | { ok: false; error: string } {
  const r = importSchema.safeParse(raw)
  if (!r.success) return { ok: false, error: formatZodError(r.error) }
  return { ok: true, data: normalize(r.data) }
}

export { uid }
