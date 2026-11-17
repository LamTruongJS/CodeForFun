export type GuestSide = 'TRAI' | 'GAI'
export type TaskSide = 'TRAI' | 'GAI' | 'CHUNG' | null
export type TaskStatus = 'DANG_LAM' | 'DA_LAM' | null
export type QuantityMode = 'MANUAL' | 'AUTO_TABLES'

export type Guest = {
  id: string
  side: GuestSide
  sortOrder: number
  name: string
  address: string | null
  attendees: number
  expectedGift: number | null
  actualGift: number | null
  note: string | null
}

export type CateringSetting = {
  side: GuestSide
  peoplePerTable: number
  /** Bàn phát sinh cho họ hàng / khách đi kèm, cộng thêm vào số bàn tiệc cưới */
  relativeTables: number
  /** Số bàn nhóm họ (các hạng mục nhóm họ "theo số bàn" lấy số này) */
  nhomHoTables: number
}

/** TIEC = tiệc cưới, NHOM_HO = bữa nhóm họ */
export type CateringGroup = 'TIEC' | 'NHOM_HO'

export type CateringItem = {
  id: string
  side: GuestSide
  group: CateringGroup
  sortOrder: number
  name: string
  unit: string | null
  unitPrice: number | null
  quantityMode: QuantityMode
  quantity: number | null
}

export type Task = {
  id: string
  sortOrder: number
  name: string
  amount: number | null
  deposit: number | null
  side: TaskSide
  status: TaskStatus
  note: string | null
}

export type AppData = {
  schemaVersion: 1
  cateringSettings: CateringSetting[]
  cateringItems: CateringItem[]
  guests: Guest[]
  tasks: Task[]
  updatedAt: string
}

export const SIDE_LABEL: Record<GuestSide, string> = { TRAI: 'Nhà Trai', GAI: 'Nhà Gái' }
