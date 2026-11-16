import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { findRedisEnv, handle, redisStorage, type Storage } from './api/data'

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
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const request = new Request(`http://localhost${req.originalUrl ?? req.url}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
        })
        const r = await handle(request, storage)
        res.statusCode = r.status
        r.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(Buffer.from(await r.arrayBuffer()))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '')
  for (const k of ['APP_USERNAME', 'APP_PASSWORD']) if (env[k]) process.env[k] = env[k]
  return {
    plugins: [react(), tailwindcss(), devDataApi(env)],
    server: {
      // Không reload trang khi file dữ liệu bị ghi đè
      watch: { ignored: ['**/src/data/seed-data.json'] },
    },
  }
})
