# PROGRESS

STATUS: ALL_MILESTONES_DONE
ĐÃ GỘP PR #243 · ĐÃ DEPLOY · ĐÃ BÙ DỮ LIỆU TRÊN MÁY THẬT
Cập nhật: 2026-08-26T06:40:00+07:00 | Milestone: 5/5 | Task: 5/5 + 2 việc ngoài phạm vi

> Epic trước (`Danh sách giống hệ cũ`, 6/6 milestone, đã xong 25/08/2026) lưu ở
> [docs/progress/2026-08-25-danh-sach-giong-he-cu.md](docs/progress/2026-08-25-danh-sach-giong-he-cu.md).

Epic: **Đồng bộ trường dữ liệu Vụ án với hệ cũ pc02hcm.com**
Spec gốc: `C:\Users\Than Minh Trung\.claude\plans\v-o-https-pc02hcm-com-login-b-ng-glistening-puffin.md`
Nhánh: `feat/legacy-form-parity-vu-an`

## Đã hoàn thành
- [x] M1 — Màn Danh sách vụ án khớp `/VuAn`: thêm cột `Đối tượng bị can` (vị trí 3, nguồn
  `Subject` type SUSPECT, cắt 5 tên + `+N`), `Nguồn đơn/Đơn vị giao` chuyển sang ẩn sẵn,
  API `GET /cases` mở thêm `subjects`. 4 ca kiểm mới (2 BE… thực tế 1 BE + 2 FE), ma trận
  parity đã cập nhật. — commit `032959d4`
- [x] M2 — Hạ tầng bố cục theo hệ cũ:
  - `legacy-form-layout.def.ts` — 10 tab, 217 ô, nhãn nguyên văn + chỗ đứng + cờ trường gương
  - `fixtures/old-system-captions.ts` — bản kết xuất DOM hệ cũ làm mốc đúng ĐỘC LẬP
  - `LegacyLayoutSection.tsx` — dựng ô từ đặc tả, dùng lại primitive sẵn có
  - `LegacyTabBody.tsx` — khung tab: bố cục hệ cũ + khối "Bổ sung hệ mới" gập sẵn + khối ghim
  - `tabs.tsx` — cả 10 tab đi qua khung mới; `CardNguonVuAn` tách ra và ghim trên cùng
  - 69 ca kiểm mới. Ba lỗi gốc vá kèm: nhãn không nối với ô nhập (`FormField`),
    `testTimeout` 5s gây đỏ giả, `CrimeSelect` nổ khi danh sách là `null`.
- [x] M3 — Ô hệ cũ lưu được xuống cơ sở dữ liệu:
  - 27 cột mới cho `Case` + 3 mốc ngày cho `InvestigationSupplement`; migration
    `20260826010000_legacy_form_parity_vu_an` (CREATE INDEX thường), đã áp thật trên PG18
  - `legacy-form-parity.mapper.ts` dùng chung cho tạo mới và chỉnh sửa (29 ô)
  - DTO + `buildCreateCasePayload` + `mergeCaseApiToFormData` nối trọn hai chiều
  - Vá 4 lỗi mất dữ liệu: `caseCode` không vào cột · `soHoSoCu` không gửi ·
    "Báo cáo Ban Giám đốc" mất nội dung chữ · **đối tượng nhập tay bị loại sạch**
  - Ca kiểm neo: điền kín mọi ô của 10 tab rồi kiểm không ô nào rơi; một vòng
    lưu-rồi-mở-lại giữ nguyên giá trị
- [x] M4 — Chuyển toàn bộ dữ liệu hệ cũ vào field mới:
  - `buildCaseStatistic` đọc thêm 7 mốc ngày (16.9k–17.8k hồ sơ MỖI khoá) + 12 chỉ tiêu
  - `buildCase` đọc thêm 24 khoá hệ cũ vừa có cột
  - `PARITY.case` khai thêm 27 cặp → `backfill-parity.ts` tự phủ hồ sơ ĐÃ di trú
  - Thêm nhánh `case_statistics` cho công cụ bù (`backfill-statistic.util.ts`)
  - `verify-backfill-parity.ts` kiểm chứng ĐẦU-CUỐI trên CSDL thật: **ĐẠT** (9 ô bảng vụ án
    + 4 ô bảng thống kê, ngày tháng đúng)
  - Cổng kiểm thêm cờ `formOnly` (khai rõ cột dựng cho form) + ca kiểm chặn dùng cờ làm cửa sau
  - Viết lại công cụ sinh đã mất: `gen-legacy-parity-fields.ts` (có `--check` cho CI)
  - Vá lỗi panel bổ sung ĐÈ giá trị cán bộ gõ trong tab (11 cột trùng)
- [x] M5a — Hai vòng rà soát độc lập, 13 phát hiện đã xử:
  - `/code-review high` → 9 phát hiện, trong đó **#1 vô hiệu hoá gần hết PR**
    (`parityState` vẫn nạp cột tab đã có ô rồi spread SAU payload → hoàn nguyên mọi sửa đổi)
  - `codex exec` (rà soát chéo mô hình) → 4 phát hiện; 2 đã vá, 2 ĐO LẠI và bác bỏ có bằng chứng
    (Prisma 7.8 đọc mảng NULL trả `[]`; thêm NOT NULL làm `case.create` hỏng P2011)
- [x] M5b — Đối chiếu trên bản chạy thật + UAT:
  - Dựng CSDL PG18, nạp seed, chạy máy chủ + giao diện, đăng nhập `admin`
  - `/cases`: đúng 9 cột hệ cũ + Trạng thái, `Đối tượng bị can` ở vị trí 3
  - `/cases/new`: 10 tab đúng thứ tự · tab Thông tin 32 ô · tab Vụ việc TĐC 34 ô, nhãn kèm
    hậu tố `(Tab: …)`
  - Nhập → Lưu (201) → mở lại: **7/7 ô giữ nguyên**, trong đó 4 ô trước epic này không hề
    có đường lên máy chủ
  - Chế độ Sửa có bố cục y hệt chế độ Tạo mới; panel bổ sung dựng 0 ô trùng
  - **E5 — hồ sơ ĐÃ DI TRÚ**: dựng hồ sơ chỉ có `legacyRaw`, chạy công cụ bù, mở ở chế độ
    Sửa → **21/21 ô hệ cũ có dữ liệu**, tab TK 48 trường và Vật chứng cũng đủ
  - Bước này bắt **4 lỗ hổng mà ca kiểm đơn vị không thấy**: `baoCaoBanGiamDocText`
    (34.931 hồ sơ mất nội dung chỉ đạo Ban Giám đốc), `loaiThongTin` (46.259),
    `ngayTiepNhan` (49.147), `toiDanhBanDau` (21.854). Nguyên nhân chung: có ở `buildCase`
    (đường của hồ sơ di trú MỚI) nhưng thiếu ở `parityColumns` (đường công cụ bù dùng cho
    hồ sơ ĐÃ di trú). Đã khai vào `PARITY.case` và kiểm chứng lại trên bản chạy thật.
  - `UAT-COVERAGE.md`: **44 dòng, 44 ĐẠT, 0 KHÔNG ĐẠT**
- [x] M6 — Đẩy nhánh, mở **PR #243**, CI xanh 3/3
- [x] M7 — Hai việc ngoài phạm vi ban đầu, phát hiện khi chuẩn bị áp lên máy thật:
  - **Sao lưu trước deploy: 243/246 tệp là 0 byte.** `sudo -u postgres` đòi mật khẩu khi
    chạy qua SSH nên hỏng mọi lần; `2>/dev/null` nuốt lỗi; `>` tạo tệp rỗng trước khi
    `pg_dump` chạy nên `[ -f ]` vẫn đúng và nhật ký vẫn báo thành công. Lộ thêm lỗi thứ tư:
    kịch bản chỉ TẠO LIÊN KẾT tới `.env` chứ không đọc, nên `DATABASE_URL` rỗng.
    Đã vá + kiểm chứng trên máy thật: **123 MB, exit 0**. Dưới 1 MB nay DỪNG deploy.
  - **Không dựng được CSDL cho máy chủ mới** (`P3018`). Thêm `bootstrap-fresh-db.ts`,
    kiểm chứng trên CSDL trống thật: 68 bảng, `migrate deploy` báo sạch.
- [x] M5c — Dựng bảng "Danh sách điều tra bổ sung" (hạng mục cuối của bố cục hệ cũ):
  đúng 5 cột dữ liệu + Thao tác, ba mốc ngày qua được DTO, đã kiểm trên bản chạy thật

## Đang làm dở

KHÔNG CÒN. PR #243 đã gộp (`ad17e37a`), deploy thành công, công cụ bù đã chạy trên máy thật.

### Kết quả bù dữ liệu trên máy thật (26/08/2026)

`backfill-parity.ts --entity case`: quét 3.359 hồ sơ, cập nhật 3.334, **điền 8.010 ô**.

| Cột | Trước | Sau | Phủ |
|---|---|---|---|
| `phanLoaiNguonTinBanDau` | 0 | 3.334 | 99,3% |
| `toiDanhBanDau` | 0 | 2.647 | 78,8% |
| `ngayTiepNhan` | 417 | 1.922 | 57,2% |
| `baoCaoBanGiamDocText` | 0 | 350 | 10,4% |
| `soQDPhanCongNguonTin` / `ngayQDPhanCongNguonTin` | 0 | 64 / 65 | 1,9% |
| 5 cột TĐC nguồn tin | 0 | 9 mỗi cột | 0,3% |

### ĐÍNH CHÍNH MỘT CON SỐ EM ĐÃ NÓI SAI

Em từng báo bảy mốc ngày thống kê "phủ 16.9k–17.8k hồ sơ MỖI KHOÁ". Con số ấy lấy từ
`field-catalog.generated.json`, mà tệp đó đếm **KHOÁ CÓ MẶT**, không đếm **giá trị có nghĩa**.

Đo lại trên máy thật: cả chín khoá mốc ngày đều có **0 hồ sơ mang giá trị ngày thật**. Mọi
giá trị là mốc rỗng của hệ cũ (`"0"` và `"-25200"`), và `parseLegacyDate` cố ý loại chúng —
chú thích ở `legacy-mapper.ts:152` ghi rõ điều này. Điền chúng vào cột sẽ tạo ra 1.800 ngày
giả 01/01/1970, tệ hơn hẳn để trống.

**37 cột còn trống sau khi bù đều ĐÚNG**: 27 khoá không có trong bản gốc, 10 khoá chỉ chứa
mốc rỗng. Không mất dữ liệu nào.

Phần bổ sung mapper vẫn cần và vẫn đúng — hệ cũ đang nhận nhập liệu, nên khi có giá trị thật
thì cột sẽ nhận được; và form cần chúng để lưu-mở lại không rơi ô.

## Hàng đợi task kế tiếp
0. M2 — PR-2 Hạ tầng bố cục theo hệ cũ (`legacy-form-layout.def.ts` + `LegacyLayoutSection`)
2. M3 — PR-3 Bổ sung cột còn thiếu (schema · DTO · payload · merge) + vá 4 lỗi mất dữ liệu
3. M4 — PR-4 Chuyển toàn bộ dữ liệu hệ cũ vào field mới (mapper + backfill + GATE)
4. M5 — PR-5 Đối soát, tài liệu, UAT phủ 100%

## Quyết định kiến trúc
| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 2026-08-26 | Bố cục form khai bằng dữ liệu (`legacy-form-layout.def.ts`), `tabs.tsx` chỉ render | Một nguồn sự thật cho caption + thứ tự; màn Tạo mới và Sửa dùng chung nên không thể lệch | Toàn bộ `CaseFormPage` |
| 2026-08-26 | Cột `Thao tác` giữ ở đầu + ghim trái | Anh chốt lại 26/08; không đảo quyết định 25/08/2026 | `CaseListPageShell` |
| 2026-08-26 | `Đối tượng bị can` lấy từ `Subject` (`type = SUSPECT`) | Anh chốt; đúng nghiệp vụ hơn ô văn bản `nghiVanDoiTuong` | `cases.service.getList` |
| 2026-08-26 | Ô hệ mới hệ cũ không có → khối `Bổ sung hệ mới` cuối tab, thu gọn sẵn | Không xoá tính năng, không mất dữ liệu đã nhập | `tabs.tsx` |
| 2026-08-26 | Sửa 3 lỗi đánh máy caption hệ cũ (`nễu`→`nếu`, `vụ khí`→`vũ khí`, `toàn án`→`toà án`) | Anh chốt | `legacy-form-layout.def.ts` |

## Assumption đã tự quyết
| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ trong spec |
|---|---|---|
| Ngôn ngữ comment/nhãn | Giữ tiếng Việt như toàn repo | `§4` — convention repo thắng; `CLAUDE.md` toàn cục giới hạn luật tiếng Anh cho `Lumina_Approve` |
| Không có hệ i18n trong repo | Nhãn tiếng Việt đặt trong file đặc tả/constant, không rải rác trong JSX | `§4` tinh thần "không hardcode chuỗi hiển thị" |
| Form nhập chuẩn của hệ cũ | `/doi-1/Them` (vì `/VuAn/Them` bị chặn với Đội 1) | Phần A2 của spec |

## Trạng thái test
Backend: **3125/3125 PASS (233 bộ)** · `tsc --noEmit` sạch
Frontend: **1750/1750 PASS (170 bộ)** · `tsc -b` sạch
Kiểm chứng đầu-cuối công cụ bù trên CSDL thật: **ĐẠT** · `tsc -b` sạch — hết hẳn ca đỏ ngẫu nhiên sau khi
nâng `testTimeout` lên 20s (nguyên nhân gốc: hạn 5s không đủ khi 166 tệp chạy song song;
ca bị cắt còn để lại DOM chưa dọn nên ca kế tiếp đỏ vì lý do không liên quan).

## Nợ kỹ thuật / rủi ro
- `shownFieldKeys.ts` và `legacyParityFields.generated.ts` gắn nhãn auto-generated nhưng generator
  không còn trong repo → phải viết lại ở M4.
- **ĐÃ VÁ** nợ `testTimeout` (nâng lên 20s trong `vite.config.ts`).
- Bộ ca kiểm máy chủ thỉnh thoảng đỏ 32 ca ở `two-fa.service.spec.ts` với lỗi `invariant`
  của jest khi giả lập `otplib`. Chạy riêng `src/auth` thì 252/252 xanh, và chạy lại toàn bộ
  cũng xanh. Không liên quan diff của epic (không chạm `src/auth`). Nợ có sẵn, chưa đụng.
- ~~Dựng CSDL từ đầu thất bại~~ **ĐÃ VÁ** (`bootstrap-fresh-db.ts`, có kiểm chứng).
- ~~Sao lưu trước deploy 0 byte~~ **ĐÃ VÁ** (`scripts/deploy/deploy.sh`, có kiểm chứng trên
  máy thật). Lưu ý: 243 tệp rỗng cũ vẫn nằm ở `/var/backups/pc02` — chúng vô giá trị, anh
  quyết có dọn không.
- Môi trường: PG16 @5432 đang TẮT và phiên làm việc không có quyền khởi động dịch vụ. Theo
  chỉ thị chung (mọi dự án dùng PG18 @5433), đã tạo `pc02_db` + vai `pc02_admin` trên PG18 và
  trỏ `backend/.env` sang 5433. **Dữ liệu trên PG16 KHÔNG bị đụng tới.** Cơ sở dữ liệu PG18
  hiện TRỐNG (dựng bằng `prisma db push`) — cần anh quyết có chuyển dữ liệu dev từ PG16 sang
  không, việc đó cần quyền khởi động dịch vụ PG16.
- 4 lỗi mất dữ liệu đã phát hiện (ghi đè `parityState`, `caseCode` không vào cột, lọc bỏ bị can
  thiếu `crimeId`, `soHoSoCu` không gửi) → xử ở M3.
