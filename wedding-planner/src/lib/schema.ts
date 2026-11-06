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
})

const item = z.object({
  id: z.string().optional(),
  side: guestSide,
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

/** Dữ liệu lưu trong localStorage: bắt buộc đủ id + schemaVersion = 1. */
export const storedSchema = importSchema.extend({
  schemaVersion: z.literal(1),
  guests: z.array(guest.extend({ id: z.string() })),
  cateringItems: z.array(item.extend({ id: z.string() })),
  tasks: z.array(task.extend({ id: z.string() })),
  updatedAt: z.string(),
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
  const settings = (['TRAI', 'GAI'] as const).map(
    (side) => input.cateringSettings.find((s) => s.side === side) ?? { side, peoplePerTable: 10 },
  )
  return {
    schemaVersion: 1,
    cateringSettings: settings,
    cateringItems: reorder(input.cateringItems.map((x) => ({ ...x, id: x.id ?? uid() })), (x) => x.side),
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
