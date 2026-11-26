import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { create } from 'zustand'
import { ApiError, streamChat, type ChatBlock, type ChatTurn } from '../lib/api'
import { applyChanges, describeChanges, proposalSchema, type Change } from '../lib/chatTools'
import { buildChatContext } from '../lib/chatContext'
import { HERO_PHOTO } from '../lib/photos'
import { useAuth } from '../store/ui'
import { useAppStore } from '../store/useAppStore'
import { useSync } from '../store/sync'
import { useIsDesktop } from './Common'

const SUGGESTIONS = [
  'Tóm tắt tình hình chuẩn bị đám cưới giúp anh',
  'Còn những công việc nào chưa làm hoặc chưa trả hết tiền?',
  'Nhà Gái có những khách nào cần kiểm tra lại?',
  'Tổng chi phí hiện tại là bao nhiêu, mỗi nhà chịu bao nhiêu?',
  'Đánh dấu đã viết thiệp cho khách số 1 đến 10 Nhà Trai',
]
const QUICK = ['Còn bao nhiêu ngày nữa?', 'Việc nào cần làm gấp?', 'Tiền mừng đã bù được bao nhiêu?', 'Mỗi nhà bao nhiêu bàn?']

/** Những gì hiện trong khung chat */
type Item =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string; error?: boolean }
  | {
      kind: 'proposal'
      toolUseIds: string[]
      summary?: string
      changes: Change[]
      status: 'pending' | 'applied' | 'rejected'
      result?: string
    }

const SPARKLE = 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z'

// ---------- Trạng thái cuộc trò chuyện (giữ lại khi đóng / mở khung chat) ----------
// items: để hiển thị; history: gửi cho Claude đúng định dạng Messages API (gồm cả tool_use / tool_result)
type ChatState = { items: Item[]; history: ChatTurn[]; busy: boolean }
const useChat = create<ChatState>(() => ({ items: [], history: [], busy: false }))
let abortCtrl: AbortController | null = null

const pendingProposal = (items: Item[]) => items.find((i) => i.kind === 'proposal' && i.status === 'pending')

/** Gọi Claude với lịch sử hiện tại; xử lý câu trả lời (chữ và/hoặc đề xuất thay đổi). */
async function runTurn() {
  const ctrl = new AbortController()
  abortCtrl = ctrl
  useChat.setState((s) => ({ busy: true, items: [...s.items, { kind: 'assistant', text: '' }] }))
  const setLastText = (fn: (t: string) => string) =>
    useChat.setState((s) => {
      const items = [...s.items]
      const last = items[items.length - 1]
      if (last?.kind === 'assistant') items[items.length - 1] = { ...last, text: fn(last.text) }
      return { items }
    })
  try {
    // Luôn gửi dữ liệu mới nhất tại thời điểm hỏi
    const context = buildChatContext(useAppStore.getState().data)
    const history = useChat.getState().history.slice(-40)
    while (history.length && (history[0].role !== 'user' || typeof history[0].content !== 'string')) history.shift()
    const final = await streamChat(useAuth.getState().token ?? '', history, context, (t) => setLastText((x) => x + t), ctrl.signal)
    if (!final) throw new ApiError('Không nhận được câu trả lời, thử lại nhé', 500)
    useChat.setState((s) => ({ history: [...s.history, { role: 'assistant', content: final.content }] }))

    const uses = final.content.filter((b): b is ChatBlock & { id: string; input: unknown } => b.type === 'tool_use')
    if (uses.length) {
      const changes: Change[] = []
      const problems: string[] = []
      let summary: string | undefined
      for (const u of uses) {
        const p = proposalSchema.safeParse(u.input)
        if (p.success) {
          changes.push(...p.data.changes)
          summary ??= p.data.summary
        } else problems.push(p.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
      }
      if (problems.length || final.stop_reason === 'max_tokens') {
        // Đề xuất sai định dạng → báo lại cho Claude để nó sửa, không hiện thẻ
        const msg = final.stop_reason === 'max_tokens' ? 'Đề xuất bị cắt vì quá dài, hãy chia nhỏ (tối đa ~150 thay đổi mỗi lần).' : `Đề xuất không hợp lệ: ${problems.join(' | ')}`
        useChat.setState((s) => ({
          history: [...s.history, { role: 'user', content: uses.map((u) => ({ type: 'tool_result', tool_use_id: u.id, content: msg, is_error: true })) }],
        }))
        dropEmptyAssistant()
        return await runTurn()
      }
      dropEmptyAssistant()
      useChat.setState((s) => ({ items: [...s.items, { kind: 'proposal', toolUseIds: uses.map((u) => u.id), summary, changes, status: 'pending' }] }))
    } else dropEmptyAssistant()
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      dropEmptyAssistant()
      // Dừng giữa chừng: bỏ câu hỏi chưa được trả lời khỏi lịch sử để lượt sau không lỗi
      useChat.setState((s) => (s.history.at(-1)?.role === 'user' ? { history: s.history.slice(0, -1) } : {}))
    } else {
      const msg = e instanceof ApiError ? e.message : 'Có lỗi xảy ra, thử lại nhé.'
      setLastText(() => msg)
      useChat.setState((s) => {
        const items = [...s.items]
        const last = items[items.length - 1]
        if (last?.kind === 'assistant') items[items.length - 1] = { ...last, error: true }
        // bỏ lượt người dùng chưa được trả lời khỏi lịch sử
        return { items, history: s.history.at(-1)?.role === 'user' ? s.history.slice(0, -1) : s.history }
      })
    }
  } finally {
    if (abortCtrl === ctrl) {
      abortCtrl = null
      useChat.setState({ busy: false })
    }
  }
}

function dropEmptyAssistant() {
  useChat.setState((s) => {
    const last = s.items[s.items.length - 1]
    return last?.kind === 'assistant' && !last.text.trim() ? { items: s.items.slice(0, -1) } : {}
  })
}

async function ask(text: string) {
  const q = text.trim()
  const { busy, items } = useChat.getState()
  if (!q || busy || pendingProposal(items)) return
  useChat.setState((s) => ({ items: [...s.items, { kind: 'user', text: q }], history: [...s.history, { role: 'user', content: q }] }))
  await runTurn()
}

/** Người dùng bấm Áp dụng / Không trên thẻ đề xuất. */
async function decide(apply: boolean) {
  const { items } = useChat.getState()
  const p = pendingProposal(items)
  if (!p || p.kind !== 'proposal') return
  // Giữ lại mô tả "cũ → mới" theo dữ liệu TRƯỚC khi sửa để thẻ hiện đúng sau khi áp dụng
  frozen.set(p.changes, describeChanges(useAppStore.getState().data, p.changes))
  let result: string
  if (apply) {
    const r = applyChanges(p.changes)
    result = r.errors.length
      ? `Đã áp dụng ${r.applied}/${p.changes.length} thay đổi (dữ liệu kế hoạch ở lượt này đã được cập nhật). Không áp dụng được: ${r.errors.join('; ')}`
      : `Người dùng đã bấm Áp dụng. Đã áp dụng thành công ${r.applied}/${p.changes.length} thay đổi. (Dữ liệu kế hoạch ở lượt này đã được cập nhật — là dữ liệu SAU khi sửa.)`
  } else result = 'Người dùng bấm "Không" — không thay đổi gì.'
  useChat.setState((s) => ({
    items: s.items.map((i) => (i === p ? { ...p, status: apply ? 'applied' : 'rejected', result } : i)),
    history: [...s.history, { role: 'user', content: p.toolUseIds.map((id) => ({ type: 'tool_result', tool_use_id: id, content: result })) }],
  }))
  await runTurn()
}

const stop = () => abortCtrl?.abort()
const resetChat = () => {
  stop()
  abortCtrl = null
  useChat.setState({ items: [], history: [], busy: false })
}

/**
 * Trên điện thoại: theo dõi phần màn hình còn nhìn thấy (trừ bàn phím) để khung chat
 * luôn vừa khít phía trên bàn phím — quan trọng với PWA trên iPhone.
 */
function useVisibleViewport(enabled: boolean) {
  const [vp, setVp] = useState<{ h: number; top: number; keyboard: boolean } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!enabled || !vv) return setVp(null)
    const update = () => setVp({ h: vv.height, top: vv.offsetTop, keyboard: window.innerHeight - vv.height > 120 })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])
  return vp
}

/** Trợ lý Claude: nút nổi + khung chat, đọc dữ liệu kế hoạch hiện tại. */
export function ChatBot() {
  const ready = useSync((s) => s.status === 'ready')
  const busy = useChat((s) => s.busy)
  const [open, setOpen] = useState(false)
  if (!ready) return null
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Hỏi trợ lý Claude"
          className="fixed bottom-[84px] left-4 z-30 flex h-12 items-center gap-1.5 rounded-full bg-gradient-to-br from-[#a83a5b] to-[#7d2640] pr-4 pl-3 text-white shadow-lg shadow-wine/30 ring-2 ring-[#f3d9a4]/70 transition hover:brightness-110 active:scale-95 md:right-6 md:bottom-6 md:left-auto md:h-14 md:gap-2 md:pr-5 md:pl-4"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#f3d9a4" className={busy ? 'animate-pulse' : ''}>
            <path d={SPARKLE} />
          </svg>
          <span className="text-[14px] font-semibold">
            Hỏi<span className="hidden md:inline"> trợ lý</span>
          </span>
        </button>
      )}
      {open && <ChatPanel onClose={() => setOpen(false)} />}
    </>
  )
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const { items, busy } = useChat()
  const pending = Boolean(pendingProposal(items))
  const desktop = useIsDesktop()
  const vp = useVisibleViewport(!desktop)
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Tự cuộn theo chữ mới — trừ khi người dùng đang kéo lên đọc lại đoạn trên
  const stickRef = useRef(true)
  const lastCount = useRef(items.length)
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    if (items.length > lastCount.current) stickRef.current = true // có tin nhắn / thẻ mới
    lastCount.current = items.length
    if (stickRef.current) el.scrollTop = el.scrollHeight
  }, [items, busy, vp?.h])

  useEffect(() => {
    // Máy tính: đặt sẵn con trỏ vào ô nhập. Điện thoại: không, để bàn phím không che câu gợi ý.
    if (desktop) inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // Điện thoại: khoá cuộn trang phía sau khi đang mở chat
    const prev = document.body.style.overflow
    if (!desktop) document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, desktop])

  const send = (text: string) => {
    if (!text.trim() || busy || pending) return
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    ask(text)
  }

  // Điện thoại: khung chat = đúng phần màn hình còn thấy (phía trên bàn phím)
  const mobileStyle: CSSProperties | undefined = vp ? { top: vp.top, height: vp.h, bottom: 'auto' } : undefined
  const lastIsDone = items.length > 0 && !busy && !pending

  return (
    <div
      role="dialog"
      aria-label="Trợ lý Claude"
      style={mobileStyle}
      className="anim-sheet fixed inset-x-0 top-0 bottom-0 z-[60] flex flex-col bg-[#fbf6f1] md:inset-auto md:right-6 md:bottom-6 md:h-[min(680px,calc(100dvh-110px))] md:w-[420px] md:overflow-hidden md:rounded-[28px] md:border md:border-[#ead9c4] md:shadow-[0_30px_70px_-25px_rgba(80,25,45,.55)]"
    >
      {/* Đầu khung */}
      <div
        className="flex shrink-0 items-center gap-2.5 bg-gradient-to-r from-[#8e2c48] to-[#6f1f37] px-2 py-2 text-white md:gap-3 md:px-4 md:py-3"
        style={{ paddingTop: desktop || vp?.keyboard ? undefined : 'max(8px, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 active:bg-white/15 md:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <img src={HERO_PHOTO.sm} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover object-[50%_20%] ring-2 ring-[#f3d9a4]/80 md:h-10 md:w-10" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-[17px] font-semibold text-[#f3d9a4]">Trợ lý đám cưới</div>
          <div className="truncate text-[11.5px] text-white/70">{busy ? 'Đang trả lời…' : pending ? 'Chờ anh chị xác nhận thay đổi' : 'Claude · đọc & sửa dữ liệu kế hoạch'}</div>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={resetChat}
            className="h-9 shrink-0 rounded-full border border-white/25 px-3 text-[12.5px] text-white/90 transition hover:bg-white/10 active:bg-white/15"
          >
            Cuộc mới
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Đóng" className="hidden h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/10 md:flex">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Tin nhắn */}
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stickRef.current = el.scrollHeight - el.clientHeight - el.scrollTop < 80
        }}
        className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 md:px-4"
      >
        {items.length === 0 ? (
          <div className="pt-2 text-center md:pt-4">
            <svg className="mx-auto" width="32" height="32" viewBox="0 0 24 24" fill="#c79a4b">
              <path d={SPARKLE} />
            </svg>
            <p className="mt-2 font-display text-[20px] font-bold text-wine">Anh chị cần hỏi gì ạ?</p>
            <p className="mx-auto mt-1 max-w-[300px] text-[13px] text-gray-500">
              Em đọc toàn bộ khách mời, khẩu phần ăn, công việc để trả lời — và có thể sửa giúp, anh chị chỉ cần bấm xác nhận.
            </p>
            <div className="mt-5 grid gap-2 text-left">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="flex items-center gap-2.5 rounded-2xl border border-[#ead9c4] bg-white/85 px-3.5 py-3 text-[14px] text-[#4a3f43] transition hover:border-[#d9b87a] hover:bg-white active:scale-[.99]"
                >
                  <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="#c79a4b">
                    <path d={SPARKLE} />
                  </svg>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          items.map((m, i) =>
            m.kind === 'user' ? (
              <div key={i} className="flex justify-end pl-10">
                <div className="rounded-[20px] rounded-br-md bg-wine px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap text-white shadow-sm">{m.text}</div>
              </div>
            ) : m.kind === 'proposal' ? (
              <ProposalCard key={i} p={m} />
            ) : (
              <div key={i} className="flex items-end gap-2 pr-4">
                <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3e7da]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#a8783a">
                    <path d={SPARKLE} />
                  </svg>
                </span>
                <div
                  className={`min-w-0 rounded-[20px] rounded-bl-md border px-3.5 py-2.5 text-[15px] leading-relaxed ${
                    m.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-[#efe2d6] bg-white text-[#2b2326] shadow-sm'
                  }`}
                >
                  {m.text ? <RichText text={m.text} /> : <TypingDots />}
                </div>
              </div>
            ),
          )
        )}
      </div>

      {/* Ô nhập */}
      <form
        className="shrink-0 border-t border-[#eee0d2] bg-[#fbf6f1]/95 px-3 pt-2 backdrop-blur"
        style={{ paddingBottom: desktop ? 12 : vp?.keyboard ? 8 : 'max(10px, env(safe-area-inset-bottom))' }}
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        {lastIsDone && (
          <div className="-mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="shrink-0 rounded-full border border-[#ead9c4] bg-white px-3 py-1.5 text-[12.5px] whitespace-nowrap text-[#6b5a4a] active:bg-[#f6ece2]"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-[22px] border border-[#e8dccf] bg-white py-1.5 pr-1.5 pl-3.5 focus-within:border-wine focus-within:shadow-[0_0_0_4px_rgba(142,44,72,.1)]">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            enterKeyHint="send"
            disabled={pending}
            placeholder={pending ? 'Bấm “Áp dụng” hoặc “Không” ở trên trước nhé' : 'Hỏi hoặc nhờ sửa khách mời, chi phí, công việc…'}
            onChange={(e) => {
              setInput(e.target.value)
              const el = e.target
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
            onKeyDown={(e) => {
              // Máy tính: Enter để gửi, Shift+Enter xuống dòng. Điện thoại: dùng nút gửi.
              if (desktop && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send(input)
              }
            }}
            className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent py-1.5 text-[16px] leading-snug outline-none placeholder:text-[#b5a9ad] md:text-[15px]"
          />
          {busy ? (
            <button type="button" onClick={stop} aria-label="Dừng" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3e7da] text-wine">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || pending}
              aria-label="Gửi"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wine text-white transition active:scale-95 disabled:opacity-30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>
        {!vp?.keyboard && <p className="mt-1.5 text-center text-[10.5px] text-gray-400">Trợ lý có thể nhầm — kiểm tra lại số liệu quan trọng trên các trang.</p>}
      </form>
    </div>
  )
}

const KIND_STYLE = {
  add: { mark: '+', cls: 'bg-[#eef7e8] text-[#3f7d20]' },
  update: { mark: '✎', cls: 'bg-[#f6ece2] text-[#9a7432]' },
  delete: { mark: '−', cls: 'bg-red-50 text-red-600' },
} as const

/** Thẻ đề xuất thay đổi: danh sách thay đổi + nút Áp dụng / Không. */
function ProposalCard({ p }: { p: Extract<Item, { kind: 'proposal' }> }) {
  const data = useAppStore((s) => s.data)
  const busy = useChat((s) => s.busy)
  // Thẻ đang chờ: mô tả theo dữ liệu hiện tại (thấy giá trị cũ → mới, phát hiện dòng không khớp)
  const lines = proposalLines(p, data)
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? lines : lines.slice(0, 8)
  const bad = lines.filter((l) => l.error).length
  const deletes = p.changes.filter((c) => c.action.startsWith('delete')).length
  return (
    <div className="rounded-[22px] border border-[#e6d2b5] bg-gradient-to-b from-[#fffaf3] to-white p-3.5 shadow-[0_10px_30px_-20px_rgba(120,70,40,.6)]">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-wine text-[13px] text-white">✎</span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[15.5px] font-bold text-wine">Đề xuất {p.changes.length} thay đổi</div>
          {p.summary && <div className="text-[12.5px] leading-snug text-gray-500">{p.summary}</div>}
        </div>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {shown.map((l, i) => (
          <li key={i} className={`flex gap-2 rounded-xl px-2 py-1.5 text-[13px] leading-snug ${l.error ? 'bg-red-50' : 'bg-white/70'}`}>
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[12px] font-bold ${KIND_STYLE[l.kind].cls}`}>
              {KIND_STYLE[l.kind].mark}
            </span>
            <span className="min-w-0">
              <span className="font-semibold text-[#2b2326]">{l.title}</span>
              {l.detail && <span className="block text-gray-500">{l.detail}</span>}
              {l.error && <span className="block text-red-600">⚠ {l.error}</span>}
            </span>
          </li>
        ))}
      </ul>
      {lines.length > 8 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1.5 text-[12.5px] font-medium text-wine underline">
          {showAll ? 'Thu gọn' : `Xem thêm ${lines.length - 8} thay đổi`}
        </button>
      )}
      {p.status === 'pending' ? (
        <>
          {(bad > 0 || deletes > 0) && (
            <p className="mt-2 text-[12px] text-[#9a5a1a]">
              {deletes > 0 && `Có ${deletes} thao tác xoá. `}
              {bad > 0 && `${bad} thay đổi không khớp dữ liệu sẽ được bỏ qua.`}
            </p>
          )}
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              disabled={busy || bad === lines.length}
              onClick={() => decide(true)}
              className="h-11 rounded-2xl bg-gradient-to-b from-[#9b3352] to-[#7d2640] text-[14.5px] font-semibold text-white shadow-md shadow-wine/20 transition active:scale-[.98] disabled:opacity-40"
            >
              Áp dụng {lines.length - bad} thay đổi
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide(false)}
              className="h-11 rounded-2xl border border-[#e3cfb2] bg-white px-4 text-[14px] font-medium text-[#6b5a4a] transition active:bg-[#f6ece2] disabled:opacity-40"
            >
              Không
            </button>
          </div>
        </>
      ) : (
        <div className={`mt-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium ${p.status === 'applied' ? 'bg-[#eef7e8] text-[#3f7d20]' : 'bg-gray-100 text-gray-500'}`}>
          {p.status === 'applied' ? '✓ ' : ''}
          {p.result?.replace('Người dùng đã bấm Áp dụng. ', '').replace(/ ?\(Dữ liệu kế hoạch[^)]*\)/i, '').replace(/ ?\(dữ liệu kế hoạch[^)]*\)/i, '').replace('Người dùng bấm "Không" — ', 'Đã bỏ qua — ')}
        </div>
      )}
    </div>
  )
}

/** Mô tả thay đổi — thẻ đã xử lý thì giữ nguyên mô tả lúc xử lý (không tính lại theo dữ liệu mới). */
const frozen = new WeakMap<object, ReturnType<typeof describeChanges>>()
function proposalLines(p: Extract<Item, { kind: 'proposal' }>, data: ReturnType<typeof useAppStore.getState>['data']) {
  const cached = frozen.get(p.changes)
  if (cached) return cached
  return describeChanges(data, p.changes)
}

function TypingDots() {
  return (
    <span className="flex gap-1 py-1.5" aria-label="Đang trả lời">
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-[#c79a4b]" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  )
}

/** Hiển thị chữ có **đậm**, _nghiêng_ và gạch đầu dòng "- " (không dùng innerHTML). */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="my-1 list-disc space-y-0.5 pl-5 marker:text-[#c79a4b]">
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      )
      list = []
    }
  }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    if (bullet) {
      list.push(bullet[1])
      continue
    }
    flush()
    if (!line.trim()) continue
    blocks.push(
      <p key={blocks.length} className="my-1 first:mt-0 last:mb-0">
        {inline(line.replace(/^#+\s*/, ''))}
      </p>,
    )
  }
  flush()
  return <>{blocks}</>
}

function inline(s: string): ReactNode {
  // **đậm** và _nghiêng_
  // _nghiêng_ chỉ khi dấu _ không dính chữ/số (để ANTHROPIC_API_KEY không bị hiểu nhầm)
  const parts = s.split(/(\*\*[^*]+\*\*|(?<![\p{L}\p{N}])_[^_\n]+_(?![\p{L}\p{N}]))/gu)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
      <strong key={i} className="font-semibold text-wine">
        {p.slice(2, -2)}
      </strong>
    ) : p.startsWith('_') && p.endsWith('_') && p.length > 2 ? (
      <em key={i} className="text-gray-500">
        {p.slice(1, -1)}
      </em>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  )
}
