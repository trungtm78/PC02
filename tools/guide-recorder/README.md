# Guide Recorder — Bộ tạo clip hướng dẫn (MP4 lồng tiếng + phụ đề)

Tự động quay clip hướng dẫn sử dụng hệ thống PC02: **quay màn hình thật** bằng Playwright,
**lồng giọng đọc tiếng Việt** (Microsoft Edge Neural TTS) và **burn phụ đề** — xuất MP4 nhúng vào
trang HDSD tại `C:\PC02\docs`.

## Yêu cầu
- Node.js (đã có), các gói dev đã cài ở repo: `playwright`, `msedge-tts`, `ffmpeg-static`.
- **App đang chạy**: backend `:3000`, frontend `:5173`.
  ```bash
  cd backend && npm run start:dev      # cửa sổ 1  (:3000)
  cd frontend && npm run dev           # cửa sổ 2  (:5173)
  # hoặc dùng start_here.bat ở thư mục gốc
  ```
- **Internet** cho TTS. Nếu offline: clip vẫn có phụ đề nhưng KHÔNG có tiếng (log cảnh báo).

> ⚠️ ffmpeg bundled theo Playwright là bản rút gọn (chỉ VP8/webm) — KHÔNG dùng được.
> Harness dùng `ffmpeg-static` (đầy đủ libx264/aac/libass) tự động, không cần cài thêm.

## Chạy
```bash
node tools/guide-recorder/run-all.mjs                 # tất cả clip
node tools/guide-recorder/run-all.mjs --only=01       # 1 clip (theo tiền tố slug)
node tools/guide-recorder/run-all.mjs --only=01 --keep-work   # giữ file tạm để debug
```
Sản phẩm ghi ra:
- `C:\PC02\docs\assets\video\<slug>.mp4` — clip đã ghép
- `C:\PC02\docs\assets\vtt\<slug>.vtt` — phụ đề rời (dùng khi phục vụ qua HTTP)
- `C:\PC02\docs\assets\img\<slug>.jpg` — poster

## Kiến trúc
| File | Vai trò |
|------|---------|
| `guide.config.mjs` | Cấu hình: ffmpeg, giọng TTS, kích thước, thư mục, tài khoản demo |
| `lib/tts.mjs` | Sinh mp3 mỗi câu + đo duration (ffmpeg) |
| `lib/subtitles.mjs` | Sinh `.srt` (burn) + `.vtt` (track) theo offset thực |
| `lib/compose.mjs` | ffmpeg: video + audio (đặt theo offset) + burn phụ đề → MP4; trích poster |
| `lib/auth.mjs` | Lấy JWT qua API, inject sessionStorage để bỏ qua login |
| `lib/runner.mjs` | Điều phối 1 clip: TTS → quay → ghép |
| `storyboards/*.mjs` | Kịch bản từng clip (narration + hành động Playwright) |
| `run-all.mjs` | CLI |

## Đồng bộ âm–hình
1. TTS trước toàn bộ câu → biết `duration` mỗi câu.
2. Quay: sau mỗi hành động, ghi **offset thời gian thực**, dừng khung ≥ độ dài giọng đọc.
3. Phụ đề + audio đặt đúng offset đã ghi → khớp tuyệt đối dù thao tác nhanh/chậm.

## Thêm clip mới
1. Tạo `storyboards/NN-slug.mjs` (export default `{ slug, title, role?, requiresAuth?, steps:[...] }`).
2. Import vào `storyboards/index.mjs`.
3. Chạy `--only=NN`.
4. Trong `C:\PC02\docs\assets\js\guide-data.js`: đổi `ready:true` cho mục đó (+ điền `steps`, `notes`).

## Tài khoản demo
Khớp `backend/prisma/seed-local-accounts.ts`: `admin@pc02.local`, `officer1@pc02.local`…
Đổi qua biến môi trường `GUIDE_ADMIN_USER/PASS`, `GUIDE_BASE_URL`, `GUIDE_TTS_VOICE`.
