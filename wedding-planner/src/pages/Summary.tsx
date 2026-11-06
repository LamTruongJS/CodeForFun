import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageTitle, useIsDesktop } from '../components/Common'
import { summary, taskCostBySide, type SummaryRow } from '../lib/calc'
import { fmtInt, fmtMoney } from '../lib/format'
import { useAppStore } from '../store/useAppStore'

/** Ý nghĩa con số → màu */
type Tone = 'count' | 'income' | 'cost' | 'net'
const TONE: Record<number, Tone> = { 1: 'count', 2: 'count', 3: 'income', 4: 'income', 5: 'net', 6: 'count', 7: 'cost', 8: 'cost', 9: 'cost', 10: 'net' }

const GROUPS: { title: string; icon: ReactNode; rows: number[] }[] = [
  {
    title: 'Khách mời',
    icon: <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8" />,
    rows: [1, 2],
  },
  {
    title: 'Tiền mừng',
    icon: <path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Zm0 0h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z" />,
    rows: [3, 4, 5],
  },
  {
    title: 'Chi phí',
    icon: <path d="M3 7h18v13H3zM3 7l2-4h14l2 4M12 11v5M9.5 13.5h5" />,
    rows: [6, 7, 8, 9],
  },
]

const SIDES = [
  { key: 'TRAI', label: 'Nhà Trai', fg: '#2E75B6', bg: '#eef5fc' },
  { key: 'GAI', label: 'Nhà Gái', fg: '#C0504D', bg: '#fdf0ef' },
  { key: 'total', label: 'Tổng cộng', fg: '#8E2C48', bg: '#f8eef1' },
] as const

function toneColor(tone: Tone, v: number) {
  if (v === 0) return '#b5a9ad'
  if (tone === 'income') return '#2e7d32'
  if (tone === 'cost') return '#c55a11'
  if (tone === 'net') return v < 0 ? '#d32f2f' : '#2e7d32'
  return '#2b2326'
}

function fmt(r: SummaryRow, v: number) {
  if (r.kind === 'count') return fmtInt(v)
  const s = fmtMoney(Math.abs(v))
  return v < 0 ? `−${s}` : s
}

export function SummaryPage() {
  const data = useAppStore((s) => s.data)
  const rows = useMemo(() => summary(data), [data])
  const byStt = (n: number) => rows[n - 1]
  const unassigned = useMemo(() => taskCostBySide(data.tasks).unassignedCount, [data.tasks])
  const desktop = useIsDesktop()
  const done = data.tasks.filter((t) => t.status === 'DA_LAM').length
  const net = byStt(10)

  return (
    <div>
      <PageTitle>Tổng hợp</PageTitle>

      {/* Thẻ nổi bật */}
      <div className="relative mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#a8385a] via-[#8e2c48] to-[#5e1a2f] p-5 text-white shadow-[0_12px_30px_-12px_rgba(142,44,72,.6)]">
        <svg className="absolute -top-6 -right-6 opacity-10" width="150" height="150" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.5 1.1 4.4 2.4h2c.9-1.3 2.3-2.4 4.4-2.4 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21Z" />
        </svg>
        <div className="font-display text-[17px] font-semibold text-[#f3d9a4]">Lâm Trường ♥ Lệ Huyền</div>
        <div className="mt-3 text-[12px] tracking-wide text-white/70 uppercase">Tiền mừng thực tế − Tổng chi phí</div>
        <div className="num mt-0.5 text-[30px] leading-tight font-bold">{net.total === 0 ? '0' : fmt(net, net.total)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:max-w-md">
          {(['TRAI', 'GAI'] as const).map((k) => (
            <div key={k} className="rounded-2xl bg-white/12 px-3 py-2 backdrop-blur-sm">
              <div className="text-[11px] text-white/70">{k === 'TRAI' ? 'Nhà Trai' : 'Nhà Gái'}</div>
              <div className={`num text-[15px] font-semibold ${net[k] < 0 ? 'text-[#ffc1c1]' : ''}`}>{net[k] === 0 ? '0' : fmt(net, net[k])}</div>
            </div>
          ))}
        </div>
      </div>

      {unassigned > 0 && (
        <Link to="/tasks" className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          <span>⚠️</span> Có {unassigned} công việc chưa chọn Bên, chưa được tính vào chi phí.
        </Link>
      )}

      {!desktop ? (
        <div className="space-y-5">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <GroupTitle icon={g.icon}>{g.title}</GroupTitle>
              <div className="space-y-2">
                {g.rows.map((n) => (
                  <MobileRow key={n} r={byStt(n)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_2px_12px_-4px_rgba(80,30,45,.12)]">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="text-[13px]">
                <th className="w-10 bg-wine py-3 font-semibold text-white">#</th>
                <th className="bg-wine py-3 pl-2 text-left font-semibold text-white">Hạng mục</th>
                {SIDES.map((s) => (
                  <th key={s.key} className="w-44 py-3 pr-4 text-right font-semibold" style={{ background: s.bg, color: s.fg }}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => (
                <GroupRows key={g.title} title={g.title} icon={g.icon} rows={g.rows.map(byStt)} />
              ))}
              <GroupRows title="Còn lại" icon={<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.5 1.1 4.4 2.4h2c.9-1.3 2.3-2.4 4.4-2.4 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21Z" />} rows={[net]} />
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickLink to="/guests/trai" color="#2E75B6" title="Khách Nhà Trai" value={`${byStt(1).TRAI} thiệp mời`} />
        <QuickLink to="/guests/gai" color="#C0504D" title="Khách Nhà Gái" value={`${byStt(1).GAI} thiệp mời`} />
        <QuickLink to="/catering" color="#5E9B37" title="Số bàn" value={`${byStt(6).total} bàn`} />
        <QuickLink to="/tasks" color="#E07020" title="Công việc" value={`${done}/${data.tasks.length} đã làm`} />
      </div>
    </div>
  )
}

function GroupTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold tracking-wide text-wine/80 uppercase">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
      {children}
    </div>
  )
}

function MobileRow({ r }: { r: SummaryRow }) {
  const tone = TONE[r.stt]
  return (
    <div
      className={`rounded-2xl border bg-white p-3 shadow-[0_1px_3px_rgba(80,30,45,.06)] ${r.highlight ? 'border-[#ecc3cf]' : 'border-[#efe5e9]'}`}
    >
      <div className={`mb-2 text-[14px] leading-snug ${r.highlight ? 'font-bold text-wine' : 'font-medium text-[#2b2326]'}`}>{r.label}</div>
      <div className="grid grid-cols-[1fr_1fr_1.18fr] gap-1">
        {SIDES.map((s) => {
          const v = r[s.key]
          return (
            <div key={s.key} className="min-w-0 rounded-xl px-1.5 py-1.5 text-right" style={{ background: s.bg }}>
              <div className="text-[10.5px] font-medium" style={{ color: s.fg }}>
                {s.label}
              </div>
              <div
                className={`num truncate ${s.key === 'total' ? 'text-[14px] font-bold' : 'text-[13px] font-semibold'}`}
                style={{ color: toneColor(tone, v) }}
              >
                {fmt(r, v)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GroupRows({ title, icon, rows }: { title: string; icon: ReactNode; rows: SummaryRow[] }) {
  return (
    <>
      <tr>
        <td colSpan={5} className="border-t border-[#f0e6ea] bg-[#fcf8f9] px-4 pt-3 pb-1.5">
          <GroupTitle icon={icon}>{title}</GroupTitle>
        </td>
      </tr>
      {rows.map((r) => {
        const tone = TONE[r.stt]
        return (
          <tr key={r.stt} className={`border-t border-[#f3ecef] ${r.highlight ? 'bg-[#fbeef2]' : ''}`}>
            <td className="py-3 text-center text-[13px] text-gray-400">{r.stt}</td>
            <td className={`py-3 pl-2 ${r.highlight ? 'font-bold text-wine' : ''}`}>{r.label}</td>
            {SIDES.map((s) => (
              <td
                key={s.key}
                className={`num py-3 pr-4 text-right whitespace-nowrap ${s.key === 'total' || r.highlight ? 'font-bold' : 'font-semibold'}`}
                style={{ color: toneColor(tone, r[s.key]), background: r.highlight ? undefined : s.key === 'total' ? '#fcf6f8' : undefined }}
              >
                {fmt(r, r[s.key])}
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}

function QuickLink({ to, color, title, value }: { to: string; color: string; title: string; value: string }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-[#efe5e9] bg-white p-3.5 shadow-[0_1px_3px_rgba(80,30,45,.06)] transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {title}
      </div>
      <div className="mt-0.5 text-lg font-bold" style={{ color }}>
        {value}
      </div>
    </Link>
  )
}
