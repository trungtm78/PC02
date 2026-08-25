# PROGRESS

Cập nhật: 2026-08-25T13:05+07:00 | Milestone: M2/6 | Task: 0/1 của M2

Spec gốc: `~/.claude/plans/gleaming-pondering-thacker.md`
Nhánh: `feat/danh-sach-giong-he-cu`

## Đã hoàn thành

- [x] M1-T1 `hoSoCode.ts` — hiện mã `26-11171`, tìm được cả hai dạng — commit `b2839f3` — 9 ca kiểm
- [x] M1-T2 `SummaryCell.tsx` — cột Tóm tắt nội dung + Xem thêm — commit `b2839f3` — 5 ca kiểm
- [x] M1-T3 `dateRangePresets.ts` — Chọn khoảng thời gian, 5 mốc — 10 ca kiểm
- [x] **M1 HOÀN TẤT** — 3/3 task, 24 ca kiểm

## Đang làm dở

Task: M2 — `LegacyFilterPanel.tsx`
Đã làm: chưa bắt đầu
BƯỚC TIẾP THEO: đọc `useListPageUrlState.ts` để nối đúng cơ chế lưu bộ lọc vào địa chỉ trang, rồi viết `__tests__/LegacyFilterPanel.test.tsx` (RED)
File liên quan: `frontend/src/components/shared/ListPageShell/`

## Hàng đợi task kế tiếp

1. **M2** — `LegacyFilterPanel.tsx`: thẻ lọc hai vế, 7 ô (Từ khóa · STT · STT cũ · Từ ngày · Đến ngày · Cán bộ nhập · Chọn khoảng thời gian) + Xóa bộ lọc + Xuất Excel
2. **M3** — Máy chủ: thêm `nguonDon`/`ketQuaXuLyKhac` (petitions), `moTaChiTiet` (cases) vào `select`; thêm bộ lọc `stt`, `sttCu`, `enteredById` cho cả ba
3. **M4** — Nối vào 3 trang: đủ 9 cột đúng thứ tự, Thao tác về CUỐI, giữ chip trạng thái + thẻ thống kê + sắp xếp
4. **M5** — Full suite + `/review` + `/codex` + PR + deploy
5. **M6** — UAT phủ 100% theo `UAT-COVERAGE.md`

## Quyết định kiến trúc

| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 25/08 | Mở rộng `ListPageShell` dùng chung thay vì chép vào 3 trang | Ba bản sao rời nhau là cách lỗi sống sót — vừa gặp đúng vậy ở bộ sinh số (`commit()` và `commitWithTx()` lệch nhau, gây sự cố P0 sáng nay) | Mọi mảnh mới nằm ở `components/shared/ListPageShell/` |
| 25/08 | Rút gọn mã hồ sơ ở tầng HIỂN THỊ, không đổi dữ liệu | Đổi 46.660 giá trị `stt` trong ngày vận hành thử là rủi ro không cần thiết; mã đã in ra giấy sẽ khác | `formatHoSoCode` + `hoSoCodeVariants` |
| 25/08 | `formatHoSoCode` trả nguyên văn với mã không đúng dạng `năm-stt` | Cắt bừa tạo ra mã sai mà nhìn vẫn hợp lệ — loại lỗi khó phát hiện nhất | `DT-LEGACY-…`, `VA-2026-…` giữ nguyên |

## Assumption đã tự quyết

| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| Protocol §4 yêu cầu code + comment tiếng Anh và i18n cho chuỗi hiển thị | **Giữ convention repo**: chú thích và tên ca kiểm tiếng Việt, chuỗi hiển thị viết trực tiếp | **Anh đã XÁC NHẬN 25/08**: "nội dung code và comment buộc tiếng Anh thì không cần thiết". Trước đó em tự quyết theo Protocol §4 "convention hiện có của repo thắng sở thích cá nhân" — repo có 2.955 ca kiểm tiếng Việt, không có hạ tầng i18n |
| "Chuyển đội" của hệ cũ | Ánh xạ sang **Phân công** (`assign`) đã có | Cùng nghĩa: đổi tổ phụ trách hồ sơ |
| "Phân loại hồ sơ ▾" của hệ cũ | Ánh xạ sang luồng chuyển đổi (`ConvertPetitionModal`) đã có | Cùng nghĩa: đổi loại hồ sơ giữa đơn thư / vụ việc / vụ án |
| "Đã chuyển đội khác", "Tìm trường bỏ trống" | **Không dựng** | Anh đã chốt qua AskUserQuestion: để lại vì hệ mới chưa có khái niệm tương đương; dựng theo phỏng đoán sẽ cho kết quả lọc sai mà cán bộ không biết |

## Trạng thái test

Full suite: chưa chạy ở trạng thái hiện tại | Patch coverage M1: 100% dòng (hàm thuần + component nhỏ, mọi nhánh có ca kiểm) | Test fail: không

## Nợ kỹ thuật / rủi ro

- Trang **Tổng hợp** và **UTĐT** dùng chung shell nên hưởng phần dùng chung, nhưng cột riêng của chúng chưa rà — để đợt sau, đã ghi trong spec §Cố ý KHÔNG làm.
- 4 đơn thư sai tháng ngày tiếp nhận (`2026-10206/10207/8810/10224`) vẫn chờ hồ sơ giấy — không liên quan phần này.
