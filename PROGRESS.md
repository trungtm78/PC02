# PROGRESS

STATUS: IN_PROGRESS

Cập nhật: 2026-08-27T12:30+07:00 | Milestone: M1/5 | Task: 1/1 của M1

<!-- Dấu STATUS phải nằm ĐẦU DÒNG: `.claude/hooks/stop-guard.bat` neo bằng `^STATUS:`.
     Kẹp nó giữa một dòng có nội dung khác thì hook không khớp và chặn mãi. -->

Epic hiện tại: **Đồng bộ form Vụ việc với hệ cũ pc02hcm.com**
Spec gốc: `C:\Users\Than Minh Trung\.claude\plans\v-o-https-pc02hcm-com-login-b-ng-glistening-puffin.md`

> Hai epic trước đã xong và lên máy thật, ghi ở
> [docs/progress/](docs/progress/): **Vụ án** (26/08) và **Đơn thư** (27/08, PR #249–#267).

## Đã hoàn thành

- [x] **M1-T1 · PR0 — vá xoá-trắng ở Vụ việc** — `oHeCu()` thay `v || undefined` cho 45 ô

## Đang làm dở

Task: M2-T1 — PR1: ba cột còn thiếu ở máy chủ + bù dữ liệu
Đã làm: chưa bắt đầu.
BƯỚC TIẾP THEO: thêm `crimeChinhId` (quan hệ `IncidentCrimeChinh`) + `phanLoaiNguonTinBanDau`
+ `baoCaoBanGiamDocText` vào `model Incident` trong `backend/prisma/schema.prisma`, kèm
migration additive dùng plain `CREATE INDEX`.
File liên quan: `backend/prisma/schema.prisma`,
`backend/src/legacy-migration/legacy-mapper.ts` (buildIncident phát `crimeChinhLegacyValue`),
`backend/src/legacy-migration/legacy-migration.service.ts` (`resolveCrime` nới `target`),
`backend/src/legacy-migration/field-parity.def.ts` (`PARITY.incident`,
`PARITY_HOAN_THEO_THUC_THE`).

## Hàng đợi task kế tiếp

1. **PR1** — 3 cột máy chủ + bù dữ liệu (crimeChinhId 1.114 · phanLoaiNguonTinBanDau 4.568 ·
   baoCaoBanGiamDocText 93)
2. **PR2** — tách `IncidentFormPage.tsx` thành thư mục (thuần di chuyển)
3. **PR3** — form Vụ việc theo bố cục hệ cũ, 10 tab (PR chính)
4. **PR4** — cột "Nguồn đơn/Đơn vị giao" trên danh sách
5. **UAT** theo §9

## Quyết định kiến trúc

| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 27/08 | Ô "Tóm tắt nội dung" ghi CẢ HAI cột `name` + `description` | Anh chốt. Hệ cũ có đúng một ô; 97,5% hồ sơ đã trùng sẵn | PR3 |
| 27/08 | Thêm `crimeChinhId` đầy đủ cho Vụ việc | Anh chốt. Đồng bộ với Đơn thư và Vụ án, tra cứu/thống kê theo tội danh dùng được cho cả ba | PR1 |
| 27/08 | Tách `buildIncidentPayload` + `incident-form.types` ngay ở PR0 | Không tách thì bản vá xoá-trắng không kiểm chứng được; đây là tập con của PR2 | PR0, PR2 |

## Assumption đã tự quyết

| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| Anh viết "màn hình Danh sách vụ án" nhưng bối cảnh là Vụ việc | Đối tượng là **Vụ việc**; xử cả form lẫn màn danh sách của nó | Cùng lỗi chép lại ở hai yêu cầu trước; đo trên máy: `/doi-1/vu-viec-da-phan-loai` |
| Ô chọn-nhiều và ô tích khi "rỗng" | Gửi mảng rỗng / `false`, KHÔNG bỏ khoá | Bỏ hết lựa chọn là một hành động; bỏ khoá thì gỡ không được |

## Trạng thái test

Full suite giao diện: **PASS 2.023/2.023** (`--maxWorkers=2`; chạy full song song trên máy này
bị chập chờn do tài nguyên, không phải lỗi thật — đã kiểm từng tệp fail chạy riêng đều xanh).
`tsc -b`: sạch. Backend chưa đụng ở PR0.

## Nợ kỹ thuật / rủi ro

- `sdtNguoiToGiac` của Vụ việc có **761 hồ sơ** sai định dạng — cùng lớp ký hiệu "không có" của
  hệ cũ đã dọn cho Đơn thư (`so-dien-thoai-he-cu.ts`). Chưa dọn cho Vụ việc; form Vụ việc hiện
  KHÔNG kiểm định dạng số nên chưa chặn Lưu, nhưng dữ liệu vẫn bẩn.
- `name` trùng `description` ở 4.598/4.717 hồ sơ (97,5%) — PR3 xử theo quyết định #1.
