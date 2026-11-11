import { useMemo, useRef, useState } from 'react'
import { Btn, DeleteBtn, Empty, Fab, PageTitle, TotalsBar, useIsDesktop } from '../components/Common'
import { EditDialog, type FieldDef, type Values } from '../components/EditDialog'
import { ChipSelect, InlineNumber, InlineText, SIDE_OPTIONS, STATUS_OPTIONS } from '../components/Inline'
import { DragHandle, DragPreview, SortableItem, SortableList } from '../components/Sortable'
import { bySortOrder, taskRemaining, taskTotals } from '../lib/calc'
import { fmtMoney } from '../lib/format'
import type { Task } from '../lib/types'
import { confirmDialog, toast } from '../store/ui'
import { useAppStore } from '../store/useAppStore'

const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Tên công việc', type: 'text', required: true, placeholder: 'VD: Thuê xe rước dâu' },
  { key: 'amount', label: 'Số tiền', type: 'number', variant: 'money', half: true },
  { key: 'deposit', label: 'Đã cọc', type: 'number', variant: 'money', half: true },
  { key: 'side', label: 'Bên', type: 'select', placeholder: 'Chọn bên', options: SIDE_OPTIONS, half: true },
  { key: 'status', label: 'Tiến độ', type: 'select', placeholder: 'Chưa làm', options: STATUS_OPTIONS, half: true },
  { key: 'note', label: 'Ghi chú', type: 'textarea' },
]

type SideFilter = '' | 'TRAI' | 'GAI' | 'CHUNG' | 'NONE'
type StatusFilter = '' | 'DANG_LAM' | 'DA_LAM' | 'NONE'

export function TasksPage() {
  const all = useAppStore((s) => s.data.tasks)
  const { addTask, updateTask, deleteTask, reorderTask } = useAppStore()
  const desktop = useIsDesktop()
  const tasks = useMemo(() => bySortOrder(all), [all])
  const totals = useMemo(() => taskTotals(all), [all])
  const stt = useMemo(() => new Map(tasks.map((t, i) => [t.id, i + 1])), [tasks])

  const [sideF, setSideF] = useState<SideFilter>('')
  const [statusF, setStatusF] = useState<StatusFilter>('')
  const [sheet, setSheet] = useState<Task | 'new' | null>(null)
  const newRowRef = useRef<HTMLInputElement>(null)

  const filtering = Boolean(sideF || statusF)
  const shown = tasks.filter(
    (t) =>
      (!sideF || (sideF === 'NONE' ? t.side === null : t.side === sideF)) &&
      (!statusF || (statusF === 'NONE' ? t.status === null : t.status === statusF)),
  )

  const askDelete = async (t: Task) => {
    if (await confirmDialog({ title: 'Xóa công việc?', message: `“${t.name}” sẽ bị xóa.`, okText: 'Xóa', danger: true })) {
      deleteTask(t.id)
      setSheet(null)
      toast('Đã xóa', 'success')
    }
  }

  return (
    <div>
      <PageTitle right={desktop ? <Btn onClick={() => newRowRef.current?.focus()}>+ Thêm việc</Btn> : undefined}>
        Công việc cần làm
      </PageTitle>

      <div className="mb-3 space-y-2">
        <FilterRow
          label="Bên"
          value={sideF}
          onChange={setSideF}
          options={[
            ['', 'Tất cả'],
            ['TRAI', 'Họ trai'],
            ['GAI', 'Họ gái'],
            ['CHUNG', 'Họ trai và gái'],
            ['NONE', 'Chưa chọn'],
          ]}
        />
        <FilterRow
          label="Tiến độ"
          value={statusF}
          onChange={setStatusF}
          options={[
            ['', 'Tất cả'],
            ['DANG_LAM', 'Đang làm'],
            ['DA_LAM', 'Đã làm'],
            ['NONE', 'Chưa làm'],
          ]}
        />
      </div>

      <TotalsBar
        items={[
          { label: 'Số tiền', value: fmtMoney(totals.amount) },
          { label: 'Đã cọc', value: fmtMoney(totals.deposit) },
          { label: 'Còn lại', value: fmtMoney(totals.remaining), color: totals.remaining > 0 ? '#C55A11' : undefined },
        ]}
      />

      {filtering && (
        <div className="mb-2 text-sm text-gray-500">
          Đang hiển thị {shown.length}/{tasks.length} việc · kéo thả tạm tắt khi lọc
        </div>
      )}

      <SortableList
        ids={shown.map((t) => t.id)}
        disabled={filtering}
        onMove={reorderTask}
        overlay={
          desktop
            ? undefined
            : (id) => {
                const t = tasks.find((x) => x.id === id)!
                return <DragPreview stt={stt.get(id)} title={t.name} bg={t.status === 'DA_LAM' ? '#D9EAD3' : '#fff'} sub={t.amount ? `${fmtMoney(t.amount)} đ` : undefined} />
              }
        }
      >
        {desktop ? (
          <div className="max-h-[calc(100dvh-320px)] overflow-auto rounded-xl shadow-sm">
            <table className="tbl table-fixed min-w-[1020px]">
              <colgroup>
                <col className="w-[68px]" />
                <col />
                <col className="w-[116px]" />
                <col className="w-[116px]" />
                <col className="w-[116px]" />
                <col className="w-[134px]" />
                <col className="w-[104px]" />
                <col className="w-[14%]" />
                <col className="w-12" />
              </colgroup>
              <thead>
                <tr>
                  <th className="sticky-l left-0">STT</th>
                  <th className="sticky-l left-[68px] text-left">Tên công việc</th>
                  <th className="text-right">Số tiền (VNĐ)</th>
                  <th className="text-right">Đã cọc (VNĐ)</th>
                  <th className="text-right">Còn lại (VNĐ)</th>
                  <th>Bên</th>
                  <th>Tiến độ</th>
                  <th className="text-left">Ghi chú</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-gray-400">
                      Không có công việc phù hợp
                    </td>
                  </tr>
                )}
                {shown.map((t) => (
                  <TaskRow key={t.id} t={t} stt={stt.get(t.id)!} onPatch={(p) => updateTask(t.id, p)} onDelete={() => askDelete(t)} />
                ))}
                <tr>
                  <td className="sticky-l left-0 text-center text-gray-400">+</td>
                  <td className="sticky-l left-[68px]">
                    <input
                      ref={newRowRef}
                      className="cell"
                      placeholder="Nhập công việc mới rồi Enter…"
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      onBlur={(e) => {
                        const v = e.currentTarget.value.trim()
                        if (!v) return
                        addTask({ name: v })
                        e.currentTarget.value = ''
                        requestAnimationFrame(() => newRowRef.current?.focus())
                      }}
                    />
                  </td>
                  <td colSpan={7}></td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td className="sticky-l left-0"></td>
                  <td className="sticky-l left-[68px] tracking-wide text-wine">TỔNG CỘNG</td>
                  <td className="num text-right">{fmtMoney(totals.amount)}</td>
                  <td className="num text-right">{fmtMoney(totals.deposit)}</td>
                  <td className="num text-right" style={{ color: totals.remaining > 0 ? '#C55A11' : undefined }}>
                    {fmtMoney(totals.remaining)}
                  </td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="space-y-2">
            {shown.length === 0 && <Empty>Không có công việc phù hợp</Empty>}
            {shown.map((t) => (
              <TaskCard key={t.id} t={t} stt={stt.get(t.id)!} onOpen={() => setSheet(t)} onPatch={(p) => updateTask(t.id, p)} />
            ))}
          </div>
        )}
      </SortableList>

      {!desktop && <Fab label="Thêm việc" onClick={() => setSheet('new')} />}

      {sheet && (
        <EditDialog
          title={sheet === 'new' ? 'Thêm công việc' : 'Sửa công việc'}
          subtitle={sheet === 'new' ? undefined : `STT ${stt.get(sheet.id)}`}
          fields={FIELDS}
          initial={sheet === 'new' ? {} : (sheet as unknown as Values)}
          onClose={() => setSheet(null)}
          onDelete={sheet === 'new' ? undefined : () => askDelete(sheet)}
          extra={(v) => {
            const rem = taskRemaining({ amount: v.amount as number | null, deposit: v.deposit as number | null })
            return (
              <div className="flex items-center justify-between rounded-2xl bg-[#f6f1f3] px-4 py-3 text-gray-600">
                <span className="text-[13px] font-medium">Còn lại (tự tính)</span>
                <b className="num" style={{ color: rem > 0 ? '#C55A11' : undefined }}>
                  {fmtMoney(rem)}
                </b>
              </div>
            )
          }}
          onSave={(v) => {
            const patch = v as unknown as Partial<Task> & { name: string }
            if (sheet === 'new') addTask(patch)
            else updateTask(sheet.id, patch)
            setSheet(null)
            toast(sheet === 'new' ? 'Đã thêm công việc' : 'Đã lưu', 'success')
          }}
        />
      )}
    </div>
  )
}

function FilterRow<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: V
  onChange: (v: V) => void
  options: [V, string][]
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
      <span className="shrink-0 text-sm text-gray-500">{label}:</span>
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`shrink-0 rounded-full border-[1.5px] px-3.5 py-1 text-[13px] font-medium whitespace-nowrap transition ${
            value === v ? 'border-[#ED7D31] bg-[#ED7D31] text-white' : 'border-[#ebe0e4] bg-white text-gray-600'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

const remainingStyle = (v: number) => (v > 0 ? { color: '#C55A11', fontWeight: 700 } : undefined)

function TaskRow({ t, stt, onPatch, onDelete }: { t: Task; stt: number; onPatch: (p: Partial<Task>) => void; onDelete: () => void }) {
  const rem = taskRemaining(t)
  return (
    <SortableItem as="tr" id={t.id} className={t.status === 'DA_LAM' ? 'done' : ''}>
      <td className="sticky-l left-0">
        <div className="flex items-center gap-1 pl-1">
          <DragHandle />
          <span className="num w-7 text-center text-gray-600">{stt}</span>
        </div>
      </td>
      <td className="sticky-l left-[68px]">
        <InlineText value={t.name} required onSave={(v) => onPatch({ name: v! })} />
      </td>
      <td>
        <InlineNumber value={t.amount} onSave={(v) => onPatch({ amount: v })} />
      </td>
      <td>
        <InlineNumber value={t.deposit} onSave={(v) => onPatch({ deposit: v })} />
      </td>
      <td className="calc pad num text-right" style={remainingStyle(rem)}>
        {fmtMoney(rem)}
      </td>
      <td className="pad text-center">
        <ChipSelect value={t.side} options={SIDE_OPTIONS} placeholder="Chọn bên" onChange={(v) => onPatch({ side: v })} />
      </td>
      <td className="pad text-center">
        <ChipSelect value={t.status} options={STATUS_OPTIONS} placeholder="—" onChange={(v) => onPatch({ status: v })} />
      </td>
      <td>
        <InlineText value={t.note} onSave={(v) => onPatch({ note: v })} />
      </td>
      <td>
        <DeleteBtn onClick={onDelete} />
      </td>
    </SortableItem>
  )
}

function TaskCard({ t, stt, onOpen, onPatch }: { t: Task; stt: number; onOpen: () => void; onPatch: (p: Partial<Task>) => void }) {
  const rem = taskRemaining(t)
  const done = t.status === 'DA_LAM'
  return (
    <SortableItem
      id={t.id}
      whole
      style={{ background: done ? '#D9EAD3' : '#fff' }}
      className="flex items-start gap-2 rounded-2xl border border-[#efe5e9] p-3 shadow-[0_1px_3px_rgba(80,30,45,.06)] transition-[scale] active:scale-[.985]"
      onClick={onOpen}
    >
      <div className="flex flex-col items-center">
        <DragHandle />
        <span className="num text-xs text-gray-400">{stt}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="leading-snug font-semibold text-[#2b2326]">{t.name}</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <ChipSelect value={t.side} options={SIDE_OPTIONS} placeholder="Chọn bên" onChange={(v) => onPatch({ side: v })} />
          <ChipSelect value={t.status} options={STATUS_OPTIONS} placeholder="Tiến độ" onChange={(v) => onPatch({ status: v })} />
        </div>
        {(t.amount || t.deposit) ? (
          <div className="mt-1.5 grid grid-cols-3 gap-1 text-sm">
            <div>
              <div className="text-xs text-gray-500">Số tiền</div>
              <div className="num font-semibold">{fmtMoney(t.amount)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Đã cọc</div>
              <div className="num">{fmtMoney(t.deposit)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Còn lại</div>
              <div className="num" style={remainingStyle(rem)}>
                {fmtMoney(rem)}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-1 text-sm text-gray-400">Chưa có số tiền — chạm để nhập</div>
        )}
        {t.note && <div className="mt-1 text-sm text-gray-500 italic">{t.note}</div>}
      </div>
    </SortableItem>
  )
}
