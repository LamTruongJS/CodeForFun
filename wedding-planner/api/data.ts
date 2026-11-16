/**
 * API dữ liệu dùng chung: GET /api/data, PUT /api/data
 *
 * - Trên Vercel: lưu vào Upstash Redis (biến môi trường KV_REST_API_URL + KV_REST_API_TOKEN,
 *   hoặc UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN — Vercel tự thêm khi kết nối Upstash).
 * - Khi `npm run dev`: vite.config.ts gọi `handle()` với kho là file src/data/seed-data.json.
 *
 * Chống ghi đè: mỗi lần lưu, client gửi kèm `baseVersion` (phiên bản nó đang có).
 * Nếu trên server đã có phiên bản mới hơn (người khác vừa sửa) → trả 409 kèm dữ liệu mới nhất.
 *
 * File này tự chứa (không import file khác) để Vercel chạy được ngay.
 */

export type Stored = { data: unknown; version: string | null }

export interface Storage {
  /** Lấy dữ liệu + phiên bản; chưa có gì thì { data: null, version: null }. */
  get(): Promise<Stored>
  /** Chỉ lấy phiên bản (rẻ, dùng khi hỏi "có gì mới không"). */
  version(): Promise<string | null>
  /** Ghi nếu phiên bản hiện tại === base; trả false nếu đã bị người khác ghi trước. */
  put(json: string, base: string | null, version: string): Promise<boolean>
}

// ---------- Đăng nhập ----------
// Mặc định trùng tài khoản test trong README; nên đặt APP_USERNAME / APP_PASSWORD trên Vercel để đổi.
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
  const user = decoded.slice(0, i).trim()
  const pass = decoded.slice(i + 1)
  return i > 0 && user === (env('APP_USERNAME') ?? DEFAULT_USER) && pass === (env('APP_PASSWORD') ?? DEFAULT_PASS)
}

// ---------- Kiểm tra sơ bộ dữ liệu (client đã kiểm tra kỹ bằng zod) ----------
function looksValid(d: unknown): d is { updatedAt?: string } {
  if (!d || typeof d !== 'object') return false
  const o = d as Record<string, unknown>
  return (
    o.schemaVersion === 1 &&
    ['cateringSettings', 'cateringItems', 'guests', 'tasks'].every((k) => Array.isArray(o[k]))
  )
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })


/** Xử lý 1 request với kho `storage` cho trước (dùng chung cho Vercel và dev server). */
export async function handle(req: Request, storage: Storage | null): Promise<Response> {
  if (!authorized(req)) return json({ error: 'Sai tài khoản hoặc chưa đăng nhập' }, 401)
  if (!storage) {
    return json(
      { error: 'Server chưa được kết nối kho dữ liệu (Upstash Redis). Xem README → mục "Lưu dữ liệu dùng chung".' },
      503,
    )
  }
  try {
    if (req.method === 'GET') {
      // ?v=<phiên bản đang có> → 204 nếu chưa có gì mới
      const have = new URL(req.url).searchParams.get('v')
      if (have != null && (await storage.version()) === have) return new Response(null, { status: 204 })
      const s = await storage.get()
      return json(s)
    }

    if (req.method === 'PUT') {
      let body: { data?: unknown; baseVersion?: string | null }
      try {
        body = await req.json()
      } catch {
        return json({ error: 'Body không phải JSON' }, 400)
      }
      if (!looksValid(body.data)) return json({ error: 'Dữ liệu sai cấu trúc' }, 400)
      // Phiên bản = thời điểm server lưu (cũng là updatedAt của dữ liệu)
      const version = new Date().toISOString()
      const data = { ...body.data, updatedAt: version }
      const ok = await storage.put(JSON.stringify(data), body.baseVersion ?? null, version)
      if (!ok) return json({ conflict: true, ...(await storage.get()) }, 409)
      return json({ version })
    }

    return json({ error: 'Method not allowed' }, 405)
  } catch (e) {
    return json({ error: 'Lỗi kho dữ liệu: ' + String(e) }, 500)
  }
}

// ---------- Kho Upstash Redis (gọi REST API, không cần thư viện) ----------
const KEY_DATA = 'wedding-planner:data'
const KEY_VER = 'wedding-planner:version'

// Ghi có điều kiện, nguyên tử: chỉ ghi khi phiên bản hiện tại đúng bằng base
const CAS_SCRIPT = `
local cur = redis.call('GET', KEYS[2])
if (cur or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
return 1`

export function redisStorage(url: string, token: string): Storage {
  const cmd = async (args: (string | number)[]) => {
    const r = await fetch(url.replace(/\/$/, ''), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    const out = (await r.json()) as { result?: unknown; error?: string }
    if (!r.ok || out.error) throw new Error(out.error ?? `Redis HTTP ${r.status}`)
    return out.result
  }
  return {
    async get() {
      const [data, version] = (await cmd(['MGET', KEY_DATA, KEY_VER])) as [string | null, string | null]
      return { data: data ? JSON.parse(data) : null, version: version ?? null }
    },
    async version() {
      return ((await cmd(['GET', KEY_VER])) as string | null) ?? null
    },
    async put(jsonStr, base, version) {
      return (await cmd(['EVAL', CAS_SCRIPT, 2, KEY_DATA, KEY_VER, base ?? '', jsonStr, version])) === 1
    },
  }
}

function storageFromEnv(): Storage | null {
  const url = env('KV_REST_API_URL') ?? env('UPSTASH_REDIS_REST_URL')
  const token = env('KV_REST_API_TOKEN') ?? env('UPSTASH_REDIS_REST_TOKEN')
  return url && token ? redisStorage(url, token) : null
}

// ---------- Điểm vào của Vercel Function ----------
export const GET = (req: Request) => handle(req, storageFromEnv())
export const PUT = (req: Request) => handle(req, storageFromEnv())
