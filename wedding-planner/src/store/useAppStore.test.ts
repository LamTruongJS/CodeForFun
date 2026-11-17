import { beforeEach, describe, expect, it } from 'vitest'
import { loadSeed, useAppStore } from './useAppStore'

const items = (group: 'TIEC' | 'NHOM_HO') =>
  useAppStore
    .getState()
    .data.cateringItems.filter((i) => i.side === 'TRAI' && i.group === group)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => `${i.sortOrder}:${i.name}`)

describe('hạng mục nhóm họ', () => {
  beforeEach(() => useAppStore.setState({ data: loadSeed() }))

  it('thêm vào nhóm họ không ảnh hưởng tiệc cưới, sortOrder đánh riêng', () => {
    const before = items('TIEC')
    const { addItem } = useAppStore.getState()
    addItem('TRAI', { name: 'Bia', group: 'NHOM_HO' })
    addItem('TRAI', { name: 'Nước ngọt', group: 'NHOM_HO' })
    addItem('TRAI', { name: 'Nước suối', group: 'NHOM_HO' })
    expect(items('NHOM_HO')).toEqual(['1:Bia', '2:Nước ngọt', '3:Nước suối'])
    expect(items('TIEC')).toEqual(before)
  })

  it('kéo thả và xóa chỉ đánh lại thứ tự trong cùng nhóm', () => {
    const s = useAppStore.getState()
    for (const name of ['Bia', 'Nước ngọt', 'Nước suối']) s.addItem('TRAI', { name, group: 'NHOM_HO' })
    const id = (n: string) => useAppStore.getState().data.cateringItems.find((i) => i.name === n && i.group === 'NHOM_HO')!.id
    const before = items('TIEC')
    useAppStore.getState().reorderItem(id('Nước suối'), id('Bia'))
    expect(items('NHOM_HO')).toEqual(['1:Nước suối', '2:Bia', '3:Nước ngọt'])
    useAppStore.getState().deleteItem(id('Bia'))
    expect(items('NHOM_HO')).toEqual(['1:Nước suối', '2:Nước ngọt'])
    expect(items('TIEC')).toEqual(before)
  })

  it('hạng mục không ghi nhóm thì mặc định là tiệc cưới', () => {
    useAppStore.getState().addItem('TRAI', { name: 'Trái cây' })
    expect(items('TIEC').at(-1)).toMatch(/Trái cây$/)
  })
})
