import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, streamChat, type ChatTurn } from '../lib/api'
import { buildChatContext } from '../lib/chatContext'
import { HERO_PHOTO } from '../lib/photos'
import { useAuth } from '../store/ui'
import { useAppStore } from '../store/useAppStore'
import { useSync } from '../store/sync'

const SUGGESTIONS = [
  'Tóm tắt tình hình chuẩn bị đám cưới giúp anh',
  'Còn những công việc nào chưa làm hoặc chưa trả hết tiền?',
  'Nhà Gái có những khách nào cần kiểm tra lại?',
  'Tổng chi phí hiện tại là bao nhiêu, mỗi nhà chịu bao nhiêu?',
]

type Msg = ChatTurn & { error?: boolean }

const SPARKLE = 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z'

/** Trợ lý Claude: nút nổi + khung chat, đọc dữ liệu kế hoạch hiện tại. */
export function ChatBot() {
  const ready = useSync((s) => s.status === 'ready')
  const [open, setOpen] = useState(false)
  if (!ready) return null
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Hỏi trợ lý Claude"
          className="fixed bottom-[84px] left-4 z-30 flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-[#a83a5b] to-[#7d2640] pr-4 pl-3 text-white shadow-lg shadow-wine/30 ring-2 ring-[#f3d9a4]/70 transition hover:brightness-110 active:scale-95 md:right-6 md:bottom-6 md:left-auto md:h-14 md:pr-5 md:pl-4"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#f3d9a4">
            <path d={SPARKLE} />
          </svg>
          <span className="text-[14px] font-semibold">Hỏi trợ lý</span>
        </button>
      )}
      {open && <ChatPanel onClose={() => setOpen(false)} />}
    </>
  )
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const token = useAuth((s) => s.token) ?? ''
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Cuộn xuống cuối khi có chữ mới
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs])

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      abortRef.current?.abort()
    }
  }, [onClose])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    // Lịch sử gửi đi: bỏ các câu trả lời lỗi (và câu hỏi đi kèm) để hội thoại luôn xen kẽ user/assistant
    const history: ChatTurn[] = []
    for (const m of msgs) {
      if (m.error) {
        history.pop()
        continue
      }
      history.push({ role: m.role, content: m.content })
    }
    const turns: ChatTurn[] = [...history, { role: 'user' as const, content: q }].slice(-20)
    if (turns[0].role !== 'user') turns.shift()

    setMsgs((m) => [...m, { role: 'user', content: q }, { role: 'assistant', content: '' }])
    setInput('')
    setBusy(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const append = (t: string) =>
      setMsgs((m) => {
        const last = m[m.length - 1]
        return [...m.slice(0, -1), { ...last, content: last.content + t }]
      })
    try {
      // Luôn gửi dữ liệu mới nhất tại thời điểm hỏi
      const context = buildChatContext(useAppStore.getState().data)
      await streamChat(token, turns, context, append, ctrl.signal)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        const text = e instanceof ApiError ? e.message : 'Có lỗi xảy ra, thử lại nhé.'
        setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', content: text, error: true }])
      }
    } finally {
      setMsgs((m) => {
        const last = m[m.length - 1]
        // Dừng trước khi có chữ nào → bỏ cặp hỏi/đáp rỗng
        return last?.role === 'assistant' && !last.content ? m.slice(0, -2) : m
      })
      setBusy(false)
      abortRef.current = null
      inputRef.current?.focus()
    }
  }

  const stop = () => abortRef.current?.abort()

  return (
    <div
      role="dialog"
      aria-label="Trợ lý Claude"
      className="anim-sheet fixed inset-0 z-[60] flex flex-col bg-[#fbf6f1] md:inset-auto md:right-6 md:bottom-6 md:h-[min(680px,calc(100dvh-110px))] md:w-[420px] md:overflow-hidden md:rounded-[28px] md:border md:border-[#ead9c4] md:shadow-[0_30px_70px_-25px_rgba(80,25,45,.55)]"
    >
      {/* Đầu khung */}
      <div className="flex items-center gap-3 border-b border-[#eee0d2] bg-gradient-to-r from-[#8e2c48] to-[#6f1f37] px-4 py-3 text-white" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <img src={HERO_PHOTO.sm} alt="" className="h-10 w-10 rounded-full object-cover object-[50%_20%] ring-2 ring-[#f3d9a4]/80" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-[17px] font-semibold text-[#f3d9a4]">Trợ lý đám cưới</div>
          <div className="text-[11.5px] text-white/70">Claude · đọc dữ liệu kế hoạch của anh chị</div>
        </div>
        {msgs.length > 0 && (
          <button
            type="button"
            onClick={() => {
              stop()
              setMsgs([])
            }}
            className="rounded-full px-2.5 py-1 text-[12px] text-white/80 transition hover:bg-white/10"
          >
            Cuộc mới
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Tin nhắn */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 ? (
          <div className="pt-4 text-center">
            <svg className="mx-auto" width="34" height="34" viewBox="0 0 24 24" fill="#c79a4b">
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
                  className="rounded-2xl border border-[#ead9c4] bg-white/80 px-3.5 py-2.5 text-[13.5px] text-[#4a3f43] transition hover:border-[#d9b87a] hover:bg-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-wine px-3.5 py-2 text-[14.5px] whitespace-pre-wrap text-white">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div
                  className={`max-w-[92%] rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-[14.5px] leading-relaxed ${
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
        className="border-t border-[#eee0d2] bg-white/70 px-3 py-3 backdrop-blur"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-[#e8dccf] bg-white px-3 py-2 focus-within:border-wine focus-within:shadow-[0_0_0_4px_rgba(142,44,72,.1)]">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            placeholder="Hỏi về khách mời, chi phí, công việc…"
            onChange={(e) => {
              setInput(e.target.value)
              const el = e.target
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send(input)
              }
            }}
            className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[16px] outline-none md:text-[15px] placeholder:text-[#b5a9ad]"
          />
          {busy ? (
            <button type="button" onClick={stop} aria-label="Dừng" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3e7da] text-wine">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Gửi"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wine text-white transition disabled:opacity-30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[10.5px] text-gray-400">Trợ lý có thể nhầm — kiểm tra lại số liệu quan trọng trên các trang.</p>
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
