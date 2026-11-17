# 💍 Kế hoạch đám cưới

Web quản lý đám cưới (chỉ Frontend): khách mời hai nhà, khẩu phần ăn, công việc và trang tổng hợp tự tính.
Vite + React + TypeScript + Tailwind + zustand + zod + dnd-kit.

- Đăng nhập: **`carrot0304` / `123123`** (mặc định, kiểm tra ở server `api/data.ts`; đổi bằng biến môi trường `APP_USERNAME` / `APP_PASSWORD`).
- Trên điện thoại: danh sách dạng thẻ, chạm vào thẻ để sửa, nút **+** tròn để thêm, thanh điều hướng ở dưới.
- Trên máy tính: bảng sửa trực tiếp từng ô (Enter hoặc rời ô để lưu), kéo tay nắm ⋮⋮ để đổi thứ tự.

> ⚠️ **Đăng nhập chỉ mang tính hình thức.** Tài khoản nằm trong mã JavaScript, ai mở DevTools cũng đọc được. Không dùng cho dữ liệu cần bảo mật.

## Chạy trên máy

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit test cho src/lib/calc.ts
npm run build    # build ra thư mục dist
```

## Dữ liệu được lưu ở đâu?

Dữ liệu **không lưu trong trình duyệt nữa** mà lưu ở server, dùng chung cho mọi máy:

| Môi trường | Lưu ở đâu |
|---|---|
| Web thật (Vercel) | **Upstash Redis** qua API `/api/data` (file `api/data.ts`). Deploy lại **không mất** dữ liệu. |
| Chạy local (`npm run dev`) | Ghi thẳng vào **`src/data/seed-data.json`**. Nếu `.env.local` có biến Upstash (xem dưới) thì dùng chung dữ liệu với web thật. |

- Mỗi thay đổi (thêm / sửa / xóa / kéo thả) **tự lưu sau ~0,6 giây**; góc trên có chỉ báo *Đang lưu… / Đã lưu*.
- Máy khác đang mở web sẽ **tự thấy thay đổi trong vòng ~1 phút**, và ngay lập tức khi quay lại tab hoặc chạm vào app sau khi nghỉ. Không ai thao tác quá 3 phút thì ngừng hỏi server.
- Hai người sửa gần như cùng lúc: người lưu sau được báo *“Có người khác vừa sửa trước”*, web tải bản mới nhất về và thao tác vừa rồi cần làm lại — không ai bị ghi đè mất dữ liệu.
- Lần đầu server còn trống: web đưa dữ liệu cũ trong trình duyệt (bản trước đây lưu localStorage) lên, nếu không có thì dùng `seed-data.json`. → **Mở web lần đầu trên máy đang có dữ liệu mới nhất.**
- Trang **Dữ liệu** vẫn có Xuất JSON (sao lưu), Nhập JSON và Khôi phục dữ liệu gốc — áp dụng cho tất cả mọi người.

### Bật kho dữ liệu trên Vercel (làm 1 lần)

1. Vercel → mở project **wedding-planner** → tab **Storage** → **Create Database** → chọn **Upstash for Redis** (gói Free) → tạo và **Connect** vào project (tick đủ Production, Preview, Development).
   Vercel tự thêm biến `KV_REST_API_URL`, `KV_REST_API_TOKEN`.
2. (Nên làm) **Settings → Environment Variables**: thêm `APP_USERNAME`, `APP_PASSWORD` để đổi tài khoản đăng nhập.
3. **Deployments** → bản mới nhất → **Redeploy**.

Chưa làm bước 1 thì web báo *“Server chưa được kết nối kho dữ liệu”* (dữ liệu cũ trong trình duyệt vẫn còn nguyên, chưa bị xóa).

Muốn chạy local mà dùng chung dữ liệu với web thật: `npx vercel env pull .env.local` (hoặc tự tạo `.env.local` chứa 2 biến `KV_REST_API_URL`, `KV_REST_API_TOKEN`) rồi `npm run dev`.

## Deploy lên Vercel (qua GitHub)

### Bước 1 — Đẩy code lên GitHub

Thư mục `wedding-planner` đang nằm trong repo `CodeForFun` (remote `git@github.com:LamTruongJS/CodeForFun.git`):

```bash
cd D:/CodeForFun
git add wedding-planner
git commit -m "Add wedding planner web"
git push origin main
```

*(Muốn repo riêng: tạo repo mới trống trên GitHub, rồi copy thư mục `wedding-planner` ra ngoài, `git init`, `git remote add origin <url>`, `git push -u origin main`. Khi đó ở bước 2 không cần đặt Root Directory.)*

### Bước 2 — Import vào Vercel

1. Vào <https://vercel.com/new> → đăng nhập bằng GitHub → chọn repo **CodeForFun** → **Import**.
2. **Root Directory**: bấm **Edit** → chọn `wedding-planner`.
3. **Framework Preset**: `Vite` (Vercel tự nhận). Build command `npm run build`, Output `dist`.
4. Bấm **Deploy**, rồi làm mục **Bật kho dữ liệu trên Vercel** ở trên.
5. Xong sẽ có link dạng `https://wedding-planner-xxx.vercel.app`. Mở trên điện thoại → menu trình duyệt → **Thêm vào màn hình chính** để dùng như app.

Từ đó, mỗi lần `git push` lên `main`, Vercel tự build và deploy lại.

`vercel.json` đã có rewrite về `index.html` nên tải lại trang ở `/tasks`, `/guests/gai`… không bị 404.

### Cách khác — Vercel CLI (không cần GitHub)

```bash
npm i -g vercel
cd D:/CodeForFun/wedding-planner
vercel          # lần đầu: đăng nhập + trả lời câu hỏi, giữ mặc định
vercel --prod   # deploy bản chính thức
```

## Cấu trúc

```
src/
  config/auth.ts          khóa lưu phiên đăng nhập
api/data.ts               API dữ liệu (Vercel Function + Upstash Redis; dev dùng file JSON)
  data/seed-data.json     dữ liệu gốc
  lib/schema.ts           zod schema + chuẩn hóa (sinh id, đánh lại sortOrder)
  lib/calc.ts             toàn bộ công thức tính (mục 6 của đặc tả)
  lib/calc.test.ts        unit test
  lib/format.ts           định dạng tiền vi-VN, kiểm tra số nhập
  store/useAppStore.ts    zustand (dữ liệu trong bộ nhớ)
  store/sync.ts           tải / tự lưu / đồng bộ với server
  store/ui.ts             đăng nhập, toast, hộp thoại xác nhận
  components/             ô nhập inline, chip, kéo thả, form sửa (bottom sheet)…
  pages/                  Login, Summary, Guests, Catering, Tasks, Data
  routes/ProtectedRoute.tsx
```
