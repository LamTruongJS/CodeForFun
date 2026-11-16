import { create } from 'zustand'
import { arrayMove } from '@dnd-kit/sortable'
import seedRaw from '../data/seed-data.json'
import { parseImport, uid } from '../lib/schema'
import type { AppData, CateringItem, Guest, GuestSide, Task } from '../lib/types'

/** Khóa localStorage của bản cũ (trước khi lưu lên server) — chỉ đọc 1 lần để chuyển dữ liệu lên. */
export const LEGACY_DATA_KEY = 'wedding-planner:data'

export function loadSeed(): AppData {
  const r = parseImport(seedRaw)
  if (!r.ok) throw new Error('seed-data.json không hợp lệ:\n' + r.error)
  return r.data
}

type State = { data: AppData }

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

// Dữ liệu chỉ nằm trong bộ nhớ; store/sync.ts tải từ server và tự lưu lên server sau mỗi thay đổi.
export const useAppStore = create<State & Actions>()(
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
        resetToSeed: () => set({ data: loadSeed() }),
      }
    },
)
