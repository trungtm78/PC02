# UAT-COVERAGE — epic "Đồng bộ form Vụ việc với hệ cũ"

Phạm vi lấy từ spec gốc (Phần C, PR0–PR4) và từ những gì đã thay đổi thật trong 9 PR
#268–#276. Bản chạy: prod `e1820224`.

**Nguyên tắc chọn cách kiểm.** Ca nào ca kiểm tự động chứng minh được thì để tự động — nó chạy
lại mỗi lần. Ca nào chỉ lộ khi bấm tay trên **hồ sơ di trú thật** thì phải bấm: epic này đã ba
lần bấm ra ba lỗi chặn mà 2.313 ca giao diện đều xanh.

**Hồi quy sang hai màn kia là bắt buộc.** PR #272 và #276 sửa `LegacyLayoutSection`,
`LegacyParityFields` và `registry` — ba thứ Đơn thư và Vụ án cùng dùng.

| ID | Màn hình / Chức năng | Cách kiểm | Viết | Chạy | Kết quả |
|---|---|---|---|---|---|
| **VV-01** | Form Vụ việc: dựng đủ 10 tab, đúng tên và thứ tự hệ cũ | bấm prod | ✔ | ✔ | **PASS** — đo được 10 tab đúng dãy |
| **VV-02** | Mọi ô bố cục hệ cũ đều có chỗ lưu (132 ô) | tự động `moiOCoChoLuu` | ✔ | ✔ | **PASS** |
| **VV-03** | Nhãn và thứ tự từng ô khớp đặc tả gốc | tự động `moiOCoChoLuu` | ✔ | ✔ | **PASS** |
| **VV-04** | Hồ sơ di trú: mở ra nạp đúng dữ liệu | bấm prod | ✔ | ✔ | **PASS** — nội dung, người báo, nguồn đơn, tội danh, phân loại |
| **VV-05** | Hồ sơ di trú: bấm Lưu → 200, không lỗi chặn | bấm prod | ✔ | ✔ | **PASS** (sau #273, #274) |
| **VV-06** | Lưu xong dữ liệu không hụt | bấm prod + truy vấn | ✔ | ✔ | **PASS** — nội dung đủ 294 ký tự |
| **VV-07** | Xoá trắng một ô → Lưu → mở lại phải trống | bấm prod | ✔ | ⏳ | — |
| **VV-08** | Tạo vụ việc mới qua 10 tab → lưu → mở lại → xoá | bấm prod | ✔ | ⏳ | — |
| **VV-09** | Ô "Tóm tắt nội dung" ghi cả `name` lẫn `description` | tự động `tomTatGhiCaHaiCot` | ✔ | ✔ | **PASS** |
| **VV-10** | Hồ sơ có tên riêng khác tóm tắt KHÔNG bị đổi tên | tự động | ✔ | ✔ | **PASS** |
| **VV-11** | Tên dài quá hạn bị cắt, nội dung giữ đủ | tự động + bấm prod | ✔ | ✔ | **PASS** |
| **VV-12** | Ô "Phân loại ban đầu" nhận giá trị đang lưu | tự động `boLuaChonPhaiChuaGiaTriDangLuu` + prod | ✔ | ✔ | **PASS** |
| **VV-13** | Ô tội danh tra được bảng BLHS | bấm prod | ✔ | ✔ | **PASS** — "Điều 174 · Tội…" |
| **VV-14** | Ô chọn-nhiều không có bộ lựa chọn vẫn nhập được | tự động `oChonNhieuKhongDuocChet` | ✔ | ✔ | **PASS** |
| **VV-15** | Khối "Bổ sung hệ mới" không còn ô trùng | tự động `khongCoOTrungTrongKhoiBoSung` | ✔ | ✔ | **PASS** |
| **VV-16** | Nút "Khởi tố thành vụ án" còn nguyên | tự động + bấm prod | ✔ | ⏳ | — |
| **VV-17** | Ô hệ cũ chưa có cột lưu được ngay ở màn tạo mới | tự động | ✔ | ✔ | **PASS** |
| **DS-01** | Danh sách Vụ việc: 9 cột hệ cũ + Trạng thái | tự động + bấm prod | ✔ | ✔ | **PASS** |
| **DS-02** | Cột "Nguồn đơn/Đơn vị giao" hiện đúng dữ liệu | bấm prod | ✔ | ✔ | **PASS** — trang 8 hiện "Công an P.Phú Thọ" |
| **DS-03** | Cột đọc trường nào thì truy vấn trả về trường ấy | tự động `cot-danh-sach-phai-duoc-tra-ve` | ✔ | ✔ | **PASS** |
| **DL-01** | Bù `crimeChinhId` 1.117 hồ sơ | truy vấn prod | ✔ | ✔ | **PASS** |
| **DL-02** | Bù `phanLoaiNguonTinBanDau` 4.693 · `baoCaoBanGiamDocText` 96 | truy vấn prod | ✔ | ✔ | **PASS** |
| **DL-03** | Bù không đè giá trị cán bộ đã sửa, chạy hai lần như một | tự động | ✔ | ✔ | **PASS** |
| **DL-04** | Không sót field hệ cũ có dữ liệu | tự động `field-parity.gate` | ✔ | ✔ | **PASS** |
| **HQ-01** | **Hồi quy Đơn thư**: form 10 tab vẫn mở, nạp, lưu được | bấm prod | ✔ | ⏳ | — |
| **HQ-02** | **Hồi quy Vụ án**: form 10 tab vẫn mở, nạp, lưu được | bấm prod | ✔ | ⏳ | — |
| **HQ-03** | **Hồi quy panel parity**: xoá trắng gửi `null` ở cả ba màn | tự động `panelParityXoaTrangGuiNull` | ✔ | ✔ | **PASS** |
| **HQ-04** | Cả hai bộ ca kiểm đầy đủ xanh | `jest` + `vitest` | ✔ | ✔ | **PASS** — 3.372 + 2.313 |
| **CI-01** | Lỗ hổng chèn mã ở workflow đã vá | đọc mã + CI xanh | ✔ | ✔ | **PASS** |

## Còn phải chạy

`VV-07` · `VV-08` · `VV-16` · `HQ-01` · `HQ-02` — đều là bấm tay trên máy thật.
