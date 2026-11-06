import { useMemo, useState } from 'react'
import { DeleteBtn, PageTitle, useIsDesktop } from '../components/Common'
import { EditSheet, type FieldDef } from '../components/EditSheet'
import { InlineNumber, InlineText } from '../components/Inline'
import { SortableList, useSortRow } from '../components/Sortable'
import { cateringForSide } from '../lib/calc'
import { fmtInt, fmtMoney } from '../lib/format'
import type { CateringItem, GuestSide } from '../lib/types'
import { confirmDialog, toast } from '../store/ui'
import { useAppStore } from '../store/useAppStore'

const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Hạng mục', type: 'text', required: true, placeholder: 'VD: Bia', half: true },
  { key: 'unit', label: 'Đơn vị tính', type: 'text', placeholder: 'VD: Thùng', half: true },
  { key: 'unitPrice', label: 'Đơn giá', type: 'number', variant: 'money' },
  { key: 'auto', label: 'Tự lấy theo số bàn', type: 'toggle', hint: 'Số lượng = số bàn dự kiến' },
  { key: 'quantity', label: 'Số lượng', type: 'number', disabledWhen: (v) => Boolean(v.auto) },
]

export function CateringPage() {
  return (
    <div>
      <PageTitle>Khẩu phần ăn</PageTitle>
      <div className="grid gap-5 2xl:grid-cols-2">
        <Section side="TRAI" />
        <Section side="GAI" />
      </div>
    </div>
  )
}

type Calc = ReturnType<typeof cateringForSide>['items'][number]

function Section({ side }: { side: GuestSide }) {
  const data = useAppStore((s) => s.data)
  const { setPeoplePerTable, addItem, updateItem, deleteItem, reorderItem } = useAppStore()
  const desktop = useIsDesktop()
  const c = useMemo(() => cateringForSide(data, side), [data, side])
  const [sheet, setSheet] = useState<CateringItem | 'new' | null>(null)
  const label = side === 'TRAI' ? 'NHÀ TRAI' : 'NHÀ GÁI'

  const askDelete = async (it: CateringItem) => {
    if (await confirmDialog({ title: 'Xóa hạng mục?', message: `“${it.name}” sẽ bị xóa.`, okText: 'Xóa', danger: true })) {
      deleteItem(it.id)
      setSheet(null)
    }
  }
  const toggleAuto = (it: CateringItem, auto: boolean) =>
    updateItem(it.id, { quantityMode: auto ? 'AUTO_TABLES' : 'MANUAL' })

  return (
    <section className="overflow-hidden rounded-3xl border border-[#efe5e9] bg-white shadow-[0_2px_12px_-4px_rgba(80,30,45,.12)]">
      <h2 className="bg-gradient-to-r from-[#f8e5ea] via-[#f3d3dc] to-[#f8e5ea] px-4 py-2.5 text-center font-display text-lg font-bold tracking-wide text-wine">{label}</h2>

      <div className="grid grid-cols-3 gap-2 p-3">
        <Stat label="Số khách" value={fmtInt(c.people)} />
        <label className="rounded-2xl border border-[#f1e2bd] bg-[#fffaf0] p-2 text-center">
          <div className="text-[12px] whitespace-nowrap text-gray-500">Người / bàn</div>
          <InlineNumber
            value={c.peoplePerTable}
            required
            className="!px-0 !text-center text-xl font-bold"
            onSave={(v) => setPeoplePerTable(side, v ?? 0)}
          />
        </label>
        <Stat label="Bàn dự kiến" value={fmtInt(c.tables)} />
      </div>

      <SortableList ids={c.items.map((x) => x.item.id)} onMove={(a, o) => reorderItem(side, a, o)}>
        {desktop ? (
          <div className="overflow-x-auto px-3">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-[60px]">STT</th>
                  <th className="min-w-[160px] text-left">Hạng mục</th>
                  <th className="w-20">ĐVT</th>
                  <th className="min-w-[110px]">Đơn giá (VNĐ)</th>
                  <th className="min-w-[190px]">Số lượng</th>
                  <th className="min-w-[110px]">Thành tiền (VNĐ)</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {c.items.map((x, i) => (
                  <ItemRow
                    key={x.item.id}
                    x={x}
                    stt={i + 1}
                    onPatch={(p) => updateItem(x.item.id, p)}
                    onToggle={(a) => toggleAuto(x.item, a)}
                    onDelete={() => askDelete(x.item)}
                  />
                ))}
                <tr className="total">
                  <td colSpan={5}>TỔNG CỘNG {label}</td>
                  <td className="num text-right">{fmtMoney(c.total)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-2 px-3">
            {c.items.map((x, i) => (
              <ItemCard key={x.item.id} x={x} stt={i + 1} onPatch={(p) => updateItem(x.item.id, p)} onToggle={(a) => toggleAuto(x.item, a)} onOpen={() => setSheet(x.item)} />
            ))}
            <div className="flex items-center justify-between rounded-2xl bg-[#fbeef2] px-4 py-3 font-semibold text-wine">
              <span>TỔNG CỘNG {label}</span>
              <span className="num">{fmtMoney(c.total)}</span>
            </div>
          </div>
        )}
      </SortableList>

      <div className="p-3">
        <button onClick={() => setSheet('new')} className="h-11 w-full rounded-2xl border-[1.5px] border-dashed border-[#b9d6a5] font-medium text-[#4d7d2f] transition hover:bg-green-50">
          + Thêm hạng mục
        </button>
      </div>

      {sheet && (
        <EditSheet
          title={sheet === 'new' ? `Thêm hạng mục ${label}` : 'Sửa hạng mục'}
          fields={FIELDS}
          initial={
            sheet === 'new'
              ? { auto: false }
              : { name: sheet.name, unit: sheet.unit, unitPrice: sheet.unitPrice, quantity: sheet.quantity, auto: sheet.quantityMode === 'AUTO_TABLES' }
          }
          onClose={() => setSheet(null)}
          onDelete={sheet === 'new' ? undefined : () => askDelete(sheet)}
          extra={(v) =>
            v.auto ? <div className="text-[13px] text-gray-500">Hiện tại: {c.tables} bàn</div> : null
          }
          onSave={(v) => {
            const patch: Partial<CateringItem> & { name: string } = {
              name: v.name as string,
              unit: v.unit as string | null,
              unitPrice: v.unitPrice as number | null,
              quantityMode: v.auto ? 'AUTO_TABLES' : 'MANUAL',
              ...(v.auto ? {} : { quantity: v.quantity as number | null }),
            }
            if (sheet === 'new') addItem(side, patch)
            else updateItem(sheet.id, patch)
            setSheet(null)
            toast('Đã lưu', 'success')
          }}
        />
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f6f2f3] p-2 text-center">
      <div className="text-[12px] text-gray-500">{label}</div>
      <div className="num py-[6px] text-xl font-bold text-gray-600">{value}</div>
    </div>
  )
}

function AutoSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs whitespace-nowrap text-gray-600" onClick={(e) => e.stopPropagation()} title="Tự lấy theo số bàn">
      <span className={`relative h-5 w-9 rounded-full transition ${on ? 'bg-[#70AD47]' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => onChange(e.target.checked)} />
      Theo số bàn
    </label>
  )
}

type RowProps = {
  x: Calc
  stt: number
  onPatch: (p: Partial<CateringItem>) => void
  onToggle: (auto: boolean) => void
}

function ItemRow({ x, stt, onPatch, onToggle, onDelete }: RowProps & { onDelete: () => void }) {
  const { ref, style, handle } = useSortRow(x.item.id)
  const auto = x.item.quantityMode === 'AUTO_TABLES'
  return (
    <tr ref={ref} style={style}>
      <td>
        <div className="flex items-center gap-0.5 pl-0.5">
          {handle}
          <span className="num w-5 text-center text-gray-600">{stt}</span>
        </div>
      </td>
      <td>
        <InlineText value={x.item.name} required onSave={(v) => onPatch({ name: v! })} />
      </td>
      <td>
        <InlineText value={x.item.unit} onSave={(v) => onPatch({ unit: v })} />
      </td>
      <td className="yellow">
        <InlineNumber value={x.item.unitPrice} onSave={(v) => onPatch({ unitPrice: v })} />
      </td>
      <td className={auto ? 'calc' : 'yellow'}>
        <div className="flex items-center">
          <div className="shrink-0 pl-2">
            <AutoSwitch on={auto} onChange={onToggle} />
          </div>
          <div className="min-w-[70px] flex-1">
            {auto ? (
              <div className="num px-2 py-1.5 text-right">{fmtInt(x.quantity)}</div>
            ) : (
              <InlineNumber value={x.item.quantity} onSave={(v) => onPatch({ quantity: v })} />
            )}
          </div>
        </div>
      </td>
      <td className="calc pad num text-right">{fmtMoney(x.total)}</td>
      <td>
        <DeleteBtn onClick={onDelete} />
      </td>
    </tr>
  )
}

function ItemCard({ x, stt, onPatch, onToggle, onOpen }: RowProps & { onOpen: () => void }) {
  const { ref, style, handle } = useSortRow(x.item.id)
  const auto = x.item.quantityMode === 'AUTO_TABLES'
  return (
    <div ref={ref} style={style} className="rounded-2xl border border-[#efe5e9] bg-white p-3 shadow-[0_1px_3px_rgba(80,30,45,.06)]">
      <div className="flex items-center gap-2" onClick={onOpen}>
        {handle}
        <span className="num text-xs text-gray-400">{stt}</span>
        <span className="font-bold">{x.item.name}</span>
        {x.item.unit && <span className="text-sm text-gray-500">({x.item.unit})</span>}
        <span className="ml-auto text-sm text-gray-400">Sửa ›</span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="block">
          <span className="text-xs text-gray-500">Đơn giá</span>
          <div className="rounded-xl border border-[#f1e2bd] bg-[#fffaf0]">
            <InlineNumber value={x.item.unitPrice} onSave={(v) => onPatch({ unitPrice: v })} placeholder="0" />
          </div>
        </label>
        <span className="pb-2 text-gray-400">×</span>
        <label className="block">
          <span className="text-xs text-gray-500">Số lượng</span>
          <div className={`rounded-xl border ${auto ? 'border-gray-200 bg-calc' : 'border-[#f1e2bd] bg-[#fffaf0]'}`}>
            {auto ? (
              <div className="num px-2 py-1.5 text-right text-gray-600">{fmtInt(x.quantity)}</div>
            ) : (
              <InlineNumber value={x.item.quantity} onSave={(v) => onPatch({ quantity: v })} placeholder="0" />
            )}
          </div>
        </label>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <AutoSwitch on={auto} onChange={onToggle} />
        <span className="text-sm">
          Thành tiền: <b className="num">{fmtMoney(x.total)}</b>
        </span>
      </div>
    </div>
  )
}
