import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageTitle, useIsDesktop } from '../components/Common'
import { summary, taskCostBySide } from '../lib/calc'
import { fmtInt, fmtMoney } from '../lib/format'
import { useAppStore } from '../store/useAppStore'

export function SummaryPage() {
  const data = useAppStore((s) => s.data)
  const rows = useMemo(() => summary(data), [data])
  const unassigned = useMemo(() => taskCostBySide(data.tasks).unassignedCount, [data.tasks])
  const desktop = useIsDesktop()
  const done = data.tasks.filter((t) => t.status === 'DA_LAM').length

  const cell = (v: number, kind: 'count' | 'money', red?: boolean) => (
    <span className={`num ${red && v < 0 ? 'text-red-600' : ''}`}>{kind === 'money' ? fmtMoney(v) : fmtInt(v)}</span>
  )

  return (
    <div>
      <PageTitle>Tổng hợp</PageTitle>

      {unassigned > 0 && (
        <Link to="/tasks" className="mb-4 block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          ⚠️ Có {unassigned} công việc chưa chọn Bên, chưa được tính vào chi phí.
        </Link>
      )}

      {!desktop ? (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.stt}
              className="rounded-2xl border border-[#efe5e9] p-3.5 shadow-[0_1px_3px_rgba(80,30,45,.06)]"
              style={{ background: r.highlight ? 'linear-gradient(135deg,#fbe9ee,#f3d3dc)' : '#fff', borderColor: r.highlight ? '#ecc3cf' : undefined }}
            >
              <div className={`mb-2 text-[14px] leading-snug ${r.highlight ? 'font-bold text-wine' : 'font-medium text-[#2b2326]'}`}>
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#f6eef1] text-[11px] font-semibold text-wine/70">{r.stt}</span>
                {r.label}
              </div>
              <div className="grid grid-cols-3 gap-1 text-right">
                {(['TRAI', 'GAI', 'total'] as const).map((k) => (
                  <div key={k} className={k === 'total' ? 'border-l border-gray-300 pl-1' : ''}>
                    <div className="text-[11px] text-gray-400">{k === 'TRAI' ? 'Nhà Trai' : k === 'GAI' ? 'Nhà Gái' : 'Tổng cộng'}</div>
                    <div className={`text-[15px] ${k === 'total' || r.highlight ? 'font-bold' : 'font-medium'}`}>{cell(r[k], r.kind, r.negativeRed)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="overflow-x-auto rounded-xl shadow-sm">
        <table className="tbl text-[15px] md:text-base">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th className="text-left">Hạng mục</th>
              <th>Nhà Trai</th>
              <th>Nhà Gái</th>
              <th>Tổng cộng</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const bg = r.highlight ? { background: '#F3D3DC', fontWeight: 700 } : undefined
              return (
                <tr key={r.stt}>
                  <td className="pad text-center text-gray-500" style={bg}>
                    {r.stt}
                  </td>
                  <td className="pad min-w-[9rem]" style={bg}>
                    {r.label}
                  </td>
                  <td className="pad text-right whitespace-nowrap" style={bg}>
                    {cell(r.TRAI, r.kind, r.negativeRed)}
                  </td>
                  <td className="pad text-right whitespace-nowrap" style={bg}>
                    {cell(r.GAI, r.kind, r.negativeRed)}
                  </td>
                  <td className="pad text-right font-bold whitespace-nowrap" style={bg}>
                    {cell(r.total, r.kind, r.negativeRed)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickLink to="/guests/trai" color="#2E75B6" title="Khách Nhà Trai" value={`${rows[0].TRAI} lượt mời`} />
        <QuickLink to="/guests/gai" color="#C0504D" title="Khách Nhà Gái" value={`${rows[0].GAI} lượt mời`} />
        <QuickLink to="/catering" color="#70AD47" title="Số bàn" value={`${rows[5].total} bàn`} />
        <QuickLink to="/tasks" color="#ED7D31" title="Công việc" value={`${done}/${data.tasks.length} đã làm`} />
      </div>
    </div>
  )
}

function QuickLink({ to, color, title, value }: { to: string; color: string; title: string; value: string }) {
  return (
    <Link to={to} className="rounded-2xl border border-[#efe5e9] bg-white p-3.5 shadow-[0_1px_3px_rgba(80,30,45,.06)] transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-1.5 text-[13px] text-gray-500"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{title}</div>
      <div className="mt-0.5 text-lg font-bold" style={{ color }}>
        {value}
      </div>
    </Link>
  )
}
