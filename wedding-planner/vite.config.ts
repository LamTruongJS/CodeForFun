import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Chỉ chạy khi `npm run dev` (máy local): cho phép trang Dữ liệu ghi
 * trực tiếp dữ liệu hiện tại vào src/data/seed-data.json.
 * Trên Vercel (web tĩnh) endpoint này không tồn tại.
 */
function devSaveSeed(): Plugin {
  return {
    name: 'dev-save-seed',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/save-seed', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const json = JSON.parse(body)
            const file = path.resolve(import.meta.dirname, 'src/data/seed-data.json')
            fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devSaveSeed()],
  server: {
    // Không reload trang khi file seed bị ghi đè
    watch: { ignored: ['**/src/data/seed-data.json'] },
  },
})
