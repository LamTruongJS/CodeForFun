/**
 * Trợ lý Claude: POST /api/chat
 *
 * Body: { messages: [{ role: 'user' | 'assistant', content: string }], context: string }
 *   - context: dữ liệu đám cưới hiện tại (trình duyệt đã có sẵn, gửi kèm) dạng văn bản
 * Trả về: luồng NDJSON, mỗi dòng 1 sự kiện:
 *   {"type":"text","text":"..."}   đoạn chữ tiếp theo (hiện dần trên giao diện)
 *   {"type":"done"}                 xong
 *   {"type":"error","error":"..."}  lỗi
 *
 * API key nằm ở biến môi trường ANTHROPIC_API_KEY (Vercel / .env.local) — không bao giờ gửi xuống trình duyệt.
 * File tự chứa (không import file khác trong dự án) để Vercel chạy được ngay.
 */
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-5-5'
const MAX_TURNS = 40
const MAX_MESSAGE_CHARS = 4000
const MAX_CONTEXT_CHARS = 300_000

// ---------- Đăng nhập (giống api/data.ts) ----------
const DEFAULT_USER = 'carrot0304'
const DEFAULT_PASS = '123123'
const env = (k: string) => (typeof process !== 'undefined' ? process.env[k] : undefined)

function authorized(req: Request): boolean {
  const h = req.headers.get('authorization') ?? ''
  if (!h.startsWith('Basic ')) return false
  let decoded = ''
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(h.slice(6)), (c) => c.charCodeAt(0)))
  } catch {
    return false
  }
  const i = decoded.indexOf(':')
  return (
    i > 0 &&
    decoded.slice(0, i).trim() === (env('APP_USERNAME') ?? DEFAULT_USER) &&
    decoded.slice(i + 1) === (env('APP_PASSWORD') ?? DEFAULT_PASS)
  )
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

// Phần hướng dẫn cố định (đặt trước dữ liệu để được cache)
const INSTRUCTIONS = `Bạn là trợ lý kế hoạch đám cưới của Lâm Trường và Lệ Huyền (ngày cưới 20/12/2026).
Bạn trả lời câu hỏi dựa trên DỮ LIỆU KẾ HOẠCH được cung cấp bên dưới: khách mời hai nhà, khẩu phần ăn (tiệc cưới, nhóm họ), công việc và trang tổng hợp.

Cách trả lời:
- Luôn trả lời bằng tiếng Việt, xưng "em", gọi người hỏi là "anh/chị", giọng thân thiện, ngắn gọn, đi thẳng vào câu trả lời.
- Chỉ dựa vào dữ liệu được cung cấp. Nếu dữ liệu không có thông tin để trả lời, nói rõ là chưa có dữ liệu đó, không bịa.
- Số tiền viết theo kiểu Việt Nam có dấu chấm ngăn cách hàng nghìn và chữ "đ" (VD: 38.200.000 đ). Ưu tiên dùng các con số đã tính sẵn trong phần TỔNG HỢP; khi tự cộng trừ thì kiểm tra lại cẩn thận.
- Khi liệt kê, dùng gạch đầu dòng "- ". Có thể in đậm bằng **...**. Không dùng bảng, không dùng tiêu đề markdown (#).
- Khi được hỏi gợi ý / lời khuyên (VD: nên chuẩn bị gì, còn thiếu gì), dựa vào dữ liệu hiện có để gợi ý cụ thể.
- Bạn chỉ đọc dữ liệu, không thể sửa. Nếu được nhờ sửa, hướng dẫn người dùng vào đúng trang để tự sửa (Nhà Trai, Nhà Gái, Khẩu phần ăn, Công việc, Dữ liệu).`

type ChatTurn = { role: 'user' | 'assistant'; content: string }

function parseBody(raw: unknown): { messages: ChatTurn[]; context: string } | string {
  if (!raw || typeof raw !== 'object') return 'Body không hợp lệ'
  const { messages, context } = raw as { messages?: unknown; context?: unknown }
  if (typeof context !== 'string' || context.length > MAX_CONTEXT_CHARS) return 'Thiếu hoặc quá nhiều dữ liệu kế hoạch'
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_TURNS) return 'Danh sách tin nhắn không hợp lệ'
  const out: ChatTurn[] = []
  for (const m of messages) {
    const role = (m as ChatTurn)?.role
    const content = (m as ChatTurn)?.content
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim()) return 'Tin nhắn không hợp lệ'
    out.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) })
  }
  if (out[0].role !== 'user' || out[out.length - 1].role !== 'user') return 'Tin nhắn đầu và cuối phải là của người dùng'
  return { messages: out, context }
}

function errorText(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'API key của Claude không đúng hoặc đã bị thu hồi (kiểm tra ANTHROPIC_API_KEY).'
  if (e instanceof Anthropic.PermissionDeniedError) return 'API key không có quyền dùng model này.'
  if (e instanceof Anthropic.RateLimitError) return 'Đang gọi Claude quá nhiều, thử lại sau ít phút.'
  if (e instanceof Anthropic.BadRequestError) return 'Yêu cầu gửi Claude không hợp lệ: ' + e.message
  if (e instanceof Anthropic.APIConnectionError) return 'Không kết nối được tới Claude, thử lại sau.'
  if (e instanceof Anthropic.APIError) return `Claude báo lỗi (${e.status ?? '?'}), thử lại sau.`
  return 'Lỗi không xác định: ' + String(e)
}

/** Xử lý 1 request (dùng chung cho Vercel và dev server). */
export async function handleChat(req: Request, apiKey: string | undefined = env('ANTHROPIC_API_KEY')): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!authorized(req)) return json({ error: 'Sai tài khoản hoặc chưa đăng nhập' }, 401)
  if (!apiKey) return json({ error: 'Server chưa có ANTHROPIC_API_KEY. Xem README → mục "Trợ lý Claude".' }, 503)

  let body: ReturnType<typeof parseBody>
  try {
    body = parseBody(await req.json())
  } catch {
    return json({ error: 'Body không phải JSON' }, 400)
  }
  if (typeof body === 'string') return json({ error: body }, 400)

  const client = new Anthropic({ apiKey })
  const today = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  const encoder = new TextEncoder()
  const { messages, context } = body

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: object) => controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'))
      try {
        const s = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          output_config: { effort: 'medium' },
          // Nếu Claude Opus 5.5 từ chối vì bộ lọc an toàn, server tự chuyển sang model dự phòng phù hợp
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: [
            { type: 'text', text: INSTRUCTIONS },
            {
              type: 'text',
              text: `DỮ LIỆU KẾ HOẠCH (cập nhật mới nhất):\n\n${context}`,
              cache_control: { type: 'ephemeral' }, // dữ liệu ít đổi giữa các câu hỏi → đọc lại từ cache, rẻ hơn
            },
            { type: 'text', text: `Hôm nay là ngày ${today}.` },
          ],
          messages,
        })
        for await (const event of s) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            send({ type: 'text', text: event.delta.text })
          }
        }
        const final = await s.finalMessage()
        if (final.stop_reason === 'refusal') {
          send({ type: 'text', text: '\n\n_(Claude không trả lời câu này. Anh/chị thử hỏi theo cách khác nhé.)_' })
        } else if (final.stop_reason === 'max_tokens') {
          send({ type: 'text', text: '\n\n_(Câu trả lời quá dài nên bị cắt bớt.)_' })
        }
        send({ type: 'done' })
      } catch (e) {
        send({ type: 'error', error: errorText(e) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}

// ---------- Điểm vào của Vercel Function ----------
export const POST = (req: Request) => handleChat(req)
