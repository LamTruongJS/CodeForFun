import { useRef, useState } from 'react'
import { Btn, PageTitle } from '../components/Common'
import { fmtDateTime, todayStamp } from '../lib/format'
import { parseImport } from '../lib/schema'
import { confirmDialog, toast } from '../store/ui'
import { useAppStore } from '../store/useAppStore'

export function DataPage() {
  const data = useAppStore((s) => s.data)
  const { replaceData, resetToSeed } = useAppStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importErr, setImportErr] = useState('')
  const [saving, setSaving] = useState(false)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ke-hoach-dam-cuoi-${todayStamp()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const onFile = async (file: File) => {
    setImportErr('')
    let raw: unknown
    try {
      raw = JSON.parse(await file.text())
    } catch {
      setImportErr('File không phải JSON hợp lệ.')
      return
    }
    const r = parseImport(raw)
    if (!r.ok) {
      setImportErr('File sai cấu trúc, dữ liệu hiện tại không thay đổi:\n' + r.error)
      return
    }
    const ok = await confirmDialog({
      title: 'Nhập dữ liệu?',
      message: `Dữ liệu hiện tại sẽ bị thay thế.\n\nFile có ${r.data.guests.length} khách, ${r.data.tasks.length} công việc, ${r.data.cateringItems.length} hạng mục.`,
      okText: 'Thay thế',
      danger: true,
    })
    if (ok) {
      replaceData(r.data)
      toast('Đã nhập dữ liệu', 'success')
    }
  }

  const reset = async () => {
    if (
      await confirmDialog({
        title: 'Khôi phục dữ liệu gốc?',
        message: 'Toàn bộ dữ liệu hiện tại sẽ bị xóa và nạp lại từ seed-data.json. Nên Xuất JSON trước để sao lưu.',
        okText: 'Khôi phục',
        danger: true,
      })
    ) {
      resetToSeed()
      toast('Đã khôi phục dữ liệu gốc', 'success')
    }
  }

  const saveToSeedFile = async () => {
    setSaving(true)
    try {
      const res = await fetch('/__dev/save-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(await res.text())
      toast('Đã ghi vào src/data/seed-data.json', 'success')
    } catch (e) {
      toast('Ghi file thất bại: ' + String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <PageTitle>DỮ LIỆU</PageTitle>
      <p className="mb-4 text-sm text-gray-500">Lần lưu gần nhất: {fmtDateTime(data.updatedAt)}</p>

      <div className="space-y-3">
        <Card title="Xuất JSON" desc="Tải về toàn bộ dữ liệu hiện tại để sao lưu hoặc chuyển sang máy khác.">
          <Btn onClick={exportJson}>⬇️ Xuất JSON</Btn>
        </Card>

        <Card title="Nhập JSON" desc="Chọn file .json (file đã xuất hoặc seed-data.json gốc). Dữ liệu hiện tại sẽ bị thay thế.">
          <Btn variant="outline" onClick={() => fileRef.current?.click()}>
            ⬆️ Chọn file JSON
          </Btn>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
          />
          {importErr && <pre className="mt-3 rounded-lg bg-red-50 p-3 text-sm whitespace-pre-wrap text-red-700">{importErr}</pre>}
        </Card>

        <Card title="Khôi phục dữ liệu gốc" desc="Xóa dữ liệu hiện tại và nạp lại từ seed-data.json.">
          <Btn variant="danger" onClick={reset}>
            ↺ Khôi phục dữ liệu gốc
          </Btn>
        </Card>

        {import.meta.env.DEV && (
          <Card
            title="Ghi trực tiếp vào file seed-data.json (chỉ khi chạy local)"
            desc="Chỉ hoạt động khi chạy `npm run dev` trên máy. Ghi dữ liệu hiện tại vào src/data/seed-data.json để commit lên GitHub — lần deploy sau, web sẽ dùng dữ liệu này làm dữ liệu gốc."
          >
            <Btn variant="outline" onClick={saveToSeedFile}>
              {saving ? 'Đang ghi…' : '💾 Ghi vào seed-data.json'}
            </Btn>
          </Card>
        )}

        <p className="text-xs text-gray-400">
          Dữ liệu được lưu trong trình duyệt (localStorage) của máy này. Mở trên máy / trình duyệt khác sẽ không thấy — hãy dùng Xuất/Nhập JSON để chuyển.
        </p>
      </div>
    </div>
  )
}

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4" style={{ borderLeft: '4px solid #7F6000' }}>
      <h2 className="font-bold">{title}</h2>
      <p className="mt-0.5 mb-3 text-sm text-gray-500">{desc}</p>
      {children}
    </div>
  )
}
