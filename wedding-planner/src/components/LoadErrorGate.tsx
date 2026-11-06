import { useState } from 'react'
import { storageLoadError, useAppStore } from '../store/useAppStore'
import { MODAL_PANEL, Modal } from './Modal'

/** Dữ liệu trong localStorage hỏng / sai phiên bản → bắt buộc khôi phục dữ liệu gốc. */
export function LoadErrorGate() {
  const [err, setErr] = useState(storageLoadError)
  const reset = useAppStore((s) => s.resetToSeed)
  if (!err) return null
  return (
    // Không có onClose: bắt buộc chọn khôi phục
    <Modal label="Không đọc được dữ liệu đã lưu" z={80}>
      <div className={`${MODAL_PANEL} max-w-md p-6`}>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-[#2b2326]">Không đọc được dữ liệu đã lưu</h2>
        <p className="mt-2 overflow-y-auto text-[14px] whitespace-pre-line text-gray-600">{err}</p>
        <button
          className="mt-6 h-12 w-full shrink-0 rounded-2xl bg-gradient-to-b from-[#9b3352] to-[#7d2640] font-semibold text-white shadow-md shadow-wine/25 transition active:scale-[.98]"
          onClick={() => {
            reset()
            setErr(null)
          }}
        >
          Khôi phục dữ liệu gốc
        </button>
      </div>
    </Modal>
  )
}
