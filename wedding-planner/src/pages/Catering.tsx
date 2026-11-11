import { useMemo, useState, type ReactNode } from 'react'
import { DeleteBtn, PageTitle, useIsDesktop } from '../components/Common'
import { EditDialog, type FieldDef } from '../components/EditDialog'
import { InlineNumber, InlineText } from '../components/Inline'
import { DragHandle, DragPreview, SortableItem, SortableList } from '../components/Sortable'
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
      <div className="grid gap-5">
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
  const theme = THEME[side]

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
      <h2
        className="flex items-center justify-center gap-2 px-4 py-3 font-display text-lg font-bold tracking-wide"
        style={{ background: theme.headBg, color: theme.fg }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: theme.fg }} />
        {label}
        <span className="h-2 w-2 rounded-full" style={{ background: theme.fg }} />
      </h2>

      <div className="grid grid-cols-3 gap-2 p-3">
        <Stat label="Số khách" value={fmtInt(c.people)} color={theme.fg} bg={theme.soft} icon={ICON.people} />
        <label className="rounded-2xl border border-[#f1e2bd] bg-[#fffaf0] px-1 pt-2 pb-1 text-center">
          <div className="flex items-center justify-center gap-1 text-[11.5px] whitespace-nowrap text-[#9a7a2e]">
            {ICON.pen12}
            Người / bàn
          </div>
          <div className="text-[22px] leading-tight font-bold text-[#7a5a12]">
            <InlineNumber value={c.peoplePerTable} required className="!px-0 !py-0.5 !text-center" onSave={(v) => setPeoplePerTable(side, v ?? 0)} />
          </div>
        </label>
        <Stat label="Bàn dự kiến" value={fmtInt(c.tables)} color="#3f7d20" bg="#eef7e8" icon={ICON.table} />
      </div>

      <SortableList
        ids={c.items.map((x) => x.item.id)}
        onMove={(a, o) => reorderItem(side, a, o)}
        overlay={
          desktop
            ? undefined
            : (id) => {
                const i = c.items.findIndex((x) => x.item.id === id)
                const x = c.items[i]
                return <DragPreview stt={i + 1} title={x.item.name} sub={x.item.unit ?? undefined} />
              }
        }
      >
        {desktop ? (
          <div className="overflow-x-auto px-3">
            <table className="tbl table-fixed min-w-[760px]">
              <colgroup>
                <col className="w-[64px]" />
                <col />
                <col className="w-[110px]" />
                <col className="w-[150px]" />
                <col className="w-[210px]" />
                <col className="w-[160px]" />
                <col className="w-12" />
              </colgroup>
              <thead>
                <tr>
                  <th>STT</th>
                  <th className="text-left">Hạng mục</th>
                  <th className="text-left">ĐVT</th>
                  <th className="text-right">Đơn giá (VNĐ)</th>
                  <th>Số lượng</th>
                  <th className="text-right">Thành tiền (VNĐ)</th>
                  <th></th>
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
                <tr>
                  <td colSpan={5} className="!bg-wine px-3 py-3 font-semibold tracking-wide text-white">
                    TỔNG CỘNG {label}
                  </td>
                  <td className="num !bg-wine px-2 py-3 text-right text-lg font-bold text-white">{fmtMoney(c.total)}</td>
                  <td className="!bg-wine"></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-2 px-3">
            {c.items.map((x, i) => (
              <ItemCard key={x.item.id} x={x} stt={i + 1} onPatch={(p) => updateItem(x.item.id, p)} onToggle={(a) => toggleAuto(x.item, a)} onOpen={() => setSheet(x.item)} />
            ))}
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#9b3352] to-[#7d2640] px-4 py-3.5 text-white shadow-md shadow-wine/20">
              <span className="text-[13px] font-semibold tracking-wide">TỔNG CỘNG {label}</span>
              <span className="num text-xl font-bold">{fmtMoney(c.total)}</span>
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
        <EditDialog
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

const THEME = {
  TRAI: { fg: '#2E75B6', soft: '#eef5fc', headBg: 'linear-gradient(90deg,#eef5fc,#dceaf8,#eef5fc)' },
  GAI: { fg: '#C0504D', soft: '#fdf0ef', headBg: 'linear-gradient(90deg,#fdf0ef,#f9dedc,#fdf0ef)' },
} as const

const svg = (d: ReactNode, s = 14) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)
const PEN = <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
const ICON = {
  people: svg(<path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8" />, 13),
  table: svg(<path d="M3 8h18M5 8v11M19 8v11M8 4h8" />, 13),
  pen12: svg(PEN, 11),
  pen: svg(PEN, 16),
}

function Stat({ label, value, color, bg, icon }: { label: string; value: string; color: string; bg: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl px-1 pt-2 pb-1 text-center" style={{ background: bg }}>
      <div className="flex items-center justify-center gap-1 text-[11.5px] whitespace-nowrap" style={{ color }}>
        {icon}
        {label}
      </div>
      <div className="num py-0.5 text-[22px] font-bold" style={{ color }}>
        {value}
      </div>
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
  const auto = x.item.quantityMode === 'AUTO_TABLES'
  return (
    <SortableItem as="tr" id={x.item.id}>
      <td>
        <div className="flex items-center gap-0.5 pl-0.5">
          <DragHandle />
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
              <div className="num px-2 py-1.5 text-right font-semibold text-[#3f7d20]">{fmtInt(x.quantity)}</div>
            ) : (
              <InlineNumber value={x.item.quantity} onSave={(v) => onPatch({ quantity: v })} />
            )}
          </div>
        </div>
      </td>
      <td className={`calc pad num text-right font-semibold ${x.total ? '!text-wine' : ''}`}>{fmtMoney(x.total)}</td>
      <td>
        <DeleteBtn onClick={onDelete} />
      </td>
    </SortableItem>
  )
}

function ItemCard({ x, stt, onPatch, onToggle, onOpen }: RowProps & { onOpen: () => void }) {
  const auto = x.item.quantityMode === 'AUTO_TABLES'
  return (
    <SortableItem id={x.item.id} className="rounded-2xl border border-[#efe5e9] bg-white p-3 shadow-[0_1px_3px_rgba(80,30,45,.06)]">
      <div className="flex items-center gap-2">
        <DragHandle />
        <span className="num text-xs text-gray-400">{stt}</span>
        <span className="font-semibold text-[#2b2326]">{x.item.name}</span>
        {x.item.unit && <span className="rounded-full bg-[#f3ecef] px-2 py-0.5 text-[12px] text-gray-500">{x.item.unit}</span>}
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Sửa ${x.item.name}`}
          title="Sửa"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#f6eef1] text-wine transition hover:bg-[#f0dde4] active:scale-95"
        >
          {ICON.pen}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="block">
          <span className="text-xs text-gray-500">Đơn giá</span>
          <div className="rounded-xl border border-[#f1e2bd] bg-[#fffaf0] font-semibold text-[#7a5a12]">
            <InlineNumber value={x.item.unitPrice} onSave={(v) => onPatch({ unitPrice: v })} placeholder="0" />
          </div>
        </label>
        <span className="pb-2 text-gray-400">×</span>
        <label className="block">
          <span className="text-xs text-gray-500">Số lượng</span>
          <div className={`rounded-xl border ${auto ? 'border-[#d6e9c9] bg-[#eef7e8]' : 'border-[#f1e2bd] bg-[#fffaf0]'}`}>
            {auto ? (
              <div className="num px-2 py-1.5 text-right font-semibold text-[#3f7d20]">{fmtInt(x.quantity)} bàn</div>
            ) : (
              <InlineNumber value={x.item.quantity} onSave={(v) => onPatch({ quantity: v })} placeholder="0" />
            )}
          </div>
        </label>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <AutoSwitch on={auto} onChange={onToggle} />
        <span className="flex items-baseline gap-1.5 text-[13px] text-gray-500">
          Thành tiền
          <b className={`num text-[17px] ${x.total ? 'text-wine' : 'font-medium text-[#c9bec2]'}`}>{fmtMoney(x.total)}</b>
        </span>
      </div>
    </SortableItem>
  )
}
