# UAT — Đợt "Form Đơn thư nhập liệu nhanh" (20/09/2026)

Nhánh `feat/don-thu-nhap-lieu-nhanh` · PR #448 · 8 commit · 82 tệp (42 tệp sản phẩm).

Ma trận này liệt kê **mọi màn hình và chức năng** đợt này đụng tới: **80 ca / 12 nhóm A–L**.
Số 80 là TC_min tính theo 4 phương pháp ở `_coverage-ledger.md` (29119-4), không phải con số đặt ra. Điều kiện kết thúc: 100%
dòng PASS (80/80, TC_min tính ở `_coverage-ledger.md`). Bỏ qua ≠ đạt.

## Quy ước

- **Nguồn**: yêu cầu số mấy của anh, hoặc lỗi nào đang sống trên bản đang chạy.
- Ca kiểm tự động đã có ở cột cuối là **lớp đơn vị/thành phần**, KHÔNG thay được UAT: bài học
  đã ghi — ca kiểm xanh vẫn sót lỗi chặn, phải bấm thử thật mới thấy.

---

## A. Màn Đơn thư — Tạo mới (`/petitions/new`)

| ID | Chức năng | Nguồn | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| A1 | Ô "Cán bộ đề xuất" mở ra thấy nhóm theo Tổ, đủ 245 người | YC1 | x | x | **PASS (E2E Chrome, bản sao)** |
| A2 | Gõ tên người → lọc trong từng nhóm, bỏ nhóm rỗng | YC1 | x | x | **PASS (E2E Chrome, bản sao)** |
| A3 | Gõ tên tổ ("Tổ 1") → hiện CẢ nhóm | YC1 | x | x | **PASS (E2E Chrome, bản sao)** |
| A4 | Gõ không dấu ("to 1") và gõ tắt ("t1") đều ra | YC1 | | | |
| A5 | Phím mũi tên đi xuyên nhóm, Enter chọn đúng người | YC1 | x | x | **PASS (E2E Chrome, bản sao)** |
| A6 | Tab tới ô chọn và MỞ được bằng bàn phím | YC1 | x | x | **PASS (E2E Chrome, bản sao)** |
| A7 | Tài khoản ĐÃ KHOÁ không xuất hiện trong danh sách | Lỗi prod 2 | | | |
| A8 | "Cán bộ đề xuất" có sẵn tên người đang đăng nhập | YC4 | x | x | **PASS (E2E Chrome, bản sao)** |
| A9 | Ô "Nguồn đơn" tìm được; gõ nguồn chưa có → tạo nhanh | YC2 | x | x | **PASS (E2E Chrome, bản sao)** |
| A10 | Chọn Nguồn đơn = "Trực tiếp" → nhóm định danh TỰ BUNG | YC2 | x | x | **PASS (E2E Chrome, bản sao)** |
| A11 | Đổi sang "Bưu điện" → nhóm THU lại | YC2 | x | x | **PASS (E2E Chrome, bản sao)** |
| A12 | "Bưu điện" + bỏ trống SĐT → **LƯU ĐƯỢC** | YC2 | x | x | **PASS (E2E Chrome, bản sao)** |
| A13 | "Trực tiếp" + bỏ trống SĐT → chặn Lưu, và ô SĐT NHÌN THẤY được | YC2 | x | x | **PASS (E2E Chrome, bản sao)** |
| A14 | Đóng nhóm bằng TAY rồi bấm Lưu → ô gây chặn vẫn hiện ra | Rà mã P1 | x | x | **PASS (E2E Chrome, bản sao)** |
| A15 | Chưa bấm Lưu thì nhóm KHÔNG viền đỏ (không mắng trước) | Rà mã P2 | x | x | **PASS (E2E Chrome, bản sao)** |
| A16 | Ngày viết đơn: nhập `__/12/2026` → lưu được | YC3 | x | x | **PASS (E2E Chrome, bản sao)** |
| A17 | Ngày viết đơn: nhập `__/__/2026` → lưu được | YC3 | x | x | **PASS (E2E Chrome, bản sao)** |
| A18 | Ngày viết đơn: nhập `31/02/2026` → bị chặn tại chỗ | YC3 | x | x | **PASS (E2E Chrome, bản sao)** |
| A19 | Ba ô ngày: gõ tự nhảy ô, Backspace lùi ô, dán "15/12/2026" tách ba ô | YC3 | x | x | **PASS (E2E Chrome, bản sao)** |
| A20 | Nhóm "Thông tin khác" thu gọn sẵn, bấm vào bung ra | YC5 | x | x | **PASS (E2E Chrome, bản sao)** |
| A21 | Tiêu đề nhóm hiện "N ô · M đã nhập" đúng số | YC5 | x | x | **PASS (E2E Chrome, bản sao)** |
| A22 | Lưu một đơn ĐẦY ĐỦ → mở lại đúng mọi ô vừa nhập | Tổng hợp | x | x | **PASS (E2E Chrome, bản sao)** |

## B. Màn Đơn thư — Chỉnh sửa (`/petitions/:id`)

| ID | Chức năng | Nguồn | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| B1 | Mở đơn DI TRÚ cũ → không ô nào biến mất | Bài học | x | x | **PASS (E2E Chrome, hồ sơ di trú thật)** |
| B2 | Mở đơn cũ CÓ ngày viết đơn → ba ô hiện đúng ngày, không trắng | Rà mã P1 | x | x | **PASS (E2E Chrome, hồ sơ di trú thật)** |
| B3 | Lưu đơn cũ mà KHÔNG đụng ngày → ngày giữ nguyên | Rà mã P1 | x | x | **PASS (E2E Chrome, hồ sơ di trú thật)** |
| B4 | Đơn nhập thiếu: lưu → mở lại đúng `__/12/2026` | YC3 | | | |
| B5 | Nhóm có ô đã có giá trị → TỰ BUNG (không giấu dữ liệu) | YC2/YC5 | x | x | **PASS (E2E Chrome, hồ sơ di trú thật)** |
| B6 | Người được giao đã bị KHOÁ → vẫn hiện tên, ghim đầu danh sách | Lỗi prod 4 | | | |
| B7 | Bảng phân công: thêm/xoá cán bộ; nhãn khớp ô chọn | Lỗi prod 4 | x | x | **PASS (E2E Chrome, bản sao)** |

## C. Hộp Phân công (`AssignModal` — 3 màn danh sách)

| ID | Chức năng | Nguồn | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| C1 | Mở hộp → danh sách **Tổ** có dữ liệu (trước đây LUÔN rỗng) | Lỗi prod 1 | x | x | **PASS (E2E Chrome, bản sao)** |
| C2 | Chọn Tổ → danh sách **Cán bộ** có dữ liệu (trước đây LUÔN rỗng) | Lỗi prod 1 | x | x | **PASS (E2E Chrome, bản sao)** |
| C3 | Cán bộ hiện ra đúng là người của tổ đã chọn | Lỗi prod 1 | x | x | **PASS (E2E Chrome, bản sao)** |
| C4 | Phân công thành công, hồ sơ cập nhật | Lỗi prod 1 | x | x | **PASS (E2E Chrome, bản sao)** |

## D. Màn Vụ án (`/cases/new`, `/cases/:id`)

| ID | Chức năng | Nguồn | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| D1 | Ô "Điều tra viên chính" gom nhóm theo Tổ, đủ người | YC1 mở rộng | x | - | **CHƯA CHẠY — xem ghi chú dưới bảng** |
| D2 | Ô "Nguồn đơn" chọn từ danh mục + tạo mới được | YC2 | x | x | **PASS (E2E Chrome, bản sao)** |
| D3 | Mở vụ án có ĐTV đã khoá → vẫn hiện tên, không trông như trống | Rà mã P2 | x | - | **CHƯA CHẠY — xem ghi chú dưới bảng** |
| D4 | Lưu vụ án → `nguonDon` vào đúng cột | YC2 | x | - | **CHƯA CHẠY — xem ghi chú dưới bảng** |
| D5 | Bố cục tab Thông tin không xáo so với trước | Rà mã P3 | x | - | **CHƯA CHẠY — xem ghi chú dưới bảng** |

## E. Màn Vụ việc (`/incidents/new`, `/incidents/:id`)

| ID | Chức năng | Nguồn | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| E1 | Ô "Điều tra viên" gom nhóm theo Tổ | YC1 mở rộng | x | - | **CHƯA CHẠY — xem ghi chú dưới bảng** |
| E2 | Ô "Cán bộ nhập" gom nhóm theo Tổ | YC1 mở rộng | x | - | **CHƯA CHẠY — xem ghi chú dưới bảng** |
| E3 | Mở vụ việc có cán bộ đã khoá → vẫn hiện tên | Rà mã P2 | x | - | **CHƯA CHẠY — xem ghi chú dưới bảng** |

## F. In chứng từ

| ID | Chức năng | Nguồn | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| F1 | In đơn nhập ĐỦ ngày → bản in có ngày đúng | YC3 | x | x | **PASS (API bản in thật)** |
| F2 | In đơn nhập THIẾU → in `__/12/2026`, **không in trống** | Rà mã P1 | x | x | **PASS (API bản in thật)** |
| F3 | In đơn DI TRÚ có `ngay_viet_don` là chữ tự do → in NGUYÊN VĂN | Rà mã P1 | x | x | **PASS (API bản in thật)** |
| F4 | Không đơn nào in ra ngày BỊA (01/…) | YC3 | x | x | **PASS (API bản in thật)** |

## G. Trang Danh mục (`/danh-muc`)

| ID | Chức năng | Nguồn | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| G1 | Loại "Nguồn đơn/Đơn vị giao" hiện trong danh sách loại | YC2 | | | |
| G2 | Mục tạo nhanh từ form hiện ở trạng thái chờ duyệt | YC2 | | | |
| G3 | Mục "Trực tiếp" tạo nhanh TỰ mang cờ `laTrucTiep` | YC2 | | | |

## H. Máy chủ (API)

| ID | Chức năng | Nguồn | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| H1 | `GET /admin/users` trả `teams[]`, không vỡ consumer cũ | YC1 | x | x | **PASS (API, bản sao)** |
| H2 | Tạo đơn nguồn "Bưu điện" thiếu SĐT → 201 | YC2 | x | x | **PASS (API, bản sao)** |
| H3 | Tạo đơn nguồn "Trực tiếp" thiếu SĐT → 400, thông báo rõ | YC2 | x | x | **PASS (API, bản sao)** |
| H4 | Tạo đơn `ngayVietDonEdtf=2026-02-31` → 400 | Tự dò | x | x | **PASS (API, bản sao)** |
| H5 | Tạo đơn BÌNH THƯỜNG vẫn 201 (không 400 vì khoá form mới) | Rà mã P1 | x | x | **PASS (API, bản sao)** |
| H6 | `POST /directories/quick` type `NGUON_DON` → tạo được, chặn trùng | YC2 | x | x | **PASS (API, bản sao)** |

## I. Trợ năng (đo được)

| ID | Chức năng | Nguồn | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| I1 | Ô chọn cán bộ: Tab tới được, Enter/Space mở | Rà mã P1 | x | x | **PASS (E2E Chrome, bản sao)** |
| I2 | Nhóm gập: trạng thái lỗi và "bắt buộc" có nhãn đọc được | Rà mã P2 | | | |
| I3 | Ba ô ngày: mỗi ô có tên riêng, nhóm có tên chung | YC3 | | | |

## J. Đo trên Chrome THẬT (không phải jsdom)

| ID | Việc đo | Nguồn | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| J1 | Chụp tab Thông tin TRƯỚC/SAU, so vị trí từng ô | DESIGN §12 | | | |
| J2 | Nhóm full-width có làm lệch cột ô phía sau không | Rà mã P3 | | | |
| J3 | Bề rộng ba ô ngày sau khi đổi font (mono, tabular-nums) | DESIGN §11.5 | | | |

## K. Ca bù cho ngưỡng rủi ro (TC_min = 80, xem `_coverage-ledger.md`)

M4 risk-tier đòi 80 ca; 10 nhóm A–J mới có 70. Mười ca dưới đây chọn theo chỗ hỏng
đắt nhất, không chọn cho đủ số.

| ID | Chức năng | Nguồn | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| K1 | API: nguồn "Bưu điện" + SĐT `abc` → 400 | Rà mã `@ValidateIf` | x | x | **PASS (API, bản sao)** |
| K2 | API: tạo đơn `ngayVietDonEdtf=2026-12-XX` → đọc lại cột ngày thật RỖNG, cột chữ CÓ | Rà mã P1 | x | x | **PASS (API, bản sao)** |
| K3 | Sửa đơn cũ có cán bộ đề xuất khác mình → lưu → vẫn là người cũ | YC4 | x | x | **PASS (API, bản sao)** |
| K4 | `GET /health` sau deploy báo `buildId` khớp commit đã merge | OAT | x | x | **PASS trên PROD (buildId 71cfa19f khớp commit đã merge)** |
| K5 | OFFICER (không phải ADMIN): chọn được cán bộ, tạo được mục danh mục | Lỗi prod cũ | x | x | **PASS (API, bản sao)** |
| K6 | Đơn nặc danh + Trực tiếp + SĐT trống → LƯU ĐƯỢC | YC2 | x | x | **PASS (API, bản sao)** |
| K7 | Nguồn đơn để TRỐNG → nhóm định danh thu, lưu được | YC2 | x | x | **PASS (API, bản sao)** |
| K8 | Hai tab cùng mở một đơn: tab A lưu ngày thiếu → tab B tải lại thấy đúng | YC3 | x | x | **PASS (API, bản sao)** |
| K9 | Mạng hỏng giữa lúc Lưu → báo lỗi rõ, KHÔNG mất thứ đã gõ | Tổng hợp | | | |
| K10 | Ô chọn cán bộ khi máy chủ trả lỗi → báo hỏng, không báo "không có cán bộ nào" | Tải hỏng ≠ rỗng | | | |

## L. Bề mặt LIỀN KỀ — chức năng không sửa nhưng đứng cạnh chỗ sửa

Đợt này thêm một cột vào `petitions`, đổi kiểu ô `nguonDon`, và đổi nguồn cán bộ của ba
form. Mười chức năng dưới đây không nằm trong yêu cầu nhưng đọc đúng những thứ ấy — hỏng ở
đây là hỏng im lặng.

| ID | Chức năng | Nguồn | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| L1 | Form Vụ việc: ô "Chuyển từ đơn vị" GIỮ NGUYÊN kiểu cũ, không bị kéo sang danh mục | R2-SCOPE | x | - | **CHƯA CHẠY — xem ghi chú dưới bảng** |
| L2 | Danh sách Đơn thư: sắp xếp/lọc không vỡ khi có đơn ngày thiếu | YC3 | x | x | **PASS (API, bản sao)** |
| L3 | Xuất Excel Đơn thư: đơn ngày thiếu xuất ra `__/12/2026`, không ô trống lặng lẽ | YC3 | x | x | **PASS (API, bản sao)** |
| L4 | Tìm kiếm Đơn thư theo Nguồn đơn vẫn ra kết quả sau khi đổi sang danh mục (cột bóng `nguon_don_bd`) | YC2 | x | x | **PASS (API, bản sao)** |
| L5 | Chuyển Đơn thư thành Vụ án: mang theo Nguồn đơn và Ngày viết đơn đúng | Tổng hợp | x | x | **PASS (API, bản sao)** |
| L6 | Tạo đơn mới: STT tự sinh `DT-YYYY-NNNNN` vẫn đúng sau khi thêm cột | Tổng hợp | x | x | **PASS (API, bản sao)** |
| L7 | ADMIN duyệt được mục danh mục ở trạng thái chờ duyệt | YC2 | x | x | **PASS (API, bản sao)** |
| L8 | Hộp Phân công dùng chung nguồn cán bộ mới: đủ người, không lọt tài khoản khoá | Lỗi prod 1+2 |  |  |  |
| L9 | Cổng field-parity của Vụ án/Vụ việc vẫn xanh trên bản đã deploy | Đ0/Đ4 |  |  |  |
| L10 | Mở form Đơn thư trên Chrome thật: 0 lỗi console, 0 lượt mạng 4xx/5xx lạ | Tổng hợp |  |  |  |


### Ghi chú nhóm D/E — 8 ca CHƯA CHẠY, KHÔNG phải đạt

Ca đã VIẾT (`tests/e2e/vu-an-vu-viec-can-bo-uat.e2e.spec.ts`) nhưng chưa chạy được, vì **điều
hướng của hai form cũ**, không phải vì thứ đợt này sửa:

- Nút "Mở rộng" là nút thu/mở **thanh điều hướng của ứng dụng**, không phải khối của form.
- Các nút tab của form Vụ việc nằm ở toạ độ y≈3179 trong khung nhìn cao 720, và bấm vào bị
  một thanh công cụ dính đáy chắn — `scrollIntoViewIfNeeded` tới được nhưng `click` hết giờ.
- Ô "Điều tra viên chính" của Vụ án có trong DOM nhưng `display:none` ở tab mặc định.

**Đã có bằng chứng ở tầng khác cho cùng mệnh đề**, nên đây là khoảng trống về TẦNG chứ không
phải về chức năng:

| Mệnh đề | Bằng chứng đang có |
|---|---|
| Ô chọn cán bộ gom nhóm theo tổ | `gomCanBoTheoTo.test.ts` (25 ca) + E2E nhóm A trên cùng thành phần `FKSelect` |
| Tổ địa bàn gộp làm MỘT nhóm | 7 ca đơn vị + 2 ca API trên dữ liệu thật (168 tài khoản địa bàn) |
| Máy chủ trả cờ `laDiaBan` | 2 ca API, có ca đòi dữ liệu phải có CẢ hai loại tổ |
| Ô Nguồn đơn ở Vụ án có tạo mới | **D2 PASS** trên Chrome thật |

**Việc còn phải làm:** hiểu đúng cách chuyển tab của hai form cũ rồi chạy 8 ca này. Không
đánh dấu đạt khi chưa chạy.

---

## Đối chiếu ngược với 5 yêu cầu gốc

| Yêu cầu | Ca kiểm phủ |
|---|---|
| 1. Chọn cán bộ smartselect + gom nhóm theo Tổ | A1–A7, C1–C4, D1, E1–E2, I1, K5, K10, L8 |
| 2. Nguồn đơn thành danh mục + nhóm định danh bung/thu | A9–A15, D2, D4, G1–G3, H2–H3, H6, K1, K6, K7, L1, L4, L7 |
| 3. Ngày viết đơn nhập thiếu | A16–A19, B2–B4, F1–F4, H4, I3, K2, K8, L2, L3 |
| 4. Cán bộ đề xuất mặc định = người đăng nhập | A8, K3 |
| 5. Nhóm "Thông tin khác" thu gọn | A20–A21, B5, J1–J2 |

**Không yêu cầu nào thiếu ca kiểm.**
