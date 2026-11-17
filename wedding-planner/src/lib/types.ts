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
  /** Nhóm họ: số bàn và đơn giá 1 bàn (nhập tay) */
  nhomHoTables: number
  nhomHoPricePerTable: number | null
  /** Nhóm họ: nước uống = số lượng × đơn giá */
  nhomHoDrinkQty: number
  nhomHoDrinkPrice: number | null
}

export type CateringItem = {
  id: string
  side: GuestSide
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
