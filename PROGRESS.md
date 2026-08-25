# PROGRESS

STATUS: ALL_MILESTONES_DONE

Cập nhật: 2026-08-25T13:05+07:00 | Milestone: 6/6

Spec gốc: `~/.claude/plans/gleaming-pondering-thacker.md`
Nhánh: `feat/danh-sach-giong-he-cu`

## Đã hoàn thành

- [x] M1-T1 `hoSoCode.ts` — hiện mã `26-11171`, tìm được cả hai dạng — commit `b2839f3` — 9 ca kiểm
- [x] M1-T2 `SummaryCell.tsx` — cột Tóm tắt nội dung + Xem thêm — commit `b2839f3` — 5 ca kiểm
- [x] M1-T3 `dateRangePresets.ts` — Chọn khoảng thời gian, 5 mốc — 10 ca kiểm
- [x] **M1 HOÀN TẤT** — 3/3 task, 24 ca kiểm
- [x] M2-T1 `LegacyFilterPanel.tsx` — thẻ lọc hai vế, 9 ca kiểm
- [x] **M2 HOÀN TẤT** — xuất mảnh mới qua `index.ts`, `tsc -b` sạch
- [x] M3-T1 `ho-so-code.util.ts` (máy chủ) — suy biến thể mã, 7 ca kiểm; **gỡ bản trùng ở frontend** để không để code chết
- [x] M3-T2 Đơn thư — 3 bộ lọc + 4 trường trả về, 100/100 ca kiểm
- [x] M3-T3 Vụ án + Vụ việc — bộ lọc theo cột THẬT của từng module, 96/96 và 107/107
- [x] **M3 HOÀN TẤT** — full suite máy chủ **2975/2975**, `tsc --noEmit` sạch
- [x] M4-T1 Trang Đơn thư — 9 cột đúng thứ tự, Thao tác về CUỐI, thẻ lọc hệ cũ — 27/27
- [x] M4-T2 Trang Vụ việc — cùng khuôn, dùng lại `canBoNhapId` sẵn có — 19/19
- [x] M4-T3 Trang Vụ án — cùng khuôn, `createdById` cho Cán bộ nhập
- [x] **M4 HOÀN TẤT** — frontend **1534/1534** (158 bộ), `tsc -b` sạch
- [x] M5-T1 Tự soát mã — **bắt lỗi thật**: thẻ lọc ghi vào địa chỉ trang nhưng `baseQueryParams` không chứa → API bỏ qua, bộ lọc không làm gì. Đã vá cả 3 trang + ca kiểm đặt đúng tầng
- [x] M5-T2 Bổ sung ca kiểm bố cục cho Vụ việc và Vụ án (trước đó chỉ Đơn thư có)
- [x] M5-T3 Đẩy nhánh + mở **PR #230**
- [x] M5-T4 Cổng `parity-check` bắt thiếu ma trận đối chiếu → cập nhật thật (PR thêm tính năng nên `[parity-skip]` là sai)
- [x] M5-T5 CI **3/3 xanh** → gộp PR #230 (`2dfdeab`), deploy đang chạy
- [x] **M5 HOÀN TẤT**
- [x] M6-T1 Dựng `UAT-COVERAGE.md` — ma trận 24 dòng + phần ngoài phạm vi có lý do
- [x] M6-T2 Viết `tests/api/danh-sach-he-cu-uat.api.spec.ts` — chạy trên bản thật, chỉ đọc
- [x] M6-T3 Chạy UAT trên bản chạy thật sau deploy: **26/26 PASS**
- [x] M6-T4 Đối chiếu ngược ma trận với plan gốc: **24/24 dòng PASS**, không sót màn hình/chức năng nào
- [x] **M6 HOÀN TẤT**

## Đang làm dở

KHÔNG CÒN. Toàn bộ 6 milestone và UAT đã hoàn tất.

## Đã deploy

PR #230 gộp (`2dfdeab`), deploy `32819302200` **thành công**, health 200, UAT 26/26 trên bản chạy thật.

## Hàng đợi task kế tiếp — ĐÃ XONG HẾT

1. ~~**M2**~~ — `LegacyFilterPanel.tsx`: thẻ lọc hai vế, 7 ô (Từ khóa · STT · STT cũ · Từ ngày · Đến ngày · Cán bộ nhập · Chọn khoảng thời gian) + Xóa bộ lọc + Xuất Excel
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
| 25/08 | Suy biến thể mã khi TÌM đặt ở **máy chủ**, không ở frontend | Tìm đúng không được phụ thuộc việc trình duyệt liệt kê đủ dạng — ứng dụng di động và lệnh gọi API trực tiếp cũng phải ra hồ sơ. Đã **gỡ** bản frontend để không để code chết (§3.5) | `backend/src/common/utils/ho-so-code.util.ts` |
| 25/08 | Bộ lọc "Cán bộ nhập" dùng cột THẬT của từng module | Đơn thư `enteredById`, Vụ việc `canBoNhapId` (đã có sẵn — không dựng ô thứ hai cùng nghĩa), Vụ án `createdById`. Đặt một tên chung sẽ phải ánh xạ ngầm và dễ nối nhầm cột | 3 DTO khác tên nhau, có chủ đích |
| 25/08 | Lọc mã dùng `in: [biến thể]` chứ không `contains` | `contains: '26-1'` quét trúng hàng nghìn mã khác — cán bộ lọc ra kết quả sai mà không biết | 3 service |
| 25/08 | `useOfficerOptions` gọi `GET /admin/users` | Tên nghe như chỉ dành quản trị nhưng quyền thật là `read:User` và **OFFICER cũng có** — đã kiểm trên CSDL đang chạy. Dùng nhầm endpoint chỉ ADMIN gọi được thì ô lọc rỗng với đúng người cần nó | `hooks/useOfficerOptions.ts` |

## Assumption đã tự quyết

| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| Protocol §4 yêu cầu code + comment tiếng Anh và i18n cho chuỗi hiển thị | **Giữ convention repo**: chú thích và tên ca kiểm tiếng Việt, chuỗi hiển thị viết trực tiếp | **Anh đã XÁC NHẬN 25/08**: "nội dung code và comment buộc tiếng Anh thì không cần thiết". Trước đó em tự quyết theo Protocol §4 "convention hiện có của repo thắng sở thích cá nhân" — repo có 2.955 ca kiểm tiếng Việt, không có hạ tầng i18n |
| "Chuyển đội" của hệ cũ | Ánh xạ sang **Phân công** (`assign`) đã có | Cùng nghĩa: đổi tổ phụ trách hồ sơ |
| "Phân loại hồ sơ ▾" của hệ cũ | Ánh xạ sang luồng chuyển đổi (`ConvertPetitionModal`) đã có | Cùng nghĩa: đổi loại hồ sơ giữa đơn thư / vụ việc / vụ án |
| "Đã chuyển đội khác", "Tìm trường bỏ trống" | **Không dựng** | Anh đã chốt qua AskUserQuestion: để lại vì hệ mới chưa có khái niệm tương đương; dựng theo phỏng đoán sẽ cho kết quả lọc sai mà cán bộ không biết |

## Trạng thái test

**Máy chủ 2975/2975** (225 bộ) · **Frontend 1541/1541** (158 bộ) · **UAT trên bản chạy thật 26/26** = **4542 ca kiểm PASS**. `tsc --noEmit` và `tsc -b` đều sạch | Patch coverage: 100% dòng | Test fail: **không** | UAT: **24/24 dòng ma trận PASS**

## Nợ kỹ thuật / rủi ro

- Trang **Tổng hợp** và **UTĐT** dùng chung shell nên hưởng phần dùng chung, nhưng cột riêng của chúng chưa rà — để đợt sau, đã ghi trong spec §Cố ý KHÔNG làm.
- `sortableHeader.test.tsx` từng chập chờn khi chạy cả thư mục (5.565ms → quá hạn) nhưng xanh khi chạy riêng. **Lượt chạy full suite 1534/1534 KHÔNG tái diễn** → xác nhận là nghẽn CPU nhất thời, không phải hồi quy.
- Ô "Từ khóa" của hệ cũ KHÔNG dựng lại trong thẻ lọc: thanh công cụ ngay trên đã có ô tìm kiếm. Hai ô tìm trên một màn hình gây nhầm chứ không tiện.
- 4 đơn thư sai tháng ngày tiếp nhận (`2026-10206/10207/8810/10224`) vẫn chờ hồ sơ giấy — không liên quan phần này.
- **Phát hiện trong lúc UAT, KHÔNG do thay đổi này gây ra** (cột mã nay hiện rõ nên lộ ra):
  **76/3.380 vụ án không có mã** (suy được 76/76 từ `nam`+`stt`) và **125/4.717 vụ việc mang
  mã tạm `VV-LEGACY-…`** (chỉ suy được 7; 118 hồ sơ còn lại đến từ `TamDinhChi_vu_viec_21`
  vốn KHÔNG có `nam`/`stt` ở hệ cũ, các trường ngày còn bị đảo tên). Đã tra tận nguồn trên
  bản sao MongoDB để kết luận. Sửa được bằng đúng công cụ đã dùng cho 1.333 đơn thư.
