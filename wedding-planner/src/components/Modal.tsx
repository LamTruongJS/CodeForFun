import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Khung chung cho mọi popup: nền trắng, bo góc, giữa màn hình. */
export const MODAL_PANEL = 'anim-dialog flex max-h-[calc(100dvh-32px)] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl'

let openCount = 0 // khóa cuộn trang khi có ít nhất 1 popup đang mở (popup lồng nhau)

/**
 * Popup dùng chung: luôn nằm giữa màn hình trên cả điện thoại và máy tính.
 * Đóng bằng Esc hoặc bấm ra ngoài (nếu có onClose).
 */
export function Modal({
  label,
  onClose,
  children,
  z = 50,
}: {
  label: string
  onClose?: () => void
  children: ReactNode
  z?: number
}) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    openCount++
    document.body.style.overflow = 'hidden'
    return () => {
      openCount--
      if (openCount === 0) document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !closeRef.current) return
      // chỉ popup trên cùng xử lý Esc
      const all = document.querySelectorAll('[data-modal]')
      if (all[all.length - 1] === ref.current) {
        e.stopPropagation()
        closeRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const ref = useRef<HTMLDivElement>(null)

  return createPortal(
    <div
      ref={ref}
      data-modal
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 flex items-center justify-center bg-[#2b1a20]/45 p-4 backdrop-blur-[2px]"
      style={{ zIndex: z }}
      onClick={() => onClose?.()}
    >
      <div className="contents" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ModalClose({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200"
      aria-label="Đóng"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  )
}
