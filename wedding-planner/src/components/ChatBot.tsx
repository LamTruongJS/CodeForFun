import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { create } from 'zustand'
import { ApiError, streamChat, type ChatTurn } from '../lib/api'
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
]
const QUICK = ['Còn bao nhiêu ngày nữa?', 'Việc nào cần làm gấp?', 'Tiền mừng đã bù được bao nhiêu?', 'Mỗi nhà bao nhiêu bàn?']

type Msg = ChatTurn & { error?: boolean }

const SPARKLE = 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z'

// ---------- Trạng thái cuộc trò chuyện (giữ lại khi đóng / mở khung chat) ----------
type ChatState = { msgs: Msg[]; busy: boolean }
const useChat = create<ChatState>(() => ({ msgs: [], busy: false }))
let abortCtrl: AbortController | null = null

function setLastAssistant(fn: (m: Msg) => Msg) {
  useChat.setState((s) => ({ msgs: [...s.msgs.slice(0, -1), fn(s.msgs[s.msgs.length - 1])] }))
}

async function ask(text: string) {
  const q = text.trim()
  const { msgs, busy } = useChat.getState()
  if (!q || busy) return
  // Lịch sử gửi đi: bỏ câu trả lời lỗi (và câu hỏi đi kèm) để hội thoại luôn xen kẽ user/assistant
  const history: ChatTurn[] = []
  for (const m of msgs) {
    if (m.error) history.pop()
    else history.push({ role: m.role, content: m.content })
  }
  const turns: ChatTurn[] = [...history, { role: 'user' as const, content: q }].slice(-20)
  if (turns[0].role !== 'user') turns.shift()

  useChat.setState({ msgs: [...msgs, { role: 'user', content: q }, { role: 'assistant', content: '' }], busy: true })
  const ctrl = new AbortController()
  abortCtrl = ctrl
  try {
    // Luôn gửi dữ liệu mới nhất tại thời điểm hỏi
    const context = buildChatContext(useAppStore.getState().data)
    await streamChat(useAuth.getState().token ?? '', turns, context, (t) => setLastAssistant((m) => ({ ...m, content: m.content + t })), ctrl.signal)
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      const msg = e instanceof ApiError ? e.message : 'Có lỗi xảy ra, thử lại nhé.'
      setLastAssistant(() => ({ role: 'assistant', content: msg, error: true }))
    }
  } finally {
    if (abortCtrl === ctrl) {
      abortCtrl = null
      useChat.setState((s) => {
        const last = s.msgs[s.msgs.length - 1]
        // Dừng trước khi có chữ nào → bỏ cặp hỏi/đáp rỗng
        return { busy: false, msgs: last?.role === 'assistant' && !last.content ? s.msgs.slice(0, -2) : s.msgs }
      })
    }
  }
}

const stop = () => abortCtrl?.abort()
const resetChat = () => {
  stop()
  abortCtrl = null
  useChat.setState({ msgs: [], busy: false })
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
  const { msgs, busy } = useChat()
  const desktop = useIsDesktop()
  const vp = useVisibleViewport(!desktop)
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Tự cuộn theo chữ mới — trừ khi người dùng đang kéo lên đọc lại đoạn trên
  const stickRef = useRef(true)
  const lastCount = useRef(msgs.length)
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    if (msgs.length > lastCount.current) stickRef.current = true // vừa gửi câu hỏi mới
    lastCount.current = msgs.length
    if (stickRef.current) el.scrollTop = el.scrollHeight
  }, [msgs, busy, vp?.h])

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
    if (!text.trim() || busy) return
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    ask(text)
  }

  // Điện thoại: khung chat = đúng phần màn hình còn thấy (phía trên bàn phím)
  const mobileStyle: CSSProperties | undefined = vp ? { top: vp.top, height: vp.h, bottom: 'auto' } : undefined
  const lastIsDone = msgs.length > 0 && !busy

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
          <div className="truncate text-[11.5px] text-white/70">{busy ? 'Đang trả lời…' : 'Claude · đọc dữ liệu kế hoạch'}</div>
        </div>
        {msgs.length > 0 && (
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
        {msgs.length === 0 ? (
          <div className="pt-2 text-center md:pt-4">
            <svg className="mx-auto" width="32" height="32" viewBox="0 0 24 24" fill="#c79a4b">
              <path d={SPARKLE} />
            </svg>
            <p className="mt-2 font-display text-[20px] font-bold text-wine">Anh chị cần hỏi gì ạ?</p>
            <p className="mx-auto mt-1 max-w-[300px] text-[13px] text-gray-500">
              Em đọc toàn bộ khách mời, khẩu phần ăn, công việc và số liệu tổng hợp để trả lời.
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
          msgs.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end pl-10">
                <div className="rounded-[20px] rounded-br-md bg-wine px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap text-white shadow-sm">{m.content}</div>
              </div>
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
                  {m.content ? <RichText text={m.content} /> : <TypingDots />}
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
            placeholder="Hỏi về khách mời, chi phí, công việc…"
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
              disabled={!input.trim()}
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
