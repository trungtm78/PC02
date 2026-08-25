# PROGRESS
Cập nhật: 2026-08-26T04:10:00+07:00 | Milestone: M5/5 | Task: 4.5/5

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

## Đang làm dở
Task: M5b — Đối soát trên bản chạy thật + UAT phủ 100%
Đã làm: hai vòng rà soát xong, 13 phát hiện đã xử
BƯỚC TIẾP THEO: nạp dữ liệu mẫu vào PG18, chạy backend + frontend, chụp `/cases` và
`/cases/new` rồi đối chiếu với ảnh hệ cũ đã lưu ở scratchpad; sau đó dựng `UAT-COVERAGE.md`
File liên quan: `backend/prisma/seed.ts`, ảnh hệ cũ ở thư mục scratchpad của phiên

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
Backend: **3115/3115 PASS (232 bộ)** · `tsc --noEmit` sạch
Frontend: **1744/1744 PASS (169 bộ)** · `tsc -b` sạch
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
- **PHÁT HIỆN CẦN BÁO ANH:** dựng cơ sở dữ liệu từ đầu bằng `prisma migrate deploy` THẤT BẠI
  ở `20260227000000_add_case_metadata` (`relation "cases" does not exist`). Chuỗi 91 migration
  không tự dựng lại được từ số không — máy đang chạy vẫn ổn vì nó lớn lên dần. Vá nằm ngoài
  phạm vi epic, nhưng là rủi ro thật cho lần dựng máy chủ mới.
- Môi trường: PG16 @5432 đang TẮT và phiên làm việc không có quyền khởi động dịch vụ. Theo
  chỉ thị chung (mọi dự án dùng PG18 @5433), đã tạo `pc02_db` + vai `pc02_admin` trên PG18 và
  trỏ `backend/.env` sang 5433. **Dữ liệu trên PG16 KHÔNG bị đụng tới.** Cơ sở dữ liệu PG18
  hiện TRỐNG (dựng bằng `prisma db push`) — cần anh quyết có chuyển dữ liệu dev từ PG16 sang
  không, việc đó cần quyền khởi động dịch vụ PG16.
- 4 lỗi mất dữ liệu đã phát hiện (ghi đè `parityState`, `caseCode` không vào cột, lọc bỏ bị can
  thiếu `crimeId`, `soHoSoCu` không gửi) → xử ở M3.
