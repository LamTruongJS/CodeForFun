import { describe, expect, it } from 'vitest'
import seed from '../data/seed-data.json'
import {
  cateringForSide,
  guestTotals,
  itemQuantity,
  itemTotal,
  summary,
  tablesFor,
  taskCostBySide,
  taskRemaining,
  taskTotals,
} from './calc'
import { formatTyping, parseIntInput } from './format'
import { parseImport } from './schema'
import type { AppData, Guest, Task } from './types'

const load = (): AppData => {
  const r = parseImport(seed)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

const guest = (p: Partial<Guest>): Guest => ({
  id: Math.random().toString(),
  side: 'GAI',
  sortOrder: 999,
  name: 'Khách',
  address: null,
  attendees: 1,
  expectedGift: null,
  actualGift: null,
  note: null,
  ...p,
})

const task = (p: Partial<Task>): Task => ({
  id: Math.random().toString(),
  sortOrder: 1,
  name: 'Việc',
  amount: null,
  deposit: null,
  side: null,
  status: null,
  note: null,
  ...p,
})

describe('dữ liệu seed (mục 10)', () => {
  const d = load()
  it('Nhà Trai 0 khách', () => expect(guestTotals(d.guests, 'TRAI').count).toBe(0))
  it('Nhà Gái 78 thiệp mời, 81 người đi, 9 bàn', () => {
    const g = guestTotals(d.guests, 'GAI')
    expect(g.count).toBe(78)
    expect(g.attendees).toBe(81)
    expect(cateringForSide(d, 'GAI').tables).toBe(9)
  })
  it('Công việc: 18 việc, 38.200.000 / 19.000.000 / 19.200.000', () => {
    expect(d.tasks).toHaveLength(18)
    expect(taskTotals(d.tasks)).toEqual({ amount: 38_200_000, deposit: 19_000_000, remaining: 19_200_000 })
  })
  it('Đơn giá Thức ăn Nhà Trai = 2.200.000', () => {
    expect(d.cateringItems.find((i) => i.side === 'TRAI' && i.name === 'Thức ăn')?.unitPrice).toBe(2_200_000)
  })
  it('sinh id cho mọi bản ghi', () => {
    expect(d.guests.every((g) => g.id)).toBe(true)
    expect(d.schemaVersion).toBe(1)
  })
})

describe('6.1 khách mời', () => {
  it('cộng dồn, null = 0', () => {
    const gs = [guest({ attendees: 2, expectedGift: 500_000 }), guest({ attendees: 0, actualGift: 300_000 }), guest({ side: 'TRAI', attendees: 5 })]
    expect(guestTotals(gs, 'GAI')).toEqual({ count: 2, attendees: 2, expected: 500_000, actual: 300_000 })
  })
})

describe('6.2 khẩu phần', () => {
  it('số bàn = CEIL(khách / người mỗi bàn)', () => {
    expect(tablesFor(81, 10)).toBe(9)
    expect(tablesFor(80, 10)).toBe(8)
    expect(tablesFor(0, 10)).toBe(0)
    expect(tablesFor(50, 0)).toBe(0)
  })
  it('AUTO_TABLES lấy số bàn, MANUAL lấy quantity', () => {
    expect(itemQuantity({ quantityMode: 'AUTO_TABLES', quantity: 3 }, 9)).toBe(9)
    expect(itemQuantity({ quantityMode: 'MANUAL', quantity: 3 }, 9)).toBe(3)
    expect(itemQuantity({ quantityMode: 'MANUAL', quantity: null }, 9)).toBe(0)
    expect(itemTotal({ quantityMode: 'MANUAL', quantity: 4, unitPrice: 250_000 }, 9)).toBe(1_000_000)
    expect(itemTotal({ quantityMode: 'MANUAL', quantity: 4, unitPrice: null }, 9)).toBe(0)
  })
})

describe('tiêu chí 4: thêm khách Nhà Gái 3 người', () => {
  it('tổng, số bàn và Tổng hợp cập nhật', () => {
    const d = load()
    const d2 = { ...d, guests: [...d.guests, guest({ attendees: 3 })] }
    expect(guestTotals(d2.guests, 'GAI').attendees).toBe(84)
    expect(cateringForSide(d2, 'GAI').people).toBe(84)
    expect(cateringForSide(d2, 'GAI').tables).toBe(9)
    const s = summary(d2)
    expect(s[0].GAI).toBe(79)
    expect(s[1].GAI).toBe(84)
    // thêm 7 người nữa → 91 người → 10 bàn
    const d3 = { ...d2, guests: [...d2.guests, guest({ attendees: 7 })] }
    expect(summary(d3)[5].GAI).toBe(10)
  })
})

describe('tiêu chí 5: đổi số người / bàn', () => {
  it('số bàn và thành tiền AUTO_TABLES đổi theo', () => {
    const d = load()
    const withPrice = {
      ...d,
      cateringItems: d.cateringItems.map((i) => (i.side === 'GAI' && i.name === 'Thức ăn' ? { ...i, unitPrice: 1_000_000 } : i)),
    }
    expect(cateringForSide(withPrice, 'GAI').total).toBe(9_000_000)
    const d2 = { ...withPrice, cateringSettings: withPrice.cateringSettings.map((s) => (s.side === 'GAI' ? { ...s, peoplePerTable: 8 } : s)) }
    const c = cateringForSide(d2, 'GAI')
    expect(c.tables).toBe(11) // CEIL(81/8)
    expect(c.total).toBe(11_000_000)
  })
})

describe('6.3 / tiêu chí 6: còn lại', () => {
  it('1.000 − 400 = 600', () => expect(taskRemaining({ amount: 1000, deposit: 400 })).toBe(600))
  it('null = 0', () => expect(taskRemaining({ amount: null, deposit: 500 })).toBe(-500))
})

describe('6.4 / tiêu chí 7: chia chi phí theo nhà', () => {
  it('1.000 chung + 500 họ gái → Trai 500, Gái 1.000', () => {
    const r = taskCostBySide([task({ amount: 1000, side: 'CHUNG' }), task({ amount: 500, side: 'GAI' })])
    expect(r.TRAI).toBe(500)
    expect(r.GAI).toBe(1000)
  })
  it('không tính việc chưa chọn bên, và đếm cảnh báo', () => {
    const r = taskCostBySide([task({ amount: 1000, side: null }), task({ amount: null, side: null }), task({ amount: 200, side: 'TRAI' })])
    expect(r).toEqual({ TRAI: 200, GAI: 0, unassignedCount: 1 })
  })
  it('làm tròn phần chia đôi', () => {
    expect(taskCostBySide([task({ amount: 1001, side: 'CHUNG' })]).TRAI).toBe(501)
  })
  it('seed: Trai 21.400.000 + 1.400.000, Gái …', () => {
    const r = taskCostBySide(load().tasks)
    // CHUNG = 3.000.000 + 3.800.000 + 7.000.000 + 8.100.000 = 21.900.000 → 10.950.000 mỗi bên
    expect(r.TRAI).toBe(10_000_000 + 1_400_000 + 10_950_000)
    expect(r.GAI).toBe(3_300_000 + 1_600_000 + 10_950_000)
  })
})

describe('6.5 tổng hợp', () => {
  it('cột Tổng cộng = Trai + Gái; hàng 9 = 7 + 8; hàng 10 = 4 − 9', () => {
    const s = summary(load())
    for (const r of s) expect(r.total).toBe(r.TRAI + r.GAI)
    expect(s[8].TRAI).toBe(s[6].TRAI + s[7].TRAI)
    expect(s[9].GAI).toBe(s[3].GAI - s[8].GAI)
    expect(s[6].TRAI).toBe(0) // Nhà Trai 0 khách → 0 bàn
  })
})

describe('parseIntInput (tiêu chí 10)', () => {
  it('từ chối chữ và số âm', () => {
    expect(parseIntInput('abc').ok).toBe(false)
    expect(parseIntInput('-5').ok).toBe(false)
    expect(parseIntInput('1,5').ok).toBe(false)
  })
  it('chấp nhận số có dấu chấm ngăn cách', () => {
    expect(parseIntInput('3.800.000')).toEqual({ ok: true, value: 3_800_000 })
    expect(parseIntInput('')).toEqual({ ok: true, value: null })
  })
})

describe('nhập JSON (tiêu chí 13)', () => {
  it('báo lỗi khi sai cấu trúc', () => {
    expect(parseImport({ guests: 'x' }).ok).toBe(false)
    expect(parseImport({ ...seed, guests: [{ side: 'X', sortOrder: 1, name: 'a', attendees: 1 }] }).ok).toBe(false)
  })
  it('xuất rồi nhập lại giữ nguyên dữ liệu', () => {
    const d = load()
    const r = parseImport(JSON.parse(JSON.stringify(d)))
    expect(r.ok && r.data).toEqual(d)
  })
})

describe('formatTyping — thêm dấu chấm khi đang gõ', () => {
  it('5000000 → 5.000.000, con trỏ ở cuối', () => {
    expect(formatTyping('5000000')).toEqual({ value: '5.000.000', caret: 9 })
  })
  it('gõ thêm số vào cuối chuỗi đã có dấu chấm', () => {
    expect(formatTyping('5.000.0000')).toEqual({ value: '50.000.000', caret: 10 })
  })
  it('số nhỏ không thêm dấu', () => {
    expect(formatTyping('999').value).toBe('999')
    expect(formatTyping('1000').value).toBe('1.000')
  })
  it('giữ vị trí con trỏ khi sửa ở giữa', () => {
    // "1.000|.000" gõ thêm "5" sau chữ số thứ 4 → "10.005.000", con trỏ sau chữ số thứ 5
    const r = formatTyping('1.0005.000', 6)
    expect(r.value).toBe('10.005.000')
    expect(r.value.slice(0, r.caret).replace(/\D/g, '')).toBe('10005')
  })
  it('xóa hết → chuỗi rỗng; bỏ số 0 thừa ở đầu', () => {
    expect(formatTyping('').value).toBe('')
    expect(formatTyping('0').value).toBe('0')
    expect(formatTyping('0050000').value).toBe('50.000')
  })
  it('có chữ hoặc dấu âm → giữ nguyên để báo lỗi', () => {
    expect(formatTyping('12a').value).toBe('12a')
    expect(formatTyping('-500').value).toBe('-500')
    expect(parseIntInput(formatTyping('-500').value).ok).toBe(false)
  })
  it('kết quả định dạng đọc lại đúng số', () => {
    expect(parseIntInput(formatTyping('38200000').value)).toEqual({ ok: true, value: 38_200_000 })
  })
})
