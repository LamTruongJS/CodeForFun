# 💍 Kế hoạch đám cưới

Web quản lý đám cưới (chỉ Frontend): khách mời hai nhà, khẩu phần ăn, công việc và trang tổng hợp tự tính.
Vite + React + TypeScript + Tailwind + zustand + zod + dnd-kit.

- Đăng nhập test: **`carrot0304` / `123123`** (khai báo ở `src/config/auth.ts`).
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

| Môi trường | Lưu ở đâu |
|---|---|
| Lần đầu mở web | Nạp từ `src/data/seed-data.json`, sinh `id`, rồi lưu vào **localStorage** (`wedding-planner:data`) |
| Mỗi lần thêm / sửa / xóa / kéo thả | Tự lưu ngay vào localStorage |
| Trên Vercel | **Không ghi được vào file JSON** (web tĩnh, file chỉ đọc). Dùng trang **Dữ liệu → Xuất JSON / Nhập JSON** để sao lưu và chuyển máy |
| Chạy local (`npm run dev`) | Trang **Dữ liệu** có thêm nút **💾 Ghi vào seed-data.json** — ghi thẳng dữ liệu hiện tại vào `src/data/seed-data.json` |

Quy trình cập nhật dữ liệu gốc lên web: chạy `npm run dev` → sửa dữ liệu → bấm **Ghi vào seed-data.json** → commit & push → Vercel tự deploy lại.
Lưu ý: người đã mở web trước đó vẫn thấy dữ liệu cũ trong localStorage của họ, cho tới khi bấm **Khôi phục dữ liệu gốc** (hoặc Nhập JSON).

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
4. Không cần Environment Variables → bấm **Deploy**.
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
  config/auth.ts          tài khoản test
  data/seed-data.json     dữ liệu gốc
  lib/schema.ts           zod schema + chuẩn hóa (sinh id, đánh lại sortOrder)
  lib/calc.ts             toàn bộ công thức tính (mục 6 của đặc tả)
  lib/calc.test.ts        unit test
  lib/format.ts           định dạng tiền vi-VN, kiểm tra số nhập
  store/useAppStore.ts    zustand + persist (localStorage)
  store/ui.ts             đăng nhập, toast, hộp thoại xác nhận
  components/             ô nhập inline, chip, kéo thả, form sửa (bottom sheet)…
  pages/                  Login, Summary, Guests, Catering, Tasks, Data
  routes/ProtectedRoute.tsx
```
