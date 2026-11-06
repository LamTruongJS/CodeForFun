import { useMemo, useRef, useState } from 'react'
import { Btn, DeleteBtn, Empty, Fab, PageTitle, TotalsBar, useIsDesktop } from '../components/Common'
import { EditSheet, type FieldDef, type Values } from '../components/EditSheet'
import { InlineNumber, InlineText } from '../components/Inline'
import { SortableList, useSortRow } from '../components/Sortable'
import { bySortOrder, guestTotals } from '../lib/calc'
import { fmtInt, fmtMoney } from '../lib/format'
import type { Guest, GuestSide } from '../lib/types'
import { confirmDialog, toast } from '../store/ui'
import { useAppStore } from '../store/useAppStore'

const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Họ và tên', type: 'text', required: true, placeholder: 'VD: V/C Anh chị Minh – Lan' },
  { key: 'address', label: 'Địa chỉ', type: 'text', half: true, placeholder: 'VD: Phú Bình' },
  { key: 'attendees', label: 'Số lượng đi', type: 'number', required: true, variant: 'stepper', half: true },
  { key: 'expectedGift', label: 'Mừng dự kiến', type: 'number', variant: 'money', half: true },
  { key: 'actualGift', label: 'Mừng thực tế', type: 'number', variant: 'money', half: true },
  { key: 'note', label: 'Ghi chú', type: 'textarea', placeholder: 'VD: Kiểm tra lại tên…' },
]

const needsCheck = (g: Guest) => (g.note ?? '').trim().toLowerCase().startsWith('kiểm tra')
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

export function GuestsPage({ side }: { side: GuestSide }) {
  const all = useAppStore((s) => s.data.guests)
  const { addGuest, updateGuest, deleteGuest, reorderGuest } = useAppStore()
  const desktop = useIsDesktop()

  const guests = useMemo(() => bySortOrder(all.filter((g) => g.side === side)), [all, side])
  const totals = useMemo(() => guestTotals(all, side), [all, side])
  const stt = useMemo(() => new Map(guests.map((g, i) => [g.id, i + 1])), [guests])

  const [q, setQ] = useState('')
  const [addr, setAddr] = useState('')
  const [onlyCheck, setOnlyCheck] = useState(false)
  const [sheet, setSheet] = useState<Guest | 'new' | null>(null)
  const newRowRef = useRef<HTMLInputElement>(null)

  const addresses = useMemo(() => {
    const m = new Map<string, number>()
    guests.forEach((g) => g.address && m.set(g.address, (m.get(g.address) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'))
  }, [guests])

  const filtering = Boolean(q.trim() || addr || onlyCheck)
  const shown = useMemo(() => {
    const nq = norm(q.trim())
    return guests.filter(
      (g) =>
        (!nq || norm(g.name).includes(nq) || norm(g.address ?? '').includes(nq)) &&
        (!addr || g.address === addr) &&
        (!onlyCheck || needsCheck(g)),
    )
  }, [guests, q, addr, onlyCheck])
  const checkCount = guests.filter(needsCheck).length

  const askDelete = async (g: Guest) => {
    if (await confirmDialog({ title: 'Xóa khách mời?', message: `“${g.name}” sẽ bị xóa khỏi danh sách.`, okText: 'Xóa', danger: true })) {
      deleteGuest(g.id)
      setSheet(null)
      toast('Đã xóa', 'success')
    }
  }

  const title = side === 'TRAI' ? 'Nhà Trai' : 'Nhà Gái'

  return (
    <div>
      <PageTitle
        right={desktop ? <Btn onClick={() => newRowRef.current?.focus()}>+ Thêm khách</Btn> : undefined}
      >
        Khách mời {title}
      </PageTitle>

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className="field !h-11 min-w-0 flex-1 basis-full !bg-white sm:basis-48"
          placeholder="Tìm theo tên hoặc địa chỉ…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
        />
        <select
          className="field !h-11 min-w-0 flex-1 basis-36 !bg-white sm:flex-none sm:!w-56"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
        >
          <option value="">Tất cả địa chỉ</option>
          {addresses.map(([a, c]) => (
            <option key={a} value={a}>
              {a} ({c})
            </option>
          ))}
        </select>
        {checkCount > 0 && (
          <button
            onClick={() => setOnlyCheck((v) => !v)}
            className={`h-11 rounded-full border-[1.5px] px-4 text-[13px] font-medium whitespace-nowrap ${
              onlyCheck ? 'border-[#ED7D31] bg-[#ED7D31] text-white' : 'border-[#ED7D31] bg-white text-[#C55A11]'
            }`}
          >
            Cần kiểm tra ({checkCount})
          </button>
        )}
      </div>

      <TotalsBar
        items={[
          { label: 'Lượt mời', value: `${totals.count}` },
          { label: 'Số lượng đi', value: fmtInt(totals.attendees) },
          { label: 'Mừng dự kiến', value: fmtMoney(totals.expected) },
          { label: 'Mừng thực tế', value: fmtMoney(totals.actual) },
        ]}
      />

      {filtering && (
        <div className="mb-2 text-sm text-gray-500">
          Đang hiển thị {shown.length}/{guests.length} khách · kéo thả tạm tắt khi lọc{' '}
          <button
            className="text-wine underline"
            onClick={() => {
              setQ('')
              setAddr('')
              setOnlyCheck(false)
            }}
          >
            Bỏ lọc
          </button>
        </div>
      )}

      <SortableList ids={shown.map((g) => g.id)} disabled={filtering} onMove={(a, o) => reorderGuest(side, a, o)}>
        {desktop ? (
          <div className="max-h-[calc(100dvh-290px)] min-h-64 overflow-auto rounded-xl shadow-sm">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="sticky-l left-0 w-[68px] min-w-[68px]">STT</th>
                  <th className="sticky-l left-[68px] min-w-[220px] text-left">Họ và tên</th>
                  <th className="min-w-[130px]">Địa chỉ</th>
                  <th className="w-24">Số lượng đi</th>
                  <th className="min-w-[150px]">Tiền mừng dự kiến (VNĐ)</th>
                  <th className="min-w-[150px]">Tiền mừng thực tế (VNĐ)</th>
                  <th className="min-w-[200px]">Ghi chú</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((g) => (
                  <GuestRow key={g.id} g={g} stt={stt.get(g.id)!} onPatch={(p) => updateGuest(g.id, p)} onDelete={() => askDelete(g)} />
                ))}
                <tr>
                  <td className="sticky-l left-0 text-center text-gray-400">+</td>
                  <td className="sticky-l left-[68px]" colSpan={1}>
                    <input
                      ref={newRowRef}
                      className="cell"
                      placeholder="Nhập tên khách mới rồi Enter…"
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      onBlur={(e) => {
                        const v = e.currentTarget.value.trim()
                        if (!v) return
                        addGuest(side, { name: v })
                        e.currentTarget.value = ''
                        if (filtering) toast('Đã thêm (có thể bị ẩn do đang lọc)', 'success')
                        requestAnimationFrame(() => newRowRef.current?.focus())
                      }}
                    />
                  </td>
                  <td colSpan={6} className="pad text-sm text-gray-400">
                    Số lượng đi mặc định là 1
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-2">
            {shown.length === 0 && <Empty>{filtering ? 'Không có khách phù hợp' : 'Chưa có khách mời. Bấm “+ Thêm khách”.'}</Empty>}
            {shown.map((g) => (
              <GuestCard key={g.id} g={g} stt={stt.get(g.id)!} onOpen={() => setSheet(g)} />
            ))}
          </div>
        )}
      </SortableList>

      {!desktop && <Fab label="Thêm khách" onClick={() => setSheet('new')} />}

      {sheet && (
        <EditSheet
          title={sheet === 'new' ? 'Thêm khách mời' : 'Sửa khách mời'}
          subtitle={`${side === 'TRAI' ? 'Nhà Trai' : 'Nhà Gái'}${sheet === 'new' ? '' : ` · STT ${stt.get(sheet.id)}`}`}
          fields={FIELDS}
          initial={sheet === 'new' ? { attendees: 1 } : (sheet as unknown as Values)}
          onClose={() => setSheet(null)}
          onDelete={sheet === 'new' ? undefined : () => askDelete(sheet)}
          onSave={(v) => {
            const patch = v as unknown as Partial<Guest> & { name: string }
            if (sheet === 'new') addGuest(side, patch)
            else updateGuest(sheet.id, patch)
            setSheet(null)
            toast(sheet === 'new' ? 'Đã thêm khách' : 'Đã lưu', 'success')
          }}
        />
      )}
    </div>
  )
}

function GuestRow({ g, stt, onPatch, onDelete }: { g: Guest; stt: number; onPatch: (p: Partial<Guest>) => void; onDelete: () => void }) {
  const { ref, style, handle } = useSortRow(g.id)
  return (
    <tr ref={ref} style={style} className={needsCheck(g) ? 'check' : ''}>
      <td className="sticky-l left-0">
        <div className="flex items-center gap-1 pl-1">
          {handle}
          <span className="num w-7 text-center text-gray-600">{stt}</span>
        </div>
      </td>
      <td className="sticky-l left-[68px]">
        <InlineText value={g.name} required onSave={(v) => onPatch({ name: v! })} />
      </td>
      <td>
        <InlineText value={g.address} onSave={(v) => onPatch({ address: v })} />
      </td>
      <td>
        <InlineNumber value={g.attendees} required onSave={(v) => onPatch({ attendees: v ?? 0 })} />
      </td>
      <td>
        <InlineNumber value={g.expectedGift} onSave={(v) => onPatch({ expectedGift: v })} />
      </td>
      <td>
        <InlineNumber value={g.actualGift} onSave={(v) => onPatch({ actualGift: v })} />
      </td>
      <td>
        <InlineText value={g.note} onSave={(v) => onPatch({ note: v })} className={needsCheck(g) ? 'text-[#C55A11]' : ''} />
      </td>
      <td>
        <DeleteBtn onClick={onDelete} />
      </td>
    </tr>
  )
}

function GuestCard({ g, stt, onOpen }: { g: Guest; stt: number; onOpen: () => void }) {
  const { ref, style, handle } = useSortRow(g.id)
  const check = needsCheck(g)
  return (
    <div
      ref={ref}
      style={{ ...style, borderLeft: check ? '4px solid #ED7D31' : undefined }}
      className="flex items-start gap-2 rounded-2xl border border-[#efe5e9] bg-white p-3 shadow-[0_1px_3px_rgba(80,30,45,.06)] transition active:scale-[.99]"
      onClick={onOpen}
    >
      <div className="flex flex-col items-center">
        {handle}
        <span className="num text-xs text-gray-400">{stt}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="leading-snug font-semibold text-[#2b2326]">{g.name}</div>
          <span
            className={`num shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${g.attendees === 0 ? 'bg-gray-100 text-gray-400' : 'bg-[#fbe9ee] text-wine'}`}
          >
            {g.attendees} người
          </span>
        </div>
        {g.address && (
          <div className="mt-0.5 flex items-center gap-1 text-[13px] text-gray-500">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            {g.address}
          </div>
        )}
        {(g.expectedGift || g.actualGift) && (
          <div className="mt-0.5 flex gap-3 text-sm">
            {g.expectedGift ? <span className="text-gray-600">Dự kiến: <b className="num">{fmtMoney(g.expectedGift)}</b></span> : null}
            {g.actualGift ? <span className="text-green-700">Thực tế: <b className="num">{fmtMoney(g.actualGift)}</b></span> : null}
          </div>
        )}
        {g.note && <div className={`mt-0.5 text-sm italic ${check ? 'text-[#C55A11]' : 'text-gray-500'}`}>{g.note}</div>}
      </div>
    </div>
  )
}
