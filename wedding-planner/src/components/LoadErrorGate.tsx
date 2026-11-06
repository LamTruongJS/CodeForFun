import { useState } from 'react'
import { storageLoadError, useAppStore } from '../store/useAppStore'

/** Dữ liệu trong localStorage hỏng / sai phiên bản → bắt buộc khôi phục dữ liệu gốc. */
export function LoadErrorGate() {
  const [err, setErr] = useState(storageLoadError)
  const reset = useAppStore((s) => s.resetToSeed)
  if (!err) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-red-700">Không đọc được dữ liệu đã lưu</h2>
        <p className="mt-2 text-sm whitespace-pre-line text-gray-700">{err}</p>
        <button
          className="mt-4 w-full rounded-lg bg-wine px-4 py-2.5 font-bold text-white"
          onClick={() => {
            reset()
            setErr(null)
          }}
        >
          Khôi phục dữ liệu gốc
        </button>
      </div>
    </div>
  )
}
