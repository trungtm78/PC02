# PROGRESS
Cập nhật: 2026-08-26T01:30:00+07:00 | Milestone: M2/5 | Task: 2/5

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

## Đang làm dở
Task: M3 — Bổ sung cột còn thiếu (schema · DTO · payload · merge) + vá 4 lỗi mất dữ liệu
Đã làm: chưa bắt đầu. Các ô mới đã có trong `CaseFormData` và đã hiện trên form, nhưng
CHƯA gửi lên máy chủ và CHƯA có cột — nhập vào rồi lưu là mất.
BƯỚC TIẾP THEO: thêm cột vào `backend/prisma/schema.prisma` cho 28 khoá hệ cũ đang thiếu
(danh sách ở Phần C · PR-3 của spec), tạo migration bằng `CREATE INDEX` thường
File liên quan: `backend/prisma/schema.prisma`, `backend/src/cases/dto/create-case.dto.ts`,
`frontend/src/pages/cases/CaseFormPage/buildCreateCasePayload.ts`, `.../mergeCaseApiToFormData.ts`

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
Backend: 3011/3011 PASS (228 bộ) · `tsc --noEmit` sạch
Frontend: **1693/1693 PASS (166 bộ)** · `tsc -b` sạch — hết hẳn ca đỏ ngẫu nhiên sau khi
nâng `testTimeout` lên 20s (nguyên nhân gốc: hạn 5s không đủ khi 166 tệp chạy song song;
ca bị cắt còn để lại DOM chưa dọn nên ca kế tiếp đỏ vì lý do không liên quan).

## Nợ kỹ thuật / rủi ro
- `shownFieldKeys.ts` và `legacyParityFields.generated.ts` gắn nhãn auto-generated nhưng generator
  không còn trong repo → phải viết lại ở M4.
- **ĐÃ VÁ** nợ `testTimeout` (nâng lên 20s trong `vite.config.ts`).
- Các ô mới trên form CHƯA lưu được — chờ M3. Đây là trạng thái dở dang có chủ ý giữa hai
  milestone, không được deploy ở mốc này.
- 4 lỗi mất dữ liệu đã phát hiện (ghi đè `parityState`, `caseCode` không vào cột, lọc bỏ bị can
  thiếu `crimeId`, `soHoSoCu` không gửi) → xử ở M3.
