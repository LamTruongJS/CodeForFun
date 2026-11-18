import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { findRedisEnv, handle, redisStorage, type Storage } from './api/data'
import { handleChat } from './api/chat'
import type { IncomingMessage, ServerResponse } from 'node:http'

const SEED_FILE = path.resolve(import.meta.dirname, 'src/data/seed-data.json')

/**
 * Kho dữ liệu khi chạy local: ghi thẳng vào src/data/seed-data.json.
 * Phiên bản = trường updatedAt trong file. File seed gốc (chưa có id/updatedAt)
 * được coi là "chưa có dữ liệu" → web tự nạp seed rồi ghi lại vào file.
 */
function fileStorage(file: string): Storage {
  const read = () => {
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'))
      const ready = d?.schemaVersion === 1 && typeof d.updatedAt === 'string' && Array.isArray(d.guests) && d.guests.every((g: { id?: string }) => g.id)
      return ready ? { data: d, version: d.updatedAt as string } : { data: null, version: null }
    } catch {
      return { data: null, version: null }
    }
  }
  return {
    async get() {
      return read()
    },
    async version() {
      return read().version
    },
    async put(json, base, _version) {
      if ((read().version ?? '') !== (base ?? '')) return false
      fs.writeFileSync(file, JSON.stringify(JSON.parse(json), null, 2) + '\n', 'utf8')
      return true
    },
  }
}

/** Chuyển request của dev server (Node) thành Request chuẩn web. */
async function toRequest(req: IncomingMessage & { originalUrl?: string }) {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return new Request(`http://localhost${req.originalUrl ?? req.url}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
  })
}

/** Gửi Response về trình duyệt, chuyển tiếp từng đoạn ngay khi có (cho luồng chữ của Claude). */
async function sendResponse(r: Response, res: ServerResponse) {
  res.statusCode = r.status
  r.headers.forEach((v, k) => res.setHeader(k, v))
  if (!r.body) return res.end()
  const reader = r.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    res.write(value)
  }
  res.end()
}

/** Chạy API /api/chat (trợ lý Claude) trong dev server; key lấy từ .env.local. */
function devChatApi(env: Record<string, string>): Plugin {
  return {
    name: 'dev-chat-api',
    apply: 'serve',
    configureServer(server) {
      server.config.logger.info(`  ➜  Trợ lý Claude: ${env.ANTHROPIC_API_KEY ? 'đã có ANTHROPIC_API_KEY' : 'chưa có ANTHROPIC_API_KEY trong .env.local'}`)
      server.middlewares.use('/api/chat', async (req, res) => {
        await sendResponse(await handleChat(await toRequest(req), env.ANTHROPIC_API_KEY), res)
      })
    },
  }
}

/** Chạy API /api/data ngay trong dev server (giống hệt bản trên Vercel). */
function devDataApi(env: Record<string, string>): Plugin {
  // Có khai báo Redis trong .env.local → dùng chung dữ liệu với web thật; không thì ghi file JSON
  const redis = findRedisEnv(env)
  const storage = redis ? redisStorage(redis.url, redis.token) : fileStorage(SEED_FILE)
  return {
    name: 'dev-data-api',
    apply: 'serve',
    configureServer(server) {
      server.config.logger.info(`  ➜  Dữ liệu: ${redis ? 'Upstash Redis (.env.local)' : 'src/data/seed-data.json'}`)
      server.middlewares.use('/api/data', async (req, res) => {
        await sendResponse(await handle(await toRequest(req), storage), res)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '')
  for (const k of ['APP_USERNAME', 'APP_PASSWORD']) if (env[k]) process.env[k] = env[k]
  return {
    plugins: [react(), tailwindcss(), devDataApi(env), devChatApi(env)],
    server: {
      // Không reload trang khi file dữ liệu bị ghi đè
      watch: { ignored: ['**/src/data/seed-data.json'] },
    },
  }
})
