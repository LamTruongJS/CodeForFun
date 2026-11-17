import { useCallback, useEffect, useRef, useState } from 'react'
import { ALBUM } from '../lib/photos'
import { Modal } from './Modal'

/** Album ảnh cưới: lưới ảnh nhỏ, bấm vào xem ảnh lớn (← → / vuốt để chuyển, Esc để đóng). */
export function Album() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between px-1">
        <div>
          <h2 className="font-display text-[22px] leading-tight font-bold text-wine md:text-[26px]">Album cưới</h2>
          <p className="text-[13px] text-gray-500">Lâm Trường ♥ Lệ Huyền</p>
        </div>
        <span className="text-[12px] text-gray-400">{ALBUM.length} ảnh</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:gap-3 lg:grid-cols-6">
        {ALBUM.map((p, i) => (
          <button
            key={p.src}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative aspect-[2/3] overflow-hidden rounded-xl bg-[#f3ebe3] md:rounded-2xl"
            aria-label={`Xem ảnh ${i + 1}`}
          >
            <img
              src={p.sm}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition group-hover:opacity-100" />
          </button>
        ))}
      </div>
      {open != null && <Lightbox index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  )
}

function Lightbox({ index, onIndex, onClose }: { index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const go = useCallback((d: number) => onIndex((index + d + ALBUM.length) % ALBUM.length), [index, onIndex])
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  // tải sẵn ảnh kế bên cho chuyển ảnh mượt
  useEffect(() => {
    for (const d of [1, -1]) new Image().src = ALBUM[(index + d + ALBUM.length) % ALBUM.length].src
  }, [index])

  const p = ALBUM[index]
  const arrow = (d: 1 | -1) => (
    <button
      type="button"
      onClick={() => go(d)}
      aria-label={d > 0 ? 'Ảnh sau' : 'Ảnh trước'}
      className={`absolute top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 md:flex ${d > 0 ? 'right-4' : 'left-4'}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d > 0 ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
      </svg>
    </button>
  )

  return (
    <Modal label="Xem ảnh" onClose={onClose} z={90}>
      <div
        className="fixed inset-0 flex items-center justify-center bg-[#140a0e]/95"
        onClick={onClose}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        }}
      >
        <img
          key={p.src}
          src={p.src}
          alt={`Ảnh cưới ${index + 1}`}
          className="anim-dialog max-h-[92dvh] max-w-[94vw] rounded-lg object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <div onClick={(e) => e.stopPropagation()}>
          {arrow(-1)}
          {arrow(1)}
        </div>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-[13px] text-white backdrop-blur">
          {index + 1} / {ALBUM.length}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </Modal>
  )
}
