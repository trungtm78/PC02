# Domain pack — Đợt 18/09/2026 "Danh sách dễ đọc + tự cập nhật + dữ liệu hệ cũ thiếu"

> Oracle của UAT này lấy từ **yêu cầu và quyết định của anh ngày 18/09/2026** (nguồn độc lập với mã), không từ
> hành vi mã hiện tại. Mã chỉ dùng để tìm điểm neo/biên.

## Authority Brief (nguồn chân lý)

| Mã nguồn | Nội dung | Trích dẫn |
|---|---|---|
| **YC-1** | "Phần cập nhật rất tốn thời gian… hãy tự động cập nhật mới nhất, các dialog nhắc cập nhật không cần nữa" | Tin nhắn anh 18/09 |
| **YC-2** | "Tóm tắt nội dung" hiện 5 dòng; "Xem thêm" mở rộng TẠI CHỖ, không nhảy sang màn xem | Tin nhắn + ảnh chụp 18/09 |
| **YC-3** | Các cột khác xuống dòng để thấy đủ nội dung | Tin nhắn 18/09 |
| **YC-4** | Thanh cuộn ngang ở TRÊN bảng | Tin nhắn 18/09 |
| **YC-5** | Bộ lọc "Áp dụng" không lọc được; thêm nút Xuất Excel trong Bộ lọc xuất ĐÚNG dữ liệu đã tìm | Tin nhắn + ảnh 18/09 |
| **YC-6** | Dữ liệu cũ thiếu: "Lê Nguyễn Yến Thanh" (26-11129), "Kha Tử Thạnh" (26-11732) — hệ cũ có, hệ mới không tìm ra | Tin nhắn + ảnh 18/09 |
| **QĐ-1** | Hồ sơ lệch loại: "Hiện ở cả hai nơi" → tạo đơn thư gắn kèm (CHỈ THÊM, không sửa vụ án/vụ việc) | AskUserQuestion 18/09 |
| **QĐ-2** | Hồ sơ mới hệ cũ trùng số: cấp số mới theo bộ đếm, giữ số hệ cũ ở ô STT cũ | AskUserQuestion 18/09 |
| **QĐ-3** | Phạm vi: Đơn thư, Vụ việc, Vụ án (+ Đơn thư phường) | AskUserQuestion 18/09 |
| **QĐ-4** | Tự tải lại khi quay lại tab CHỈ khi trang thật sự rảnh (1A) | plan-eng-review 18/09 |
| **QĐ-5** | Một bộ xuất dùng chung (D1) | AskUserQuestion 18/09 |
| **CT-1** | Chỉ thị "quản trị sâu nhất, mở rộng tốt nhất, được tăng phạm vi" → font tự host + mật độ dòng (design-consultation) | Tin nhắn 18/09 |

## Oracle table (rule_id)

| rule_id | Quy tắc kiểm chứng được | Nguồn | Neo mã |
|---|---|---|---|
| R1-NODIALOG | Có bản mới: KHÔNG hiện hộp/toast nhắc cập nhật nào | YC-1 | `useTuCapNhat.ts` |
| R1-ROUTE | Có bản mới + chuyển màn → trang tải lại đầy đủ ở màn đích | YC-1 | `apDungBanMoi.ts` |
| R1-SAME | Cùng bản → chuyển màn KHÔNG tải lại | YC-1 (không phiền) | `canCapNhat` |
| R1-SAFE | Đang gõ/hộp thoại mở → không tự tải lại khi quay tab | QĐ-4 | `trangDangRanh.ts` |
| R1-HEALTHERR | Máy chủ /health lỗi → không tải lại, không báo lỗi | YC-1 (im lặng) | `hoiMayChu` |
| R2-CLAMP5 | Ô Tóm tắt dài hiện đúng 5 dòng | YC-2 | `SummaryCell` |
| R2-NOBTN | Tóm tắt không tràn → không có "Xem thêm" | YC-2 (nút chỉ khi cần) | `SummaryCell` |
| R2-INPLACE | "Xem thêm" bung tại chỗ; URL không đổi; "Thu gọn" kẹp lại | YC-2 | `SummaryCell` |
| R2-KEY | Nhấn Enter/Space trên "Xem thêm" không mở hồ sơ | YC-2 | `SummaryCell` |
| R3-WRAP | Ô chữ xuống dòng (không cắt …) | YC-3 | `TABLE_CELL_WRAP` |
| R3-ONELINE | Ngày/mã hiện một dòng, không tràn | YC-3 (đọc được) + DESIGN §11 | `DateCell` |
| R3-SCROLL | Bảng nhiều cột vẫn cuộn ngang (không ép cột) | YC-3+YC-4 | `Table minWidth` |
| R4-TOPBAR | Bảng tràn → có thanh cuộn ngang TRÊN bảng; không tràn → không có | YC-4 | `ThanhCuonNgangTren` |
| R4-SYNC | Kéo thanh trên ↔ bảng cuộn theo hai chiều, không giật ngược | YC-4 | `ThanhCuonNgangTren` |
| R5-FILTER | Áp dụng bộ lọc → danh sách, thẻ số cùng tập | YC-5 | `dungWhereDanhSach` |
| R5-LABEL | Nhãn kỳ thống kê = kỳ đang áp dụng | YC-5 | `nhanKyApDung` |
| R5-EXPORT | Tệp Excel = đúng số dòng đang lọc, đúng thứ tự, đúng cột đang hiện | YC-5 + QĐ-5 | `xuatDanhSachExcel` |
| R5-APPLYFIRST | Còn thay đổi chưa áp dụng → áp dụng rồi mới xuất | YC-5 (tệp khớp màn) | `NutXuatTheoBoLoc` |
| R5-EMPTY | Không có dòng → không xuất tệp rỗng (nút khoá / 400 câu rõ) | YC-5 | exporter |
| R5-OFFICER | Vụ việc: lọc Cán bộ nhập ra đúng hồ sơ, cột Người nhập có tên | YC-5 | #412 |
| R6-FIND | Tìm "Kha Tử Thạnh" ở Vụ việc, "Lê Nguyễn Yến Thanh" ở Đơn thư đều ra | YC-6 | CLI #409/#410 |
| R6-LINK | Đơn gắn kèm trạng thái "Đã chuyển vụ án", mở sang vụ án | QĐ-1 | #410 |
| R6-STTCU | Trùng số hệ mới → số mới theo bộ đếm, số cũ ở STT cũ | QĐ-2 | #409 |
| RF-FONT | Font tự host, không gọi Google Fonts, đủ glyph tiếng Việt | CT-1 | `fonts.css` |
| RD-DENSITY | Gọn=1 dòng, Đọc=5 (mặc định), Đầy đủ=không kẹp; nhớ theo cán bộ | CT-1 | #415 |

## Personas

- **P-CB — Cán bộ nhập/tra cứu hồ sơ** (ADMIN/OFFICER): đọc danh sách cả ngày, lọc, xuất Excel.
- **P-QT — Quản trị** (ADMIN): như trên + chạy CLI đồng bộ hệ cũ (có xác nhận).

## Journeys

| id | Journey | Persona |
|---|---|---|
| J-DOC | Mở danh sách → đọc tóm tắt → Xem thêm/Thu gọn → cuộn ngang bằng thanh trên | P-CB |
| J-LOC | Mở Bộ lọc → chọn Cán bộ nhập/kỳ → Áp dụng → đối chiếu thẻ số → Xuất N dòng Excel | P-CB |
| J-TIM | Tìm hồ sơ hệ cũ vừa nạp theo tên → mở → sang vụ án | P-CB |
| J-CAPNHAT | Đang dùng app → có bản mới → chuyển màn → lên bản mới, không hộp nhắc | P-CB |
| J-MATDO | Đổi mật độ dòng → tải lại vẫn giữ | P-CB |

## Mock allowlist (D6)

| Biên | Lý do |
|---|---|
| `GET /api/v1/health` → `buildId` khác (chỉ ca R1) | Không thể deploy một bản mới giữa ca kiểm; mọi logic cập nhật của sản phẩm vẫn chạy thật. |

Không mock gì khác: backend + CSDL thật (bản sao prod `pc02_e2e_c` và prod thật ở các journey chỉ đọc).
