# PROGRESS
Cập nhật: 2026-08-26T00:50:00+07:00 | Milestone: M1/5 | Task: 1/5

Epic: **Đồng bộ trường dữ liệu Vụ án với hệ cũ pc02hcm.com**
Spec gốc: `C:\Users\Than Minh Trung\.claude\plans\v-o-https-pc02hcm-com-login-b-ng-glistening-puffin.md`
Nhánh: `feat/legacy-form-parity-vu-an`

## Đã hoàn thành
- [x] M1 — Màn Danh sách vụ án khớp `/VuAn`: thêm cột `Đối tượng bị can` (vị trí 3, nguồn
  `Subject` type SUSPECT, cắt 5 tên + `+N`), `Nguồn đơn/Đơn vị giao` chuyển sang ẩn sẵn,
  API `GET /cases` mở thêm `subjects`. 4 ca kiểm mới (2 BE… thực tế 1 BE + 2 FE), ma trận
  parity đã cập nhật.

## Đang làm dở
Task: M2 — Hạ tầng bố cục theo hệ cũ
Đã làm: chưa bắt đầu
BƯỚC TIẾP THEO: tạo `frontend/src/features/cases/legacy-form-layout.def.ts` khai 10 tab
theo Phần A2 của spec, kèm ca kiểm chốt caption + thứ tự
File liên quan: `frontend/src/pages/cases/CaseFormPage/tabs.tsx`, `.../index.tsx`

## Hàng đợi task kế tiếp
1. M2 — PR-2 Hạ tầng bố cục theo hệ cũ (`legacy-form-layout.def.ts` + `LegacyLayoutSection`)
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
Backend: 3011/3011 PASS (228 suite) · `tsc --noEmit` sạch
Frontend: 1621/1623 PASS · `tsc -b` sạch · 2 ca đỏ do HẾT GIỜ 5s khi chạy song song, KHÔNG
phải sai khẳng định — chạy riêng thì xanh, và `main` cũng đỏ 3 ca khác cùng kiểu (bằng chứng:
`/tmp/vitest-main.log`). Đây là nợ có sẵn, không do thay đổi của epic này.

## Nợ kỹ thuật / rủi ro
- `shownFieldKeys.ts` và `legacyParityFields.generated.ts` gắn nhãn auto-generated nhưng generator
  không còn trong repo → phải viết lại ở M4.
- Bộ ca kiểm FE có ~2-3 ca đỏ ngẫu nhiên do `testTimeout` mặc định 5s không đủ khi 162 tệp
  chạy song song trên máy này. Ca đỏ đổi chỗ mỗi lần chạy, `main` cũng dính. Cách sửa đúng là
  nâng `testTimeout` cho nhóm ca render nặng — nằm ngoài phạm vi epic, chưa đụng.
- 4 lỗi mất dữ liệu đã phát hiện (ghi đè `parityState`, `caseCode` không vào cột, lọc bỏ bị can
  thiếu `crimeId`, `soHoSoCu` không gửi) → xử ở M3.
