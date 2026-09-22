# UAT — Đợt 22/09/2026 (8 yêu cầu trên hai màn Đơn thư)

Ma trận phủ theo §9. Một dòng = một chức năng kiểm được độc lập.
Đối chiếu ngược với 8 yêu cầu gốc của anh ở cuối tệp.

**Môi trường:** prod `http://171.244.40.245/`, `buildId` phải là `031cefa4…` trở lên.

**Đã chạy được 4/46 dòng** (H1–H4) — ba dòng này kiểm bằng truy vấn chỉ-đọc trên máy thật,
không cần đăng nhập. **42 dòng còn lại cần tài khoản.**

Ba dòng ấy chứng minh chuỗi hạ tầng của đợt chạy đúng trên prod, chứ không chỉ trên máy:
mã danh mục mới có mặt (#470), quyền mới có mặt và đã cấp cho ADMIN (#471), và bản đang chạy
đúng bằng `origin/main`. Đó là chỗ hai lần suýt hỏng im lặng trong đợt này — tính năng lên máy
thật rồi chết bằng danh sách rỗng hoặc bằng 403.

> **CHẶN:** 5 tài khoản thử khoá từ 20/09 (mật khẩu lộ repo công khai). Cột "Chạy" chỉ điền
> được sau khi anh cấp tài khoản mới. Mọi dòng dưới đây hiện ở trạng thái **viết xong, chưa
> chạy** — theo luật của dự án, ca bỏ qua là CHƯA KIỂM, không phải đạt.

| ID | Màn hình / Chức năng | Viết ca | Chạy | Kết quả |
|---|---|---|---|---|
| **A. Form Đơn thư — mặc định và ô đã bỏ** |
| A1 | Tạo mới: "Trường hợp báo cáo Ban Giám đốc" hiện sẵn chữ "Không" | ☐ | ☐ | — |
| A2 | Tạo mới để nguyên → cột `baoCaoBanGiamDoc` trong CSDL là `false` (kiểm thẳng CSDL) | ☐ | ☐ | — |
| A3 | Mở hồ sơ DI TRÚ, không sửa gì, bấm Cập nhật → cột ấy KHÔNG đổi giá trị | ☐ | ☐ | — |
| A4 | Gõ "Có báo cáo ngày 05/9" → cột thành `true` | ☐ | ☐ | — |
| A5 | Form KHÔNG còn ô "Đồ vật, tài liệu kèm theo" ở mọi tab | ☐ | ☐ | — |
| A6 | Mở hồ sơ cũ CÓ dữ liệu ở cột ấy → bản in Word vẫn ra chữ | ☐ | ☐ | — |
| A7 | Mở hồ sơ cũ, bấm Cập nhật không sửa gì → dữ liệu cột ấy còn nguyên | ☐ | ☐ | — |
| **B. Form Đơn thư — chép đơn** |
| B1 | Chế độ sửa có nút "Tạo đơn mới từ đơn này"; chế độ tạo mới KHÔNG có | ☐ | ☐ | — |
| B2 | Bấm → sang màn tạo mới, nội dung đơn (người gửi, CCCD, nội dung, tội danh) chép đủ | ☐ | ☐ | — |
| B3 | Mã hồ sơ, ngày tiếp nhận, ngày đề xuất, hạn xử lý, trạng thái, người nhập ĐẶT LẠI | ☐ | ☐ | — |
| B4 | Kết quả xử lý, ghi chú trùng đơn, báo cáo BGĐ, đơn vị giải quyết KHÔNG theo sang | ☐ | ☐ | — |
| B5 | Lưu đơn vừa chép → tạo hồ sơ MỚI, đơn gốc không đổi | ☐ | ☐ | — |
| B6 | Chép xong bấm F8 "Làm trống form" → form trắng thật, nội dung cũ không quay lại | ☐ | ☐ | — |
| B7 | Đi từ màn XEM hồ sơ sang màn tạo mới → không mang mã hồ sơ cũ | ☐ | ☐ | — |
| **C. Danh sách — cột Loại thông tin** |
| C1 | Cột "Loại thông tin" đứng NGAY TRƯỚC "Nguồn đơn/Đơn vị giao" | ☐ | ☐ | — |
| C2 | Giá trị hiện đúng nhãn ("Tố giác", "Đề nghị"), không hiện mã | ☐ | ☐ | — |
| C3 | Tệp Excel của nút xuất thường CÓ cột ấy, đúng vị trí | ☐ | ☐ | — |
| C4 | Tắt/bật cột từ menu chọn cột vẫn chạy | ☐ | ☐ | — |
| **D. Form Đơn thư — ô Tên gợi ý** |
| D1 | Gõ `tran` → hiện gợi ý, xếp theo số đơn giảm dần | ☐ | ☐ | — |
| D2 | Gõ không dấu `tran van` → ra tên CÓ dấu | ☐ | ☐ | — |
| D3 | Gõ tên CHƯA TỪNG CÓ → lưu được bình thường | ☐ | ☐ | — |
| D4 | Gõ tên rồi bấm thẳng nút Lưu (không rời ô) → tên vào hồ sơ, không báo thiếu ô | ☐ | ☐ | — |
| D5 | Chọn một gợi ý → ô điền đúng tên ấy | ☐ | ☐ | — |
| D6 | Tài khoản tổ khác → KHÔNG thấy tên chỉ có ở tổ đầu | ☐ | ☐ | — |
| D7 | Gõ một ký tự → không hỏi máy chủ (tối thiểu 2 ký tự) | ☐ | ☐ | — |
| **E. Tệp nhận từ đơn vị xử lý** |
| E1 | Form chế độ SỬA: khu "Tệp nhận từ đơn vị xử lý" đứng cạnh ô Kết quả xử lý | ☐ | ☐ | — |
| E2 | Form chế độ TẠO MỚI: khu ấy cũng có, xếp hàng rồi tải sau khi Lưu | ☐ | ☐ | — |
| E3 | Ô chọn loại chỉ có "Kết quả từ đơn vị xử lý" | ☐ | ☐ | — |
| E4 | Tải 2 tệp liên tiếp → cả hai đều đúng loại, cả hai đều hiện trong khu | ☐ | ☐ | — |
| E5 | Khu này KHÔNG hiện tệp loại khác của cùng hồ sơ | ☐ | ☐ | — |
| E6 | Mở / tải xuống tệp đã tải lên | ☐ | ☐ | — |
| E7 | Hồ sơ ĐÃ CHUYỂN Vụ án: người đọc được đơn mà không đọc được vụ án vẫn TẢI XUỐNG được | ☐ | ☐ | — |
| **F. Popup nhập nhanh trên danh sách** |
| F1 | Bấm ô "Kết quả xử lý" → mở popup, không nhảy sang màn sửa | ☐ | ☐ | — |
| F2 | Sửa chữ → Lưu → bảng hiện giá trị mới | ☐ | ☐ | — |
| F3 | Xoá trắng ô → Lưu → cột rỗng thật (không còn chữ cũ) | ☐ | ☐ | — |
| F4 | Tải/mở/tải xuống tệp ngay trong popup | ☐ | ☐ | — |
| F5 | Hai phiên cùng sửa một hồ sơ → phiên sau nhận 409, CHỮ VỪA GÕ CÒN NGUYÊN | ☐ | ☐ | — |
| F6 | Tài khoản chỉ-xem: ô là chữ trơn, không bấm được | ☐ | ☐ | — |
| F7 | Cột Thao tác vẫn đủ 5 nút, không nút nào bị cắt (đo bằng `tools/do-cot-thao-tac.mjs`) | ☐ | ☐ | — |
| **G. Nút "Xuất đầy đủ"** |
| G1 | Khung bộ lọc có HAI nút; nút cũ giữ nguyên nhãn "Xuất N dòng Excel" | ☐ | ☐ | — |
| G2 | Bấm "Xuất đầy đủ" → tệp tải về, mở được | ☐ | ☐ | — |
| G3 | Tệp có ~130 cột, tiêu đề đúng nhãn trên form | ☐ | ☐ | — |
| G4 | **Dò tay vài ô `legacyExtra`** (vd "Số hồ sơ lưu") — có chữ, không trống | ☐ | ☐ | — |
| G5 | Ô "Ngày viết đơn" in đúng chữ nguyên văn của hồ sơ GỘP | ☐ | ☐ | — |
| G6 | Tài khoản chỉ có quyền `read` gọi thẳng `/petitions/export/day-du` → **403** | ☐ | ☐ | — |
| G7 | Lọc ra > 5.000 dòng → báo "thu hẹp bộ lọc rồi xuất lại", không treo | ☐ | ☐ | — |
| G8 | Nút cũ vẫn xuất đúng bộ cột đang hiện | ☐ | ☐ | — |
| **H. Hạ tầng deploy** |
| H1 | Prod: `directories` có `DOCUMENT_TYPE / KET_QUA_DON_VI_XU_LY` | ✅ | ✅ | **ĐẠT** 22/09 23:30 — 6/6 mã, có mã mới |
| H2 | Prod: `permissions` có `export_full / Petition`, và ADMIN được cấp | ✅ | ✅ | **ĐẠT** 22/09 23:40 — 6/6 quyền Petition, `export_full` có mặt và đã cấp cho ADMIN |
| H3 | `buildId` của `/api/v1/health` khớp `origin/main` | ✅ | ✅ | **ĐẠT** — prod `0f568a4e` = `origin/main` (đo lại 23/09 00:40) |
| H4 | Prod: khoá `metadata` thật KHÔNG mang tiền tố `statistic.` | ✅ | ✅ | **ĐẠT** — 75 khoá thật, **0** mang tiền tố. Chứng minh lỗi 44 ô trống là thật, và khoá đã cắt tiền tố của #475 khớp đúng chỗ lưu |

## Đối chiếu ngược với 8 yêu cầu gốc

| # | Yêu cầu anh nêu | Dòng UAT phủ |
|---|---|---|
| DS-1 | Xuất Excel toàn bộ field đăng ký | G1–G8 |
| DS-2 | Nhập nhanh Kết quả xử lý + upload/download tệp | E1–E7, F1–F6 |
| DS-3 | Thêm cột Loại thông tin trước Nguồn đơn | C1–C4 |
| FM-1 | Tạo đơn mới từ đơn hiện tại | B1–B7 |
| FM-2 | Upload tệp nhận từ đơn vị xử lý | E1–E6 |
| FM-3 | Báo cáo Ban Giám đốc mặc định "Không" | A1–A4 |
| FM-4 | Bỏ mục Đồ vật, tài liệu kèm theo | A5–A7 |
| FM-5 | Ô Tên tra lại dữ liệu cũ kiểu Google | D1–D7 |

**Không sót yêu cầu nào.** Dòng F7 và H1–H3 là kiểm chứng hạ tầng do chính đợt này sinh ra,
không thuộc 8 yêu cầu nhưng hỏng thì 8 yêu cầu hỏng theo.
