import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import { arrayMove } from '@dnd-kit/sortable'
import seedRaw from '../data/seed-data.json'
import { formatZodError, parseImport, storedSchema, uid } from '../lib/schema'
import type { AppData, CateringItem, Guest, GuestSide, Task } from '../lib/types'

export const DATA_KEY = 'wedding-planner:data'

export function loadSeed(): AppData {
  const r = parseImport(seedRaw)
  if (!r.ok) throw new Error('seed-data.json không hợp lệ:\n' + r.error)
  return r.data
}

/** Lỗi khi đọc localStorage (dữ liệu hỏng / sai phiên bản). */
export let storageLoadError: string | null = null

type State = { data: AppData }

/** Lưu thẳng AppData (có schemaVersion) vào localStorage, kiểm tra zod khi đọc. */
const storage: PersistStorage<State> = {
  getItem: (name) => {
    const raw = localStorage.getItem(name)
    if (raw == null) return null
    try {
      const json = JSON.parse(raw)
      if (json?.schemaVersion !== 1) {
        storageLoadError = `Phiên bản dữ liệu không khớp (schemaVersion = ${json?.schemaVersion ?? 'trống'}).`
        return null
      }
      const r = storedSchema.safeParse(json)
      if (!r.success) {
        storageLoadError = 'Dữ liệu lưu trong trình duyệt bị lỗi:\n' + formatZodError(r.error)
        return null
      }
      return { state: { data: r.data as AppData }, version: 1 }
    } catch {
      storageLoadError = 'Dữ liệu lưu trong trình duyệt không phải JSON hợp lệ.'
      return null
    }
  },
  setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value.state.data)),
  removeItem: (name) => localStorage.removeItem(name),
}

type Actions = {
  // khách mời
  addGuest: (side: GuestSide, patch: Partial<Guest> & { name: string }) => void
  updateGuest: (id: string, patch: Partial<Guest>) => void
  deleteGuest: (id: string) => void
  reorderGuest: (side: GuestSide, activeId: string, overId: string) => void
  // khẩu phần
  setPeoplePerTable: (side: GuestSide, value: number) => void
  addItem: (side: GuestSide, patch: Partial<CateringItem> & { name: string }) => void
  updateItem: (id: string, patch: Partial<CateringItem>) => void
  deleteItem: (id: string) => void
  reorderItem: (side: GuestSide, activeId: string, overId: string) => void
  // công việc
  addTask: (patch: Partial<Task> & { name: string }) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  reorderTask: (activeId: string, overId: string) => void
  // dữ liệu
  replaceData: (data: AppData) => void
  resetToSeed: () => void
}

/** Đổi thứ tự trong 1 nhóm, đánh lại sortOrder 1..n cho nhóm đó. */
function reorder<T extends { id: string; sortOrder: number }>(
  list: T[],
  inGroup: (x: T) => boolean,
  activeId: string,
  overId: string,
): T[] {
  const group = list.filter(inGroup).sort((a, b) => a.sortOrder - b.sortOrder)
  const from = group.findIndex((x) => x.id === activeId)
  const to = group.findIndex((x) => x.id === overId)
  if (from < 0 || to < 0 || from === to) return list
  const order = new Map(arrayMove(group, from, to).map((x, i) => [x.id, i + 1]))
  return list.map((x) => (order.has(x.id) ? { ...x, sortOrder: order.get(x.id)! } : x))
}

const renumber = <T extends { sortOrder: number }>(list: T[]) =>
  [...list].sort((a, b) => a.sortOrder - b.sortOrder).map((x, i) => ({ ...x, sortOrder: i + 1 }))

const nextOrder = (list: { sortOrder: number }[]) => list.reduce((m, x) => Math.max(m, x.sortOrder), 0) + 1

export const useAppStore = create<State & Actions>()(
  persist(
    (set) => {
      const mut = (fn: (d: AppData) => Partial<AppData>) =>
        set((s) => ({ data: { ...s.data, ...fn(s.data), updatedAt: new Date().toISOString() } }))

      return {
        data: loadSeed(),

        addGuest: (side, patch) =>
          mut((d) => ({
            guests: [
              ...d.guests,
              {
                id: uid(),
                side,
                sortOrder: nextOrder(d.guests.filter((g) => g.side === side)),
                address: null,
                attendees: 1,
                expectedGift: null,
                actualGift: null,
                note: null,
                ...patch,
              },
            ],
          })),
        updateGuest: (id, patch) => mut((d) => ({ guests: d.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
        deleteGuest: (id) =>
          mut((d) => {
            const target = d.guests.find((g) => g.id === id)
            const rest = d.guests.filter((g) => g.id !== id)
            if (!target) return {}
            return {
              guests: [...rest.filter((g) => g.side !== target.side), ...renumber(rest.filter((g) => g.side === target.side))],
            }
          }),
        reorderGuest: (side, a, o) => mut((d) => ({ guests: reorder(d.guests, (g) => g.side === side, a, o) })),

        setPeoplePerTable: (side, value) =>
          mut((d) => ({
            cateringSettings: d.cateringSettings.map((s) => (s.side === side ? { ...s, peoplePerTable: value } : s)),
          })),
        addItem: (side, patch) =>
          mut((d) => ({
            cateringItems: [
              ...d.cateringItems,
              {
                id: uid(),
                side,
                sortOrder: nextOrder(d.cateringItems.filter((i) => i.side === side)),
                unit: null,
                unitPrice: null,
                quantityMode: 'MANUAL',
                quantity: null,
                ...patch,
              },
            ],
          })),
        updateItem: (id, patch) =>
          mut((d) => ({ cateringItems: d.cateringItems.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
        deleteItem: (id) =>
          mut((d) => {
            const target = d.cateringItems.find((i) => i.id === id)
            const rest = d.cateringItems.filter((i) => i.id !== id)
            if (!target) return {}
            return {
              cateringItems: [
                ...rest.filter((i) => i.side !== target.side),
                ...renumber(rest.filter((i) => i.side === target.side)),
              ],
            }
          }),
        reorderItem: (side, a, o) =>
          mut((d) => ({ cateringItems: reorder(d.cateringItems, (i) => i.side === side, a, o) })),

        addTask: (patch) =>
          mut((d) => ({
            tasks: [
              ...d.tasks,
              {
                id: uid(),
                sortOrder: nextOrder(d.tasks),
                amount: null,
                deposit: null,
                side: null,
                status: null,
                note: null,
                ...patch,
              },
            ],
          })),
        updateTask: (id, patch) => mut((d) => ({ tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
        deleteTask: (id) => mut((d) => ({ tasks: renumber(d.tasks.filter((t) => t.id !== id)) })),
        reorderTask: (a, o) => mut((d) => ({ tasks: reorder(d.tasks, () => true, a, o) })),

        replaceData: (data) => set({ data: { ...data, updatedAt: new Date().toISOString() } }),
        resetToSeed: () => {
          storageLoadError = null
          set({ data: loadSeed() })
        },
      }
    },
    {
      name: DATA_KEY,
      storage,
      version: 1,
      partialize: (s) => ({ data: s.data }) as State,
    },
  ),
)

// Lần đầu mở web: chưa có dữ liệu → ghi seed (đã sinh id) vào localStorage.
if (typeof window !== 'undefined' && localStorage.getItem(DATA_KEY) == null) {
  localStorage.setItem(DATA_KEY, JSON.stringify(useAppStore.getState().data))
}
