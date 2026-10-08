# Monkey test — đi lung tung tìm chỗ vỡ

Bộ này đi qua màn hình, bấm/gõ/kéo ngẫu nhiên và báo những thứ mà ca kiểm đơn vị không thấy: màn hình trắng, lỗi
console, 5xx, chữ "Đã xảy ra lỗi" — và (từ 08/10/2026) **bất biến theo từng tính năng** như "bôi chữ trên dòng thì không
chuyển trang", "tab mới mở ra không bắt đăng nhập lại", "mỗi dòng đúng một nút ⋮ trên điện thoại".

Ngày 09/09/2026 bản đầu bắt được hai lỗi thật hỏng lặng lẽ (`/notifications/stream` 401; `/admin/users?isActive=true` 400).
Ngày 08/10/2026 bản nâng cấp + e2e trên trình duyệt thật bắt thêm hai lỗi điện thoại mà jsdom không thấy: nút ⋮ tràn ô do
quên trừ lề ô, và Safari không trả tiêu điểm về nút mở bảng (Safari không focus nút khi bấm).

## Ba trạng thái thoát

| Mã | Nghĩa |
|---|---|
| `0` | sạch — **và** không còn mục CHƯA KIỂM nào (xem `daKiem` trong kết quả) |
| `1` | có chỗ đáng ngờ (kèm hạt giống để chạy lại) **hoặc** còn mục CHƯA KIỂM |
| `2` | bộ chạy hỏng (cấu hình sai, không đăng nhập được, không khởi động được trình duyệt) |

"Bộ chạy hỏng" không phải "sản phẩm hỏng" nên tách mã riêng. Mục **CHƯA KIỂM** (bất biến không đo được vì thiếu phần tử,
hoặc đường không có bản ghi thật) được in riêng, ghi vào `chuaKiem` và làm bộ chạy **thoát 1** — **không bao giờ tính là đạt**.

## Chạy

```bash
cd tools/monkey-test
npm ci && npx playwright install chromium webkit      # một lần; bộ này tự đủ phụ thuộc

# MỘT hồ sơ, MỘT hạt giống:
UAT_BASE=http://localhost:5173 UAT_PASS='…' MONKEY_CHO_GHI=1 \
  MONKEY_PROFILE=profiles/bam-dong.json MONKEY_SEED=101 node monkey.cjs

# Lượt TỔNG (mọi hồ sơ × 3 hạt cố định + 1 ngẫu nhiên × chromium+webkit):
UAT_BASE=http://localhost:5173 UAT_PASS='…' MONKEY_CHO_GHI=1 node chay-tong.cjs
```

**Chạy lại đúng một lượt** để kiểm bản vá: dùng cùng `MONKEY_SEED` + `MONKEY_PROFILE` + `MONKEY_VIEWPORTS` +
`MONKEY_ENGINES` + `MONKEY_STEPS`. Hạt giống được in ra log ngay dòng đầu và ở cuối khi có phát hiện.

| Biến | Mặc định | Nghĩa |
|---|---|---|
| `UAT_BASE` | `http://171.244.40.245` | máy chủ |
| `UAT_USER` / `UAT_PASS` | `admin@pc02.local` / — | tài khoản (hoặc `UAT_TOKEN`) |
| `MONKEY_PROFILE` | — | hồ sơ `.json`, nhiều hồ sơ cách nhau bằng dấu phẩy |
| `MONKEY_ROUTES` | — | cách cũ: tệp danh sách đường, thành hồ sơ `mac-dinh` |
| `MONKEY_SEED` | ngẫu nhiên | hạt giống (số); `chay-tong` dùng `MONKEY_SEEDS=101,102,103,random` |
| `MONKEY_VIEWPORTS` | `1600x1000` | vd `1600x1000,390x844`; hồ sơ có `khungNhin` riêng thì dùng riêng |
| `MONKEY_ENGINES` | `chromium` | `chromium,webkit` |
| `MONKEY_STEPS` | 25 | số thao tác ngẫu nhiên mỗi đường |
| `MONKEY_NHIP_MS` | 260 | nhịp chờ sau mỗi thao tác |
| `MONKEY_OUT` / `MONKEY_ANH` | `monkey-ket-qua.json` / — | kết quả / thư mục ảnh chụp lúc có phát hiện |
| `MONKEY_CHO_GHI` | — | `1` cho phép GHI — **chỉ** khi `UAT_BASE` là localhost/127.0.0.1 |

## Ghi hay chỉ đọc

Máy thật có ~55.000 hồ sơ thật. Mặc định mọi lời gọi **GHI** (`POST/PUT/PATCH/DELETE`, trừ đăng nhập/làm mới token) bị
**chặn ở tầng mạng** — lưới an toàn không dựa vào việc đoán đúng nhãn nút — và nút có chữ xoá · lưu · duyệt · chuyển ·
khởi tố · đình chỉ · huỷ · gửi · phân công · in chứng từ… bị bỏ qua. `MONKEY_CHO_GHI=1` trỏ vào máy **không phải local** bị
từ chối ngay lúc đọc cấu hình (thoát 2); tên miền kiểu `localhost.evil.com` cũng bị từ chối. Ngay cả khi cho ghi, bộ chạy kiểm
**đích của TỪNG yêu cầu**: ghi tới máy không phải local (trang cấu hình sai gọi tuyệt đối sang máy thật) bị chặn và báo
`ghi ra ngoài máy local`. Mọi lời gọi ghi đều được
**đếm** dù cho qua hay chặn (hồ sơ `camGhi` coi bất kỳ lời gọi ghi nào là phát hiện). Nút "Đăng xuất" luôn bị bỏ qua.

Để có dữ liệu mà bấm trên máy local: `node gieo-du-lieu-local.cjs` (từ chối mọi địa chỉ không phải local).

## Hồ sơ (`profiles/*.json`)

| Hồ sơ | Màn | Bất biến |
|---|---|---|
| `phim-chon` | form Đơn thư / Vụ án / Vụ việc | không kẹt hộp chọn sau Escape |
| `chep-don` | `/petitions/:id` → "Tạo đơn mới từ đơn này" | ngày tiếp nhận = hôm nay ngay sau khi chép |
| `xem-don-thu` | `/petitions/:id` (chỉ xem) | gõ/dán/xoá không đổi ô nào; 0 lời gọi ghi |
| `bam-dong` | 8 danh sách + `/admin/settings` | bôi chữ không đổi URL; Ctrl/⌘+bấm, nút giữa mở tab mới không bắt đăng nhập lại |
| `dien-thoai` | 4 danh sách, 390×844 và 360×640 | mỗi dòng đúng 1 nút ⋮ ≥32px trong ô ≤44px; không tràn ngang; bảng đáy đóng trả tiêu điểm |
| `goi-y-ten` | `/petitions/new` ô tên người gửi | không gợi ý <2 hoặc >100 ký tự; ≤12 dòng; không 5xx |
| `tong-quat` | mọi đường trong `duong-mac-dinh.txt` | chỉ bất biến chung |

Bất biến **chung** (mọi hồ sơ): không `pageerror`, không lỗi console, không 5xx từ `/api/`, không màn hình trắng
(<60 ký tự), không màn lỗi. Đường chứa `{DON_THU}` / `{VU_VIEC}` / `{VU_AN}` được thay bằng mã thật lấy từ API (đọc); không
có bản ghi thì đường bị bỏ và ghi **CHƯA KIỂM**.

Thêm bất biến: khai trong `lib/bat-bien.cjs` (`khiNao`: `buoc`, `boi-chu`, `tab-moi`, `mo-bang`, `go-ten`, `dau-duong`,
`cuoi-duong`), rồi gọi theo tên trong hồ sơ. Tên không tồn tại → bộ chạy từ chối ngay (không lặng lẽ bỏ qua).

## Kết quả

JSON: `seed`, `engines`, `khungNhin`, số màn/thao tác, `phatHien[]` (lượt, hạt, đường, bước, chi tiết, ảnh), `chuaKiem[]`,
`daKiem{}` (số lần mỗi bất biến thực sự được kiểm — "0 phát hiện" chỉ có nghĩa khi con số này > 0). Cùng lỗi lặp lại trong
một lượt được gộp (`soLan`). **Ảnh chụp** là thứ phân biệt "sản phẩm hỏng" với "bộ chạy hỏng".

## Chứng âm — bằng chứng bộ chạy đỏ được

`npm test` (job CI `monkey-self-test`) dựng một trang mẫu có **3 lỗi gieo sẵn** — nút ném lỗi, dòng bảng chuyển trang cả khi
đang bôi chữ, ô "chỉ xem" gõ được — và bắt bộ chạy báo đủ cả ba; cùng thao tác trên trang **sạch** phải ra 0 phát hiện;
cùng hạt phải cho cùng kết quả; `MONKEY_CHO_GHI` vào máy thật phải bị từ chối. Một cổng chưa từng đỏ thì chưa ai biết nó canh
được gì.

## Những lần bộ chạy tự đỏ giả (để lần sau đừng dẫm)

| Chỗ trượt | Vì sao |
|---|---|
| Đếm đường bằng thẻ `<a href>` | thanh menu điều hướng bằng router, không có `href` → 0 đường |
| Bộ lọc console bắt cả lỗi do CHÍNH bộ chặn ghi gây ra | phải loại `Failed to fetch` / `aborted` |
| Chỉ đếm lời gọi ghi khi CHẶN | ở chế độ cho ghi (local) bất biến "màn xem không ghi" mù hoàn toàn |
| So số bước của `pageerror` giữa hai lần chạy | `pageerror` đến bất đồng bộ nên rơi vào bước kế tiếp; so tập loại phát hiện |
| Dò ô đăng nhập theo nhãn / `getByTestId` khớp chính xác | ô chỉ có `id`; testid dựng theo từng dòng (`btn-print-<id>`) |
