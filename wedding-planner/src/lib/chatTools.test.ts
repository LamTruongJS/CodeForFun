import { beforeEach, describe, expect, it } from 'vitest'
import { loadSeed, useAppStore } from '../store/useAppStore'
import { applyChanges, describeChanges, proposalSchema, type Change } from './chatTools'

const gai = () =>
  useAppStore
    .getState()
    .data.guests.filter((g) => g.side === 'GAI')
    .sort((a, b) => a.sortOrder - b.sortOrder)
const nameAt = (n: number) => gai()[n - 1].name

describe('trợ lý sửa dữ liệu', () => {
  beforeEach(() => useAppStore.setState({ data: loadSeed() }))

  it('sửa đúng dòng theo STT + tên hiện tại', () => {
    const changes: Change[] = [{ action: 'update_guest', side: 'GAI', stt: 2, current_name: nameAt(2), fields: { cardWritten: true, attendees: 2 } }]
    const r = applyChanges(changes)
    expect(r).toEqual({ applied: 1, errors: [] })
    expect(gai()[1]).toMatchObject({ cardWritten: true, attendees: 2 })
    expect(gai()[0].cardWritten).toBe(false)
  })

  it('tên không khớp → không sửa, báo lỗi', () => {
    const r = applyChanges([{ action: 'update_guest', side: 'GAI', stt: 2, current_name: 'Người khác', fields: { cardWritten: true } }])
    expect(r.applied).toBe(0)
    expect(r.errors[0]).toMatch(/không phải/)
    expect(gai()[1].cardWritten).toBe(false)
    // thẻ xác nhận cũng hiện lỗi
    expect(describeChanges(useAppStore.getState().data, [{ action: 'delete_guest', side: 'GAI', stt: 999, current_name: 'x' }])[0].error).toMatch(/Không có dòng/)
  })

  it('xoá nhiều dòng một lúc không bị lệch STT', () => {
    const before = gai().length
    const n3 = nameAt(3)
    const n5 = nameAt(5)
    const r = applyChanges([
      { action: 'delete_guest', side: 'GAI', stt: 3, current_name: n3 },
      { action: 'delete_guest', side: 'GAI', stt: 5, current_name: n5 },
    ])
    expect(r).toEqual({ applied: 2, errors: [] })
    const names = gai().map((g) => g.name)
    expect(names).toHaveLength(before - 2)
    expect(names).not.toContain(n3)
    expect(names).not.toContain(n5)
  })

  it('thêm khách, công việc, hạng mục nhóm họ và đổi số bàn', () => {
    applyChanges([
      { action: 'add_guest', side: 'TRAI', fields: { name: 'V/C Anh Test', attendees: 2 } },
      { action: 'add_task', fields: { name: 'Thuê loa đài', amount: 2_000_000, side: 'CHUNG' } },
      { action: 'add_catering_item', side: 'GAI', group: 'NHOM_HO', fields: { name: 'Bia', unit: 'Thùng', unitPrice: 350_000, quantity: 5 } },
      { action: 'update_catering_setting', side: 'GAI', fields: { nhomHoTables: 4 } },
    ])
    const d = useAppStore.getState().data
    expect(d.guests.find((g) => g.name === 'V/C Anh Test')).toMatchObject({ side: 'TRAI', attendees: 2, cardWritten: false })
    expect(d.tasks.find((t) => t.name === 'Thuê loa đài')).toMatchObject({ amount: 2_000_000, side: 'CHUNG' })
    expect(d.cateringItems.find((i) => i.name === 'Bia' && i.group === 'NHOM_HO')).toMatchObject({ side: 'GAI', quantity: 5 })
    expect(d.cateringSettings.find((s) => s.side === 'GAI')?.nhomHoTables).toBe(4)
  })

  it('kiểm tra đầu vào: từ chối hành động lạ / thiếu trường', () => {
    expect(proposalSchema.safeParse({ changes: [{ action: 'drop_table' }] }).success).toBe(false)
    expect(proposalSchema.safeParse({ changes: [{ action: 'update_guest', side: 'GAI', stt: 1, fields: {} }] }).success).toBe(false)
    expect(proposalSchema.safeParse({ changes: [] }).success).toBe(false)
    expect(proposalSchema.safeParse({ changes: [{ action: 'update_task', stt: 1, current_name: 'A', fields: { status: null } }] }).success).toBe(true)
  })
})
