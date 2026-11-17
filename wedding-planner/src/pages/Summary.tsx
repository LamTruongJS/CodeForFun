import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageTitle, useIsDesktop } from '../components/Common'
import { summary, taskCostBySide, type SummaryRow } from '../lib/calc'
import { fmtDateTime, fmtInt, fmtMoney } from '../lib/format'
import { useAppStore } from '../store/useAppStore'

/** Ý nghĩa con số → màu */
type Tone = 'count' | 'income' | 'cost' | 'net'
const TONE: Record<number, Tone> = { 1: 'count', 2: 'count', 3: 'income', 4: 'income', 5: 'net', 6: 'count', 7: 'cost', 8: 'cost', 9: 'cost', 10: 'cost', 11: 'net' }

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
    rows: [6, 7, 8, 9, 10],
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
  const net = byStt(11)

  return (
    <div>
      <PageTitle>Tổng hợp</PageTitle>

      <Hero net={net} gifts={byStt(4)} cost={byStt(10)} updatedAt={data.updatedAt} />

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
        <div className="grid items-start gap-5 2xl:grid-cols-2">
          <div className="grid gap-5">
            <DesktopCard group={GROUPS[0]} rows={GROUPS[0].rows.map(byStt)} />
            <DesktopCard group={GROUPS[1]} rows={GROUPS[1].rows.map(byStt)} money />
          </div>
          <DesktopCard group={GROUPS[2]} rows={GROUPS[2].rows.map(byStt)} money footer={net} />
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

const HEART = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.5 1.1 4.4 2.4h2c.9-1.3 2.3-2.4 4.4-2.4 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21Z'

/** Thẻ nổi bật đầu trang: còn lại sau chi phí + tiền mừng / chi phí + mức bù chi phí. */
function Hero({ net, gifts, cost, updatedAt }: { net: SummaryRow; gifts: SummaryRow; cost: SummaryRow; updatedAt: string }) {
  const money = (v: number) => (v === 0 ? '0' : fmt(net, v))
  const pct = cost.total > 0 ? Math.min(100, Math.round((gifts.total / cost.total) * 100)) : gifts.total > 0 ? 100 : 0
  const negative = net.total < 0
  return (
    <section className="relative mb-5 overflow-hidden rounded-[28px] bg-[#7d2640] text-white shadow-[0_18px_40px_-18px_rgba(110,30,55,.7)]">
      {/* nền: gradient + quầng sáng + trái tim mờ */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_140%_at_0%_0%,#b84a6c_0%,#8e2c48_45%,#5a1830_100%)]" />
      <div className="absolute -top-24 right-[-60px] h-72 w-72 rounded-full bg-[#f3d9a4]/10 blur-2xl" />
      <svg className="absolute -right-8 -bottom-10 text-white/[.06]" width="220" height="220" viewBox="0 0 24 24" fill="currentColor">
        <path d={HEART} />
      </svg>

      <div className="relative grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-center md:gap-10 md:p-8">
        {/* Bên trái: tên + số còn lại */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-display text-[19px] font-semibold text-[#f3d9a4] md:text-[22px]">Lâm Trường ♥ Lệ Huyền</span>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-white/70">Cập nhật {fmtDateTime(updatedAt)}</span>
          </div>
          <div className="mt-5 text-[12px] font-medium tracking-[0.14em] text-white/65 uppercase">Còn lại sau chi phí</div>
          <div className={`num mt-1 text-[34px] leading-none font-bold tracking-tight md:text-[46px] ${negative ? 'text-[#ffd0d0]' : 'text-white'}`}>
            {money(net.total)}
          </div>
          <div className="mt-2 text-[13px] text-white/60">Tiền mừng thực tế − Tổng chi phí</div>

          <div className="mt-5 grid max-w-md grid-cols-2 gap-2">
            {(['TRAI', 'GAI'] as const).map((k) => (
              <div key={k} className="rounded-2xl border border-white/10 bg-white/[.08] px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 text-[12px] text-white/70">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: k === 'TRAI' ? '#9fc5e8' : '#f4cccc' }} />
                  {k === 'TRAI' ? 'Nhà Trai' : 'Nhà Gái'}
                </div>
                <div className={`num text-[16px] font-semibold ${net[k] < 0 ? 'text-[#ffd0d0]' : ''}`}>{money(net[k])}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bên phải: tiền mừng vs chi phí */}
        <div className="rounded-3xl border border-white/10 bg-white/[.07] p-3 backdrop-blur-sm md:p-5">
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <HeroStat label="Tiền mừng thực tế" value={money(gifts.total)} accent="#b9f0c4" icon="M20 12v9H4v-9M2 7h20v5H2zM12 21V7" />
            <HeroStat label="Tổng chi phí" value={money(cost.total)} accent="#ffd6a8" icon="M3 7h18v13H3zM3 7l2-4h14l2 4M12 11v5M9.5 13.5h5" />
          </div>
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-[12px] text-white/70">
              <span>Tiền mừng đã bù được</span>
              <b className="num text-[15px] text-white">{pct}% chi phí</b>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#f3d9a4] to-[#ffe9c4] transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1.5 text-[12px] text-white/55">
              {cost.total === 0
                ? 'Chưa có chi phí nào'
                : pct >= 100
                  ? 'Tiền mừng đã đủ bù toàn bộ chi phí 🎉'
                  : `Còn thiếu ${fmtMoney(cost.total - gifts.total)} đ để bù đủ chi phí`}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroStat({ label, value, accent, icon }: { label: string; value: string; accent: string; icon: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-black/10 px-3 py-2.5 md:px-3.5 md:py-3">
      <div className="flex items-center gap-1.5 text-[11.5px] whitespace-nowrap text-white/70 md:text-[12px]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
        {label}
      </div>
      <div className="num mt-0.5 text-[16px] font-bold whitespace-nowrap md:text-[21px]" style={{ color: accent }}>
        {value}
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

/** Màu chữ cho bản desktop: chi phí dùng màu chữ thường, chỉ dòng tổng mới tô màu. */
function deskColor(tone: Tone, v: number, highlight?: boolean) {
  if (v === 0) return '#c4b9bd'
  if (tone === 'income') return '#2e7d32'
  if (tone === 'net') return v < 0 ? '#d32f2f' : '#2e7d32'
  if (tone === 'cost' && highlight) return '#b4501a'
  return '#2b2326'
}

/** Bỏ "(VNĐ)" lặp lại trong tên dòng — đơn vị ghi một lần ở đầu thẻ. */
const shortLabel = (l: string) => l.replace(' (VNĐ)', '').replace('(VNĐ, ', '(')

function DesktopCard({
  group,
  rows,
  money,
  footer,
}: {
  group: (typeof GROUPS)[number]
  rows: SummaryRow[]
  money?: boolean
  footer?: SummaryRow
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#efe5e9] bg-white shadow-[0_2px_12px_-6px_rgba(80,30,45,.15)]">
      <div className="flex items-center justify-between px-5 pt-4 pb-1">
        <GroupTitle icon={group.icon}>{group.title}</GroupTitle>
        {money && <span className="mb-2 text-[12px] text-gray-400">Đơn vị: VNĐ</span>}
      </div>
      <table className="w-full table-fixed text-[15px]">
        <colgroup>
          <col />
          <col className="w-[19%]" />
          <col className="w-[19%]" />
          <col className="w-[21%]" />
        </colgroup>
        <thead>
          <tr className="border-y border-[#f1e8eb] bg-[#fcf9fa] text-[12px] font-semibold tracking-wide uppercase">
            <th className="py-2.5 pl-5 text-left text-gray-400">Hạng mục</th>
            {SIDES.map((sd) => (
              <th key={sd.key} className={`py-2.5 pr-5 text-right ${sd.key === 'total' ? 'bg-[#f8eef1]' : ''}`} style={{ color: sd.fg }}>
                <span className="inline-flex items-center gap-1.5">
                  {sd.key !== 'total' && <span className="h-2 w-2 rounded-full" style={{ background: sd.fg }} />}
                  {sd.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <DeskRow key={r.stt} r={r} />
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <DeskRow r={footer} footer />
          </tfoot>
        )}
      </table>
    </section>
  )
}

function DeskRow({ r, footer }: { r: SummaryRow; footer?: boolean }) {
  const tone = TONE[r.stt]
  const strong = r.highlight
  const rowBg = footer ? (r.total < 0 ? 'bg-[#fdf1f1]' : 'bg-[#eff8f0]') : strong ? 'bg-[#fbf3f5]' : ''
  return (
    <tr className={`border-t ${footer ? 'border-[#ead9df]' : 'border-[#f3ecef]'} ${rowBg} ${strong || footer ? '' : 'hover:bg-[#fdf9fa]'}`}>
      <td className={`py-3 pl-5 leading-snug ${strong ? 'font-bold text-[#2b2326]' : 'text-[#4a3f43]'}`}>
        {footer ? 'Còn lại (mừng thực tế − tổng chi phí)' : shortLabel(r.label)}
      </td>
      {SIDES.map((sd) => (
        <td
          key={sd.key}
          className={`num py-3 pr-5 text-right whitespace-nowrap ${strong || sd.key === 'total' ? 'font-bold' : 'font-medium'} ${
            sd.key === 'total' && !strong && !footer ? 'bg-[#fcf7f9]' : ''
          } ${footer ? 'text-[16px]' : ''}`}
          style={{ color: deskColor(tone, r[sd.key], strong) }}
        >
          {fmt(r, r[sd.key])}
        </td>
      ))}
    </tr>
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
