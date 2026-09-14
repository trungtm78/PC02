# PROGRESS
Cập nhật: 2026-09-15T00:30+07:00 | Milestone: M1/7 | Task: 6/7

<!-- Dấu trạng thái kết thúc chỉ ghi ĐẦU DÒNG khi hoàn tất hoặc bị chặn — stop-guard.bat neo theo đầu dòng. -->

Spec gốc:
- M1: `docs/superpowers/specs/2026-09-14-loai-thong-tin-design.md`
- M2–M6: `docs/superpowers/specs/2026-09-14-tim-kiem-dang-the-design.md` (đã qua /plan-eng-review, 22 phát hiện đã gộp)

## Milestone
| # | Nội dung | Nhánh |
|---|---|---|
| M1 | Ô Loại thông tin: một ô smart select, danh mục LOAI_THONG_TIN, nhóm hạn, chuẩn hoá dữ liệu | feat/loai-thong-tin-smart-select |
| M2 | Tìm kiếm dạng thẻ — T0 đo trước + PR1 nền + Đơn thư + lát Tổng hợp | feat/tim-kiem-dang-the-nen |
| M3 | PR2 Vụ việc, Vụ án, Ủy thác điều tra | |
| M4 | PR3 Tổng hợp đầy đủ, Đối tượng, Luật sư | |
| M5 | PR4 12 màn tìm phía trình duyệt | |
| M6 | PR5 9 màn tìm phía máy chủ + GlobalSearchBar | |
| M7 | UAT phủ 100% (UAT-COVERAGE.md) | |

## Đã hoàn thành
- [x] M1-spec — commit eb1afe00 — đặc tả Loại thông tin
- [x] M2-spec — kế hoạch tìm kiếm dạng thẻ + /plan-eng-review (outside voice Claude subagent; Codex hết giờ)
- [x] M1-T1 — commit 74f7ede6 — khoaLoaiThongTin + nhomHanTheoTen (31 ca chuỗi thật, phủ 100%)
- [x] M1-T2 — commit f6dc213a — tạo nhanh LOAI_THONG_TIN chặn trùng theo khoá gộp (directory 53 ca, phủ 98,9%)
- [x] M1-T3 — commit 90974a41 — petitionType tuỳ chọn, suy nhóm hạn từ danh mục; field-catalog loaiDon ưu tiên loaiThongTin
- [x] M1-T4 — commit 2cfbbeb4 — bộ nạp hệ cũ chuẩn hoá loaiThongTin + gán petitionType (legacy 59 bộ/950 ca)
- [x] M1-T5 — commit (feat(don-thu) một ô Loại thông tin) — gỡ ô Loại đơn thư, FKSelect LOAI_THONG_TIN + tạo nhanh, popup câu chữ theo loại, tách hook popup (lint react-refresh) — frontend 237 tệp/2.863 ca

- [x] M1-T6 — commit feat(legacy) CLI nap-loai-thong-tin — 35 ca (util phủ 100% dòng, CLI 87,7% — phần chưa phủ là khối `require.main`); pc02_that: 512 mục/352 chờ duyệt, đổi loại 7.054, nhóm hạn 46.721, lần 2 ra 0, NFD 0, updatedAt không đổi

## Đang làm dở
Task: M1-T7 — /review + /codex → PR → CI → merge → deploy → chạy CLI trên prod
Đã làm: chưa
BƯỚC TIẾP THEO: /review diff nhánh so với main; codex review; push + gh pr create; chờ CI xanh (kiểm kết quả, không chỉ hết PENDING); merge; kiểm deploy + bản công khai; prod: sao lưu → chạy thử CLI → **DỪNG xin anh xác nhận trước --that**
Điểm cần anh duyệt trong bảng gộp: "Tố giác"/"Trình báo"/"Đề nghị" nhóm hạn Phản ánh (15 ngày) theo đặc tả; "Đơn tố cáo" (2 hồ sơ) rơi vào Phản ánh; "Đề nghị (lần 2/3)" là mục riêng; 352 mục chờ duyệt đa số lỗi gõ

## Hàng đợi task kế tiếp (M1)
1. M1-T1 khoá gộp + nhóm hạn theo tên (util thuần)
2. M1-T2 máy chủ: LOAI_TAO_NHANH_DUOC + taoNhanh chặn trùng theo khoá gộp, metadata nhomHan/choDuyet
3. M1-T3 máy chủ: petitionType tuỳ chọn, suy nhóm hạn từ danh mục trước khối tính hạn; field-catalog `loaiDon` ưu tiên loaiThongTin
4. M1-T4 bộ nạp hệ cũ chuẩn hoá loaiThongTin + gán petitionType
5. M1-T5 giao diện: gỡ ô Loại đơn thư, ô Loại thông tin thành FKSelect LOAI_THONG_TIN + tạo nhanh
6. M1-T6 CLI nap-loai-thong-tin (chạy thử mặc định, CSV bảng gộp) + chạy trên bản sao pc02_that
7. M1-T7 PR → CI → merge → deploy; chạy CLI trên prod: sao lưu → chạy thử → **DỪNG xin xác nhận trước --that (ghi đè dữ liệu prod, §8c)**

## Quyết định kiến trúc
| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 14/09 | Gộp Loại đơn thư vào Loại thông tin; giữ cột petitionType làm nhóm hạn | petitionType quyết định hạn tự tính (petitions.service.ts:476) | Excel/số văn bản/đồng bộ vụ án đọc tiếp không vỡ |
| 14/09 | Tìm kiếm: cột bóng `_bd` trên bảng + bộ sinh từ một tệp khai, không EAV/jsonb | Prisma string_contains jsonb không dùng chỉ mục; EAV khuếch đại ghi | Thêm cột tìm được = sửa tệp khai + chạy bộ sinh |

## Assumption đã tự quyết
| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| Giao thức §4 "tiếng Anh toàn bộ" vs "convention repo thắng" | Theo repo: định danh/chú thích tiếng Việt như code lân cận; chữ hiển thị qua hằng số/i18n | §4 dòng cuối; CLAUDE.md toàn cục (Lumina mới bắt tiếng Anh) |
| Giá trị ghép "Tố giác, Đề nghị" | Giữ một mục riêng | Spec M1 §3.1 |
| Mục tạo nhanh chưa phân nhóm hạn | nhomHan = PHAN_ANH, choDuyet = true | Spec M1 §3.3 |

## Trạng thái test
Full suite: PASS (backend 319 bộ/4.754 ca, frontend 236 tệp/2.862 ca — lần chạy 14/09 trước PR #374) | Patch coverage: — | Test fail: không

## Nợ kỹ thuật / rủi ro
- Workflow "Mutation — expert modules" đỏ 3 tuần từ 30/08 (không chặn merge) — chưa điều tra.
- Tài khoản ADMIN tạm thời (duy.tranhoang.doi2, thanh.phamtruong.doi2, minh.nguyenhoang.doi2) chờ anh bảo hạ quyền.
- Comprehensive: prefix `comprehensive`≠`comp`, lọc nâng cao không gửi API (sửa ở M2/M4).
