/**
 * Trợ lý Claude: POST /api/chat
 *
 * Body: { messages: MessageParam[], context: string }
 *   - messages: hội thoại theo định dạng Messages API (có thể chứa tool_use / tool_result)
 *   - context: dữ liệu đám cưới hiện tại (trình duyệt đã có sẵn, gửi kèm) dạng văn bản
 * Trả về: luồng NDJSON, mỗi dòng 1 sự kiện:
 *   {"type":"text","text":"..."}   đoạn chữ tiếp theo (hiện dần trên giao diện)
 *   {"type":"message","content":[...],"stop_reason":"..."}  toàn bộ câu trả lời (để gửi lại ở lượt sau)
 *   {"type":"done"}                 xong
 *
 * Sửa dữ liệu: Claude gọi công cụ propose_changes → trình duyệt hiện thẻ xác nhận,
 * người dùng bấm "Áp dụng" thì trình duyệt mới sửa, rồi gửi kết quả (tool_result) ở lượt sau.
 *   {"type":"error","error":"..."}  lỗi
 *
 * API key nằm ở biến môi trường ANTHROPIC_API_KEY (Vercel / .env.local) — không bao giờ gửi xuống trình duyệt.
 * File tự chứa (không import file khác trong dự án) để Vercel chạy được ngay.
 */
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-5-5'
const MAX_TURNS = 60
const MAX_MESSAGE_CHARS = 4000
const MAX_HISTORY_CHARS = 400_000
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

Sửa dữ liệu:
- Khi được nhờ thêm / sửa / xoá dữ liệu, gọi công cụ propose_changes với ĐẦY ĐỦ các thay đổi trong MỘT lần gọi. Người dùng sẽ xem danh sách và bấm "Áp dụng" hoặc "Không"; chỉ khi họ bấm Áp dụng dữ liệu mới thay đổi.
- Chỉ dòng cần sửa bằng STT đúng như trong dữ liệu (khách mời: theo từng nhà; hạng mục ăn uống: theo nhà + nhóm TIEC/NHOM_HO; công việc: STT công việc) và current_name chép NGUYÊN VĂN tên hiện tại của dòng đó.
- Chỉ đưa vào fields những trường cần đổi. Số tiền là số nguyên VNĐ (VD 3 triệu = 3000000).
- Nếu yêu cầu mơ hồ (nhiều dòng trùng tên, không rõ nhà nào, không rõ số tiền…), hỏi lại trước, đừng đoán. Không tự ý sửa thêm những gì không được nhờ.
- DỮ LIỆU KẾ HOẠCH luôn là bản mới nhất ở thời điểm hiện tại: sau khi người dùng bấm Áp dụng, dữ liệu bạn thấy ĐÃ bao gồm các thay đổi đó. Đừng nói là dữ liệu "đã như vậy từ trước"; hãy xác nhận thay đổi đã được áp dụng và nêu con số mới.
- Trước khi gọi công cụ, nói ngắn gọn 1 câu sẽ làm gì. Sau khi nhận kết quả, xác nhận ngắn gọn đã làm được gì (hoặc vì sao chưa làm được). Nếu người dùng bấm "Không", đừng đề xuất lại trừ khi được nhờ.`

const FIELD_PROPS = {
  name: { type: 'string', description: 'Tên (khách / công việc / hạng mục)' },
  cardWritten: { type: 'boolean', description: 'Khách: đã viết thiệp chưa' },
  address: { type: ['string', 'null'], description: 'Khách: địa chỉ' },
  attendees: { type: 'integer', minimum: 0, description: 'Khách: số người dự kiến đi' },
  expectedGift: { type: ['integer', 'null'], minimum: 0, description: 'Khách: tiền mừng dự kiến (VNĐ)' },
  actualGift: { type: ['integer', 'null'], minimum: 0, description: 'Khách: tiền mừng thực tế (VNĐ)' },
  note: { type: ['string', 'null'], description: 'Khách / công việc: ghi chú' },
  amount: { type: ['integer', 'null'], minimum: 0, description: 'Công việc: số tiền (VNĐ)' },
  deposit: { type: ['integer', 'null'], minimum: 0, description: 'Công việc: đã cọc (VNĐ)' },
  side: { type: ['string', 'null'], enum: ['TRAI', 'GAI', 'CHUNG', null], description: 'Công việc: bên chịu chi phí (CHUNG = chia đôi, null = chưa chọn)' },
  status: { type: ['string', 'null'], enum: ['DANG_LAM', 'DA_LAM', null], description: 'Công việc: tiến độ (null = chưa làm)' },
  unit: { type: ['string', 'null'], description: 'Hạng mục ăn uống: đơn vị tính' },
  unitPrice: { type: ['integer', 'null'], minimum: 0, description: 'Hạng mục ăn uống: đơn giá (VNĐ)' },
  quantityMode: { type: 'string', enum: ['MANUAL', 'AUTO_TABLES'], description: 'Hạng mục ăn uống: AUTO_TABLES = số lượng tự lấy theo số bàn' },
  quantity: { type: ['integer', 'null'], minimum: 0, description: 'Hạng mục ăn uống: số lượng (khi MANUAL)' },
  peoplePerTable: { type: 'integer', minimum: 1, description: 'Khẩu phần: số người / bàn' },
  relativeTables: { type: 'integer', minimum: 0, description: 'Khẩu phần: bàn của họ hàng' },
  nhomHoTables: { type: 'integer', minimum: 0, description: 'Khẩu phần: số bàn nhóm họ' },
}

const TOOLS = [
  {
    name: 'propose_changes',
    description: `Đề xuất thay đổi dữ liệu kế hoạch đám cưới. Người dùng xem và bấm Áp dụng thì mới thay đổi; kết quả trả về trong tool_result.
Các action:
- add_guest (side, fields.name bắt buộc) / update_guest (side, stt, current_name, fields) / delete_guest (side, stt, current_name)
- add_task (fields.name bắt buộc) / update_task (stt, current_name, fields) / delete_task (stt, current_name)
- add_catering_item (side, group, fields.name bắt buộc) / update_catering_item (side, group, stt, current_name, fields) / delete_catering_item (side, group, stt, current_name)
- update_catering_setting (side, fields: peoplePerTable / relativeTables / nhomHoTables)
side: TRAI = Nhà Trai, GAI = Nhà Gái. group: TIEC = tiệc cưới, NHOM_HO = nhóm họ.`,
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Tóm tắt 1 câu các thay đổi, tiếng Việt' },
        changes: {
          type: 'array',
          minItems: 1,
          maxItems: 500,
          items: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: [
                  'add_guest', 'update_guest', 'delete_guest',
                  'add_task', 'update_task', 'delete_task',
                  'add_catering_item', 'update_catering_item', 'delete_catering_item',
                  'update_catering_setting',
                ],
              },
              side: { type: 'string', enum: ['TRAI', 'GAI'] },
              group: { type: 'string', enum: ['TIEC', 'NHOM_HO'] },
              stt: { type: 'integer', minimum: 1, description: 'STT hiện tại của dòng cần sửa / xoá' },
              current_name: { type: 'string', description: 'Tên hiện tại của dòng đó, chép nguyên văn từ dữ liệu' },
              fields: { type: 'object', properties: FIELD_PROPS, additionalProperties: false },
            },
            required: ['action'],
            additionalProperties: false,
          },
        },
      },
      required: ['summary', 'changes'],
      additionalProperties: false,
    },
  },
] as const

type Block = { type: string; [k: string]: unknown }
type Turn = { role: 'user' | 'assistant'; content: string | Block[] }

function parseBody(raw: unknown): { messages: Turn[]; context: string } | string {
  if (!raw || typeof raw !== 'object') return 'Body không hợp lệ'
  const { messages, context } = raw as { messages?: unknown; context?: unknown }
  if (typeof context !== 'string' || context.length > MAX_CONTEXT_CHARS) return 'Thiếu hoặc quá nhiều dữ liệu kế hoạch'
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_TURNS) return 'Danh sách tin nhắn không hợp lệ'
  if (JSON.stringify(messages).length > MAX_HISTORY_CHARS) return 'Cuộc trò chuyện quá dài, bấm "Cuộc mới" nhé'
  const out: Turn[] = []
  for (const m of messages) {
    const role = (m as Turn)?.role
    const content = (m as Turn)?.content
    if (role !== 'user' && role !== 'assistant') return 'Tin nhắn không hợp lệ'
    if (typeof content === 'string') {
      if (!content.trim()) return 'Tin nhắn trống'
      out.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) })
    } else if (Array.isArray(content) && content.length && content.every((b) => b && typeof b === 'object' && typeof (b as Block).type === 'string')) {
      out.push({ role, content: content as Block[] })
    } else return 'Tin nhắn không hợp lệ'
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
          tools: TOOLS as unknown as Anthropic.Beta.BetaToolUnion[],
          messages: messages as Anthropic.Beta.BetaMessageParam[],
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
        // Gửi nguyên câu trả lời (kể cả khối suy nghĩ / tool_use) để trình duyệt gửi lại đúng như vậy ở lượt sau
        send({ type: 'message', content: final.content, stop_reason: final.stop_reason })
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
