/** Ảnh cưới (đã nén, nằm trong public/photos) và ngày cưới. */

export const WEDDING_DATE = new Date(2026, 11, 20) // 20/12/2026
export const WEDDING_DATE_TEXT = '20 . 12 . 2026'

export const GATE_PHOTO = { src: '/photos/cong-cuoi.jpg', sm: '/photos/cong-cuoi-sm.jpg' }

/** Ảnh cổng đã cắt lại cho khung vòm (tỉ lệ 7:10, hai người ở giữa khung) */
export const ARCH_PHOTO = { src: '/photos/vom.jpg', sm: '/photos/vom-sm.jpg' }

/** Ảnh dùng trong khung vòm ở thẻ đầu trang Tổng hợp */
export const HERO_PHOTO = { src: '/photos/anh-02.jpg', sm: '/photos/anh-02-sm.jpg' }

export const ALBUM = Array.from({ length: 12 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0')
  return { src: `/photos/anh-${n}.jpg`, sm: `/photos/anh-${n}-sm.jpg` }
})

/** Số ngày còn lại tới ngày cưới (0 = hôm nay, âm = đã qua). */
export function daysUntilWedding(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((WEDDING_DATE.getTime() - today.getTime()) / 86_400_000)
}
