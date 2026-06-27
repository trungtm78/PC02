# UAT — FIELD-PARITY DI TRÚ (Đơn / Vụ việc / Vụ án)

**Mode**: FEATURE-LEVEL (round-trip persistence) | **Generated**: 2026-06-07 | **Nhánh**: `feat/legacy-parity-migration`
**Trọng tâm**: CHỨNG MINH *"nhập field di trú → LƯU đúng → đọc lại khớp"* — đóng đúng gốc bệnh **"nhập không lưu"** (service map tay làm rớt field khi create/update).

> Khác UAT tổng quát (đã có ở `docs/uat/{cases,incidents,petitions,utdt}`), bộ này **chỉ** phủ các field MỚI bổ sung khi di trú dữ liệu hệ thống cũ pc02hcm.com (PR1→PR4), tập trung độ phủ **field × (create / update / read-back)** thay vì shotgun số lượng.

---

## ⚠️ Ghi chú kỹ thuật bắt buộc cho Runner

| Mục | Giá trị đúng | Bẫy |
|-----|--------------|-----|
| **API login body** | `POST /api/v1/auth/login` body = `{ "username": "<email>", "password": "<pwd>" }` | `test-accounts.json` ghi `{email,password}` là **SAI** — DTO thật là `username` (multi-field login). Dùng `username`. |
| **Token** | response `accessToken` (JWT), header `Authorization: Bearer <token>` | |
| **Petition create** | `POST /api/v1/petitions` | senderName NOT NULL ở DB → đơn nặc danh lưu chuỗi rỗng `""` |
| **Case statistic** | gửi qua `payload.statistic` (object lồng), đọc lại qua `GET /cases/:id` field `statistic` | getById có `include: { statistic: true }` |
| **crimeChinhId** | FK String → bảng `crimes` (id của điều BLHS). KHÔNG phải Directory(type=CRIME) | gửi `""` → lưu `null` (logic `dto.crimeChinhId || null`) |
| **Số field thống kê có @Min(0)** | gửi số âm → **400** ValidationPipe | dùng cho RED/BOUNDARY |
| **Field ngày** | ISO date string (`IsDateString`) → service convert `new Date()` | gửi `"2026-13-40"` → 400 |

**Inventory field (tên thật trong code — runner assert đúng key này):**
- **Petition (15 parity + 11 v0.47):** `senderIdNumber, senderIdIssueDate, senderIdIssuePlace, senderIsAnonymous, loaiThongTin, soPhieuChuyen, ngayPhieuChuyen, ngayTiepNhanNguonTin, toiDanhBanDau, crimeChinhId, noiXayRa, ngayGiaoDonViGiaiQuyet, laCongNgheCao, lanhDaoToTung, ketQuaXuLyKhac` + (v0.47) `nhanThay, deXuat, raSoatTrung, baoCaoBanGiamDoc, petitionDate, nguonDon, subTeamAssigned, lyDoChuyen, canCuPhapLy, huongDanKhoiKien, lyDoTraDon`
- **Incident (5):** `soQDPhanCongNguonTin, ngayQDPhanCongNguonTin, canCuKhongKhoiTo, canCuTamDinhChi, phanLoaiDanSuText`
- **Case stage QĐ (15):** `soQuyetDinhKhoiTo, soQDNhapVuAn, ngayNhapVuAn, ghiChuNhapHoSo, soQDTachVuAn, ngayTachVuAn, soQDTachHanhVi, ngayTachHanhVi, soQDDinhChiVuAn, ngayDinhChiVuAn, chuyenVuAnChoCQK, soBanAnCoHieuLuc, ngayBanAnCoHieuLuc, canCuTamDinhChiVuAn, canCuPhucHoiVuAn`
- **case_statistic (34):** `soDangKyHoSo, ngayDangKyHoSo, hoSoLuu, ngayNopLuuHoSo, donViBaoQuanHoSo, coGhiAmGhiHinh, tongSoBienBanGhiLoiKhai, soBienBanGhiLoiKhaiCoGhiAm, laVuAnGhiAmGhiHinh, tongSoBienBanHoiCung, tongSoBienBanHoiCungCoGhiAm, soBiCanCoGhiAm, vksYeuCauGhiAm, soBiCanVksYeuCauGhiAm, coVPHC, soDoiTuongVPHC, soNguoiBiPhatTien, tongTienPhatHanhChinh, soDoiTuongDaBat, soDoiTuongBiBatVuAnKhac, dieuTraMoRong, suDungVuKhiNong, coBangNhom, soBangNhomBatDuoc, soSungThuHoi, soThuocNoThuHoi, soDoiTuongSuuTraHiemNghi, ngayThongKe, ngayPhanCongGiaiQuyetToGiac, ngayTiepNhanTin, ngayDauThu, ngayPhamToiQuaTang, ngayBatKhanCap, ngayPhatHienDauHieu`

---

## 1. Hiểu biết về Feature

| Mục | Nội dung |
|-----|----------|
| **Tên feature** | Field-parity di trú — bổ sung trường dữ liệu hệ thống cũ vào Đơn/Vụ việc/Vụ án |
| **Module/Màn hình** | PetitionFormPage, IncidentFormPage, CaseFormPage (tab "Thông tin vụ án" + "Thống kê") |
| **Actor chính** | Cán bộ thụ lý (OFFICER) + Admin |
| **Business goal** | Mọi trường nghiệp vụ hệ thống cũ phải nhập được + lưu được + đọc lại đúng để di trú không mất dữ liệu |
| **API endpoints** | `POST/PATCH /api/v1/petitions`, `/api/v1/incidents`, `/api/v1/cases`; `GET /api/v1/{...}/:id` |
| **Input bắt buộc** | Tùy nghiệp vụ — đa số field parity là OPTIONAL (di trú dữ liệu thiếu); riêng tạo MỚI: senderName/senderPhone bắt buộc TRỪ khi `senderIsAnonymous=true` |
| **Output kỳ vọng** | Record trả về (read-back) chứa **đúng** mọi giá trị đã gửi (string/number/boolean/date), không rớt, không sai kiểu |
| **Giả định (cần PO xác nhận)** | (1) Field parity OPTIONAL ở update để dữ liệu cũ thiếu vẫn lưu được. (2) crimeChinhId không validate FK tồn tại ở tầng DTO (chỉ lưu id); resolve ở migration. → cần xác nhận có nên 400 khi id không tồn tại không. |

---

## 2. Ma trận truy vết

| TC-ID | Loại | Module | Tiêu đề | Ưu tiên | Yêu cầu |
|-------|------|--------|---------|---------|---------|
| FP-PET-01 | GREEN | Petition | Create đầy đủ 26 field parity → read-back khớp 100% | P0 | PARITY-PET |
| FP-PET-02 | GREEN | Petition | Update toàn bộ field parity trên đơn đã có → read-back khớp | P0 | PARITY-PET |
| FP-PET-03 | STATE | Petition | Partial update 1 field KHÔNG xóa các field parity khác | P0 | PARITY-PET |
| FP-PET-04 | BOUNDARY | Petition | Đơn nặc danh: senderIsAnonymous=true, senderName/Phone trống → tạo OK, lưu `""` | P0 | PARITY-ANON |
| FP-PET-05 | RED | Petition | Không nặc danh + thiếu senderName → 400 | P0 | PARITY-ANON |
| FP-PET-06 | RED | Petition | Không nặc danh + thiếu senderPhone → 400 | P0 | PARITY-ANON |
| FP-PET-07 | GREEN | Petition | crimeChinhId = id điều BLHS hợp lệ → lưu + read-back đúng id | P0 | PARITY-CRIME |
| FP-PET-08 | DATA | Petition | crimeChinhId = `""` → lưu thành `null` (không lưu chuỗi rỗng) | P1 | PARITY-CRIME |
| FP-PET-09 | RED | Petition | crimeChinhId = id không tồn tại trong crimes → hành vi xác định (400 hoặc lưu treo — ghi nhận) | P1 | PARITY-CRIME |
| FP-PET-10 | DATA | Petition | Field ngày (ngayTiepNhanNguonTin...) round-trip giữ đúng ngày (timezone VN) | P1 | PARITY-PET |
| FP-PET-11 | RED | Petition | Field ngày sai định dạng `2026-13-40` → 400 | P1 | PARITY-PET |
| FP-PET-12 | DATA | Petition | laCongNgheCao bỏ trống → default false (không null) | P2 | PARITY-PET |
| FP-INC-01 | GREEN | Incident | Create 5 field parity vụ việc → read-back khớp | P0 | PARITY-INC |
| FP-INC-02 | GREEN | Incident | Update 5 field parity → read-back khớp | P0 | PARITY-INC |
| FP-INC-03 | STATE | Incident | Partial update không xóa field parity khác | P0 | PARITY-INC |
| FP-INC-04 | DATA | Incident | ngayQDPhanCongNguonTin round-trip đúng ngày | P1 | PARITY-INC |
| FP-INC-05 | RED | Incident | ngayQDPhanCongNguonTin sai định dạng → 400 | P2 | PARITY-INC |
| FP-CASE-01 | GREEN | Case | Create 15 field stage QĐ → read-back khớp | P0 | PARITY-CASE |
| FP-CASE-02 | GREEN | Case | Update 15 field stage QĐ → read-back khớp | P0 | PARITY-CASE |
| FP-CASE-03 | GREEN | Case | Create case kèm payload.statistic 34 field → getById trả statistic khớp | P0 | PARITY-STAT |
| FP-CASE-04 | STATE | Case | Update statistic (upsert) — case chưa có statistic → tạo mới; có rồi → cập nhật | P0 | PARITY-STAT |
| FP-CASE-05 | DATA | Case | statistic boolean (coGhiAmGhiHinh, coVPHC, coBangNhom) round-trip đúng true/false | P1 | PARITY-STAT |
| FP-CASE-06 | DATA | Case | statistic số nguyên @Min(0) round-trip đúng (0 hợp lệ) | P1 | PARITY-STAT |
| FP-CASE-07 | BOUNDARY | Case | statistic số âm (vd soSungThuHoi=-1) → 400 | P1 | PARITY-STAT |
| FP-CASE-08 | DATA | Case | statistic tongTienPhatHanhChinh số thực (IsNumber) round-trip đúng | P2 | PARITY-STAT |
| FP-CASE-09 | DATA | Case | statistic 9 field ngày round-trip đúng | P2 | PARITY-STAT |
| FP-CASE-10 | STATE | Case | getById KHÔNG có statistic → field `statistic` = null/absent, không lỗi | P1 | PARITY-STAT |
| FP-SEC-01 | SECURITY | Cross | OFFICER team khác không update được field parity của đơn/vụ ngoài scope (403/404) | P0 | PARITY-SEC |
| FP-E2E-01 | E2E | Cross | UI: nhập đủ field parity ở form → lưu → mở lại form → mọi field hiển thị đúng (round-trip qua DOM) | P0 | PARITY-E2E |
| FP-E2E-02 | E2E | Case | UI: nhập tab Thống kê 34 field → lưu → reload → giá trị giữ nguyên | P0 | PARITY-STAT |
| FP-UIC-01 | UI_CONSISTENCY | Petition | Toggle nặc danh → ẩn/bỏ-bắt-buộc senderName/Phone nhất quán | P1 | PARITY-ANON |
| FP-UIC-02 | UI_CONSISTENCY | Cross | CrimeSelect (chọn tội danh FK crimes) hành vi giống nhau ở Petition + Subject | P1 | PARITY-CRIME |

**Tổng: 32 TC** — P0: 18, P1: 10, P2: 4.

---

## 3. Test Cases chi tiết

### 3.1. Module: Petition (Đơn / Nguồn tin)

| TC-ID | FP-PET-01 |
|-------|-----------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Create đơn với đầy đủ 26 field parity → read-back khớp 100% |
| **Yêu cầu** | PARITY-PET |
| **Điều kiện tiên quyết** | 1. Đăng nhập OFFICER (officer1@pc02.local)<br>2. Tồn tại ≥1 điều trong bảng `crimes` (lấy id qua `GET /api/v1/crimes?pc02Only=true`) |
| **Các bước kiểm thử** | 1. `POST /api/v1/petitions` body gồm field bắt buộc (receivedDate, senderName, unit, petitionType) + TẤT CẢ 26 field parity với giá trị phân biệt được (string độc nhất, ngày cụ thể, boolean true, crimeChinhId hợp lệ)<br>2. Lưu lại `id` từ response<br>3. `GET /api/v1/petitions/:id` |
| **Dữ liệu kiểm thử** | nhanThay:"NT-PARITY-01", deXuat:"DX-01", raSoatTrung:"RST-01", baoCaoBanGiamDoc:"BC-01", loaiThongTin:"Tố giác", soPhieuChuyen:"PC-2026-001", ngayTiepNhanNguonTin:"2026-03-15", toiDanhBanDau:"Trộm cắp tài sản", crimeChinhId:`<id crimes>`, noiXayRa:"Quận 1, TP.HCM", laCongNgheCao:true, lanhDaoToTung:"Đồng chí A", ketQuaXuLyKhac:"Chuyển xác minh", senderIdNumber:"079201001234", senderIdIssuePlace:"CSGT", ... |
| **Kết quả mong đợi** | 1. HTTP 201<br>2. `GET` trả về TẤT CẢ 26 field parity với **đúng** giá trị đã gửi (string khớp ký tự, ngày khớp, boolean khớp, crimeChinhId = id đã gửi)<br>3. Không field nào null/undefined/rớt<br>4. enteredById = id officer1 (không cho client giả mạo) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | TC cốt lõi chống "nhập không lưu" ở CREATE (buildPetitionCreateData) |

| TC-ID | FP-PET-02 |
|-------|-----------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Update toàn bộ field parity trên đơn đã có → read-back khớp |
| **Yêu cầu** | PARITY-PET |
| **Điều kiện tiên quyết** | Đã có đơn tạo ở FP-PET-01 (hoặc tạo mới rỗng field parity) |
| **Các bước kiểm thử** | 1. `PATCH /api/v1/petitions/:id` gửi 26 field parity với giá trị MỚI khác lần tạo<br>2. `GET /api/v1/petitions/:id` |
| **Dữ liệu kiểm thử** | nhanThay:"NT-UPDATED", crimeChinhId:`<id crimes khác>`, laCongNgheCao:false, ngayTiepNhanNguonTin:"2026-04-20", ... |
| **Kết quả mong đợi** | 1. HTTP 200<br>2. read-back phản ánh **giá trị mới** cho cả 26 field (không giữ giá trị cũ, không rớt) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |
| **Ghi chú** | Cốt lõi chống "nhập không lưu" ở UPDATE (block spread 569–609) |

| TC-ID | FP-PET-03 |
|-------|-----------|
| **Loại** | STATE |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Partial update 1 field KHÔNG xóa các field parity khác |
| **Yêu cầu** | PARITY-PET |
| **Điều kiện tiên quyết** | Đơn đã có đủ 26 field parity (sau FP-PET-01) |
| **Các bước kiểm thử** | 1. `PATCH /api/v1/petitions/:id` body CHỈ `{ "nhanThay": "ONLY-THIS" }`<br>2. `GET /api/v1/petitions/:id` |
| **Kết quả mong đợi** | 1. nhanThay = "ONLY-THIS"<br>2. 25 field parity còn lại **giữ nguyên** giá trị cũ (spread `!== undefined` → field không gửi thì không ghi đè) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |
| **Ghi chú** | Bắt lỗi update ghi đè null khi field vắng mặt |

| TC-ID | FP-PET-04 |
|-------|-----------|
| **Loại** | BOUNDARY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Đơn nặc danh — senderIsAnonymous=true, senderName/Phone trống → tạo OK |
| **Yêu cầu** | PARITY-ANON |
| **Các bước kiểm thử** | 1. `POST /api/v1/petitions` với `senderIsAnonymous:true`, KHÔNG gửi senderName, senderPhone, crimeChinhId (cả 3 đều `@ValidateIf(!senderIsAnonymous)` → được bỏ khi nặc danh), đủ field bắt buộc còn lại<br>2. `GET /api/v1/petitions/:id` |
| **Kết quả mong đợi** | 1. HTTP 201 (ValidateIf bỏ qua bắt buộc khi nặc danh)<br>2. senderName lưu `""` (NOT NULL DB), senderPhone = null/undefined<br>3. senderIsAnonymous = true read-back |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |
| **Ghi chú** | Boundary nghiệp vụ nặc danh |

| TC-ID | FP-PET-05 |
|-------|-----------|
| **Loại** | RED |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Không nặc danh + thiếu senderName → 400 |
| **Yêu cầu** | PARITY-ANON |
| **Các bước kiểm thử** | 1. `POST /api/v1/petitions` `senderIsAnonymous:false` (hoặc bỏ trống), KHÔNG gửi senderName |
| **Kết quả mong đợi** | HTTP 400, message chỉ rõ senderName bắt buộc |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-PET-06 |
|-------|-----------|
| **Loại** | RED |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Không nặc danh + thiếu senderPhone → 400 |
| **Yêu cầu** | PARITY-ANON |
| **Các bước kiểm thử** | 1. `POST /api/v1/petitions` không nặc danh, có senderName, KHÔNG gửi senderPhone |
| **Kết quả mong đợi** | HTTP 400 chỉ rõ senderPhone bắt buộc khi không nặc danh |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |
| **Ghi chú** | Nếu thực tế senderPhone không required-on-create → cập nhật spec; verify ValidateIf trong DTO |

| TC-ID | FP-PET-07 |
|-------|-----------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | crimeChinhId = id điều BLHS hợp lệ → lưu + read-back đúng id |
| **Yêu cầu** | PARITY-CRIME |
| **Điều kiện tiên quyết** | Lấy `id` 1 điều từ `GET /api/v1/crimes?pc02Only=true` |
| **Các bước kiểm thử** | 1. Create/Update petition với crimeChinhId = id đó<br>2. read-back |
| **Kết quả mong đợi** | crimeChinhId read-back = đúng id đã gửi (FK→crimes, lưu id không lưu name) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-PET-08 |
|-------|-----------|
| **Loại** | DATA |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | crimeChinhId = `""` → lưu thành null |
| **Yêu cầu** | PARITY-CRIME |
| **Các bước kiểm thử** | 1. `PATCH` petition crimeChinhId:`""`<br>2. read-back |
| **Kết quả mong đợi** | crimeChinhId = null (logic `dto.crimeChinhId || null`), không lưu chuỗi rỗng |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-PET-09 |
|-------|-----------|
| **Loại** | RED |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | crimeChinhId = id không tồn tại → hành vi xác định |
| **Yêu cầu** | PARITY-CRIME |
| **Các bước kiểm thử** | 1. Create petition crimeChinhId:"clxxxx-khong-ton-tai" |
| **Kết quả mong đợi** | crimeChinhId là **cột String thường, KHÔNG Prisma FK** (pattern Subject.crimeId + @@index) → DTO chỉ `@IsString @IsNotEmpty`, không check tồn tại → **id rác SẼ được lưu** (HTTP 201). ĐÂY LÀ GAP THẬT: thống kê tội danh có thể trỏ id không tồn tại. Đề xuất: validate id ∈ crimes ở service, trả 400. |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |
| **Ghi chú** | Decision audit — xác nhận với PO mức validate FK |

| TC-ID | FP-PET-10 |
|-------|-----------|
| **Loại** | DATA |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Field ngày round-trip giữ đúng ngày (timezone VN) |
| **Yêu cầu** | PARITY-PET |
| **Các bước kiểm thử** | 1. Create với ngayTiepNhanNguonTin:"2026-03-15", ngayPhieuChuyen:"2026-03-10", ngayGiaoDonViGiaiQuyet:"2026-03-20"<br>2. read-back, so phần ngày (yyyy-mm-dd) |
| **Kết quả mong đợi** | Ngày read-back = đúng ngày gửi, KHÔNG lệch ±1 ngày do timezone (UTC parse) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |
| **Ghi chú** | Lịch sử dự án từng có drift timezone (v0.42.1) — cảnh giác |

| TC-ID | FP-PET-11 |
|-------|-----------|
| **Loại** | RED |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Field ngày sai định dạng → 400 |
| **Yêu cầu** | PARITY-PET |
| **Các bước kiểm thử** | 1. Create ngayTiepNhanNguonTin:"2026-13-40" |
| **Kết quả mong đợi** | HTTP 400 (IsDateString reject) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-PET-12 |
|-------|-----------|
| **Loại** | DATA |
| **Độ ưu tiên** | P2 |
| **Tiêu đề** | laCongNgheCao bỏ trống → default false (không null) |
| **Yêu cầu** | PARITY-PET |
| **Các bước kiểm thử** | 1. Create không gửi laCongNgheCao<br>2. read-back |
| **Kết quả mong đợi** | laCongNgheCao = false (builder `?? false`), không null |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

### 3.2. Module: Incident (Vụ việc)

| TC-ID | FP-INC-01 |
|-------|-----------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Create vụ việc với 5 field parity → read-back khớp |
| **Yêu cầu** | PARITY-INC |
| **Các bước kiểm thử** | 1. `POST /api/v1/incidents` đủ field bắt buộc + soQDPhanCongNguonTin:"QD-NT-2026-01", ngayQDPhanCongNguonTin:"2026-02-10", canCuKhongKhoiTo:"Đ.157 BLTTHS", canCuTamDinhChi:"Đ.148 BLTTHS", phanLoaiDanSuText:"Tranh chấp dân sự"<br>2. `GET /api/v1/incidents/:id` |
| **Kết quả mong đợi** | 1. HTTP 201<br>2. 5 field parity read-back khớp đúng giá trị |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-INC-02 |
|-------|-----------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Update 5 field parity vụ việc → read-back khớp |
| **Yêu cầu** | PARITY-INC |
| **Các bước kiểm thử** | 1. `PATCH /api/v1/incidents/:id` 5 field giá trị mới<br>2. read-back |
| **Kết quả mong đợi** | read-back phản ánh giá trị mới, không rớt |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-INC-03 |
|-------|-----------|
| **Loại** | STATE |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Partial update không xóa field parity khác |
| **Yêu cầu** | PARITY-INC |
| **Các bước kiểm thử** | 1. `PATCH` chỉ `{canCuKhongKhoiTo:"X"}`<br>2. read-back |
| **Kết quả mong đợi** | 4 field parity còn lại giữ nguyên |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-INC-04 |
|-------|-----------|
| **Loại** | DATA |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | ngayQDPhanCongNguonTin round-trip đúng ngày |
| **Yêu cầu** | PARITY-INC |
| **Các bước kiểm thử** | Create ngayQDPhanCongNguonTin:"2026-02-10" → read-back so ngày |
| **Kết quả mong đợi** | Ngày khớp, không lệch timezone |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-INC-05 |
|-------|-----------|
| **Loại** | RED |
| **Độ ưu tiên** | P2 |
| **Tiêu đề** | ngayQDPhanCongNguonTin sai định dạng → 400 |
| **Yêu cầu** | PARITY-INC |
| **Các bước kiểm thử** | Create ngayQDPhanCongNguonTin:"không-phải-ngày" |
| **Kết quả mong đợi** | HTTP 400 |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

### 3.3. Module: Case (Vụ án) — stage QĐ + case_statistic

| TC-ID | FP-CASE-01 |
|-------|-----------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Create vụ án với 15 field stage QĐ → read-back khớp |
| **Yêu cầu** | PARITY-CASE |
| **Điều kiện tiên quyết** | caseProvenance hợp lệ (vd DIRECT_DISCOVERY để không cần linkedId) |
| **Các bước kiểm thử** | 1. `POST /api/v1/cases` đủ field bắt buộc + 15 field stage QĐ giá trị phân biệt (soQuyetDinhKhoiTo:"QD-KT-01", soQDNhapVuAn:"QD-NHAP-01", ngayNhapVuAn:"2026-01-05", ... canCuPhucHoiVuAn:"Đ.235")<br>2. `GET /api/v1/cases/:id` |
| **Kết quả mong đợi** | 1. HTTP 201<br>2. 15 field stage read-back khớp đúng |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-CASE-02 |
|-------|-----------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Update 15 field stage QĐ → read-back khớp |
| **Yêu cầu** | PARITY-CASE |
| **Các bước kiểm thử** | `PATCH /api/v1/cases/:id` 15 field giá trị mới → read-back |
| **Kết quả mong đợi** | read-back phản ánh giá trị mới |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-CASE-03 |
|-------|-----------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Create case kèm payload.statistic 34 field → getById trả statistic khớp |
| **Yêu cầu** | PARITY-STAT |
| **Các bước kiểm thử** | 1. `POST /api/v1/cases` body có `statistic: { ...34 field... }` (string/int/number/boolean/date phân biệt)<br>2. `GET /api/v1/cases/:id` đọc field `statistic` |
| **Kết quả mong đợi** | 1. HTTP 201<br>2. `statistic` read-back chứa đủ 34 field đúng giá trị + đúng kiểu (boolean là true/false, int là số, date là ngày) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |
| **Ghi chú** | Verify getById có include statistic (đã thêm ở PR4 FE gate) |

| TC-ID | FP-CASE-04 |
|-------|-----------|
| **Loại** | STATE |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Update statistic (upsert) — chưa có → tạo; có rồi → cập nhật |
| **Yêu cầu** | PARITY-STAT |
| **Các bước kiểm thử** | 1. Tạo case KHÔNG statistic<br>2. `PATCH /api/v1/cases/:id` với `statistic:{coVPHC:true, soDoiTuongVPHC:3}` → read-back (kỳ vọng tạo mới row case_statistics)<br>3. `PATCH` lần 2 `statistic:{soDoiTuongVPHC:5}` → read-back (kỳ vọng cập nhật, không nhân đôi row) |
| **Kết quả mong đợi** | Lần 1 tạo statistic; lần 2 cập nhật cùng row (1-1), soDoiTuongVPHC=5; không lỗi unique |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |
| **Ghi chú** | Verify upsert idempotent của buildCaseStatisticData |

| TC-ID | FP-CASE-05 |
|-------|-----------|
| **Loại** | DATA |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | statistic boolean round-trip đúng true/false |
| **Yêu cầu** | PARITY-STAT |
| **Các bước kiểm thử** | statistic:{coGhiAmGhiHinh:true, laVuAnGhiAmGhiHinh:false, vksYeuCauGhiAm:true, coVPHC:false, coBangNhom:true} → read-back |
| **Kết quả mong đợi** | 5 boolean read-back đúng từng true/false (không bị ép thành null/string) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-CASE-06 |
|-------|-----------|
| **Loại** | DATA |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | statistic số nguyên @Min(0) round-trip đúng (0 hợp lệ) |
| **Yêu cầu** | PARITY-STAT |
| **Các bước kiểm thử** | statistic:{tongSoBienBanGhiLoiKhai:0, soBiCanCoGhiAm:12, soSungThuHoi:3} → read-back |
| **Kết quả mong đợi** | 0 được chấp nhận (Min(0)); read-back đúng số |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-CASE-07 |
|-------|-----------|
| **Loại** | BOUNDARY |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | statistic số âm → 400 |
| **Yêu cầu** | PARITY-STAT |
| **Các bước kiểm thử** | statistic:{soSungThuHoi:-1} |
| **Kết quả mong đợi** | HTTP 400 (@Min(0) reject) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-CASE-08 |
|-------|-----------|
| **Loại** | DATA |
| **Độ ưu tiên** | P2 |
| **Tiêu đề** | statistic tongTienPhatHanhChinh số thực round-trip đúng |
| **Yêu cầu** | PARITY-STAT |
| **Các bước kiểm thử** | statistic:{tongTienPhatHanhChinh:1500000.50} → read-back |
| **Kết quả mong đợi** | read-back = 1500000.5 (IsNumber, không bị làm tròn về int) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-CASE-09 |
|-------|-----------|
| **Loại** | DATA |
| **Độ ưu tiên** | P2 |
| **Tiêu đề** | statistic 9 field ngày round-trip đúng |
| **Yêu cầu** | PARITY-STAT |
| **Các bước kiểm thử** | statistic với ngayThongKe, ngayTiepNhanTin, ngayDauThu, ngayBatKhanCap... mỗi field ngày khác nhau → read-back |
| **Kết quả mong đợi** | 9 ngày khớp đúng, không lệch timezone (CASE_STATISTIC_DATE_FIELDS convert đúng) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

| TC-ID | FP-CASE-10 |
|-------|-----------|
| **Loại** | STATE |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | getById KHÔNG có statistic → không lỗi |
| **Yêu cầu** | PARITY-STAT |
| **Các bước kiểm thử** | Tạo case không statistic → `GET /api/v1/cases/:id` |
| **Kết quả mong đợi** | HTTP 200, field statistic = null hoặc absent, không 500 |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |

### 3.4. Cross — Security

| TC-ID | FP-SEC-01 |
|-------|-----------|
| **Loại** | SECURITY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | OFFICER team khác không update field parity ngoài scope |
| **Yêu cầu** | PARITY-SEC |
| **Điều kiện tiên quyết** | Đơn/vụ tạo bởi officer1 (team A); đăng nhập officer2 (team B) |
| **Các bước kiểm thử** | 1. officer2 `PATCH /api/v1/petitions/<id của officer1>` đổi nhanThay<br>2. officer2 `GET` đơn đó |
| **Kết quả mong đợi** | PATCH trả 403 hoặc 404 (DataScope chặn); field parity KHÔNG bị đổi |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |
| **Ghi chú** | Field-parity không được mở lỗ hổng scope |

---

## 4. Test Cases liên module (E2E)

### FP-E2E-01: Round-trip field parity Petition qua UI (DOM)

| Mục | Nội dung |
|-----|----------|
| **TC-ID** | FP-E2E-01 |
| **Loại** | E2E |
| **Độ ưu tiên** | P0 |
| **User story** | Là cán bộ thụ lý, tôi nhập đầy đủ thông tin tiếp nhận nguồn tin (field di trú) ở form Đơn, lưu, rồi mở lại để chỉnh — mọi thông tin phải còn nguyên |
| **Các module đi qua** | PetitionFormPage (create) → PetitionDetail/Form (read/edit) |
| **Yêu cầu** | PARITY-E2E |
| **Điều kiện tiên quyết** | Đăng nhập UI officer1; có ≥1 tội danh trong CrimeSelect |
| **Các bước kiểm thử** | 1. Mở form tạo Đơn mới<br>2. Mở section "Tiếp nhận & luân chuyển nguồn tin", nhập: loaiThongTin, soPhieuChuyen, ngayTiepNhanNguonTin, toiDanhBanDau, noiXayRa, ngayGiaoDonViGiaiQuyet<br>3. Bật toggle "Công nghệ cao", nhập lãnhĐạoToTung, ketQuaXuLyKhac<br>4. Chọn tội danh chính qua CrimeSelect<br>5. Nhập CCCD (senderIdNumber + nơi cấp + ngày cấp)<br>6. Lưu đơn<br>7. Mở lại form chỉnh sửa đơn vừa tạo |
| **Luồng dữ liệu chuyển tiếp** | • Mọi giá trị nhập ở B2–B5 = giá trị hiển thị khi mở lại ở B7<br>• CrimeSelect hiển thị đúng tội danh đã chọn (label + value id) |
| **Kết quả mong đợi** | 1. Lưu thành công (toast "Lưu thành công" hoặc redirect)<br>2. Mở lại form: TẤT CẢ field parity hiển thị đúng giá trị đã nhập (≥3 assertion DOM: input value + CrimeSelect label + toggle state)<br>3. Không field nào bị trống/reset |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |
| **Điểm cần quan sát** | Có field nào nhập được nhưng mở lại trống không (gốc bệnh "nhập không lưu" ở tầng UI/payload) |

### FP-E2E-02: Round-trip tab Thống kê 34 field (Case)

| Mục | Nội dung |
|-----|----------|
| **TC-ID** | FP-E2E-02 |
| **Loại** | E2E |
| **Độ ưu tiên** | P0 |
| **User story** | Là cán bộ, tôi nhập số liệu thống kê mở rộng của vụ án (ghi âm-ghi hình, VPHC, vũ khí...), lưu, reload — số liệu giữ nguyên |
| **Các module đi qua** | CaseFormPage tab "Thống kê" → reload |
| **Yêu cầu** | PARITY-STAT |
| **Các bước kiểm thử** | 1. Mở form Vụ án, vào tab "Thống kê"<br>2. Mở các fieldset (ghi âm-ghi hình, VPHC, vũ khí/băng nhóm, mốc thời gian, hồ sơ nghiệp vụ), nhập đại diện mỗi nhóm (boolean toggle + số + ngày)<br>3. Lưu<br>4. Reload trang / mở lại form |
| **Luồng dữ liệu chuyển tiếp** | Giá trị nhập (payload.statistic) = giá trị hiển thị sau reload (mergeCaseApiToFormData từ data.statistic) |
| **Kết quả mong đợi** | 1. Lưu OK<br>2. Sau reload: boolean toggle giữ đúng on/off, số giữ đúng, ngày giữ đúng (≥3 assertion DOM) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | |
| **Điểm cần quan sát** | Field nào round-trip lệch (đặc biệt boolean và số 0) |

---

## 5. Dữ liệu kiểm thử

### 5.1. Tài khoản (xem `_shared/test-accounts.json`, password ở `tests/.env.test`)
| ID | username (login) | Vai trò | Dùng cho |
|----|------------------|---------|----------|
| officer1 | officer1@pc02.local | OFFICER | Tạo/sửa đơn-vụ-án trong scope |
| officer2 | officer2@pc02.local | OFFICER team khác | FP-SEC-01 scope isolation |
| admin | admin@pc02.local | ADMIN | Bypass scope khi cần |

> ⚠️ Login body field = `username` (KHÔNG `email`).

### 5.2. Lấy crimeChinhId hợp lệ
`GET /api/v1/crimes?pc02Only=true` → lấy `data[0].id`. Dùng cho FP-PET-07.

### 5.3. Giá trị biên
| Field | Hợp lệ | Không hợp lệ |
|-------|--------|--------------|
| số thống kê @Min(0) | 0, 12 | -1 (→400) |
| field ngày IsDateString | "2026-03-15" | "2026-13-40", "abc" (→400) |
| senderName (không nặc danh) | "Nguyễn Văn A" | bỏ trống (→400) |
| crimeChinhId | id crimes thật, "" (→null) | id rác (FP-PET-09 ghi nhận) |

---

## 6. Checklist độ phủ

| Loại | Số TC | Trạng thái | Ghi chú |
|------|-------|------------|---------|
| GREEN | 7 | ✅ | Create + update round-trip cả 3 module |
| RED | 5 | ✅ | Thiếu bắt buộc, sai định dạng ngày, FK rác |
| BOUNDARY | 2 | ✅ | Nặc danh, số âm |
| STATE | 4 | ✅ | Partial update không wipe; upsert statistic; getById no-statistic |
| DATA | 7 | ✅ | Ngày, boolean, số nguyên/thực, default, "" → null |
| SECURITY | 1 | ✅ | Scope isolation field parity |
| E2E | 2 | ✅ | UI round-trip Petition + Case statistic |
| UI_CONSISTENCY | 2 | ✅ | Toggle nặc danh, CrimeSelect |
| PERFORMANCE | 0 | N/A | Field-parity không đổi đặc tính hiệu năng — phủ ở UAT tổng quát |
| **Tổng** | **32** | | P0:18 / P1:10 / P2:4 |

**Cơ sở số lượng (ISTQB):** mỗi nhóm field × (create / update / partial-update / read-back) = lớp tương đương cốt lõi; thêm boundary (nặc danh, số âm, ngày sai), FK valid/invalid/empty, kiểu dữ liệu (string/int/number/boolean/date). Không nhân bản từng-field-một (cùng lớp builder → 1 TC "đủ field" đại diện đã phủ; tách riêng chỉ field có rule riêng: crimeChinhId, senderIsAnonymous, số @Min, ngày).

---

## 7. Nhận định trải nghiệm & Đề xuất cải tiến

| ID | Mức độ | Loại vấn đề | Mô tả quan sát | Tác động | Đề xuất |
|----|--------|-------------|----------------|----------|---------|
| UX-FP-01 | Cao | Luồng dữ liệu phi lý (rủi ro) | Field parity OPTIONAL toàn bộ ở update — nếu UI gửi field rỗng `null` thay vì bỏ field, có thể vô tình xóa dữ liệu di trú | Mất dữ liệu cũ khi cán bộ chỉ sửa 1 ô | FE phải gửi PATCH chỉ field thay đổi (dirty fields), không gửi cả form null. Verify ở FP-PET-03/INC-03 |
| UX-FP-02 | Trung bình | Thiếu phản hồi | crimeChinhId nhập id rác (FP-PET-09) nếu lưu treo → cán bộ không biết tội danh không hợp lệ | Dữ liệu thống kê tội danh sai | Validate FK ở service, báo lỗi "tội danh không tồn tại" |
| UX-FP-03 | Thấp | Nhất quán | Section field parity (Petition) + tab Thống kê (Case) nên nhóm rõ ràng, label tiếng Việt khớp hệ thống cũ để cán bộ quen | Cán bộ di trú phải dò field | Giữ label trùng tên cột hệ thống cũ (đã làm phần lớn) |
| UX-FP-04 (tích cực) | — | Điểm tốt | Builder gom 1 chỗ (buildPetitionCreateData) + spread update đối xứng → giảm rủi ro rớt field tái diễn | — | Giữ pattern này cho mọi field mới về sau |

---

## 8. Câu hỏi cho PO/BA

1. **crimeChinhId FK rác** (FP-PET-09): có cần validate điều BLHS tồn tại ở tầng API và trả 400 không, hay chấp nhận lưu id để migration resolve sau? (Hiện giả định: lưu id, không validate tồn tại ở DTO.)
2. **senderPhone required-on-create**: xác nhận khi KHÔNG nặc danh thì senderPhone bắt buộc (FP-PET-06) — hay chỉ senderName bắt buộc? (Verify ValidateIf trong CreatePetitionDto.)
3. **Update field parity = null**: khi cán bộ xóa trắng 1 ô đã có giá trị di trú, hành vi mong muốn là ghi null (xóa) hay giữ nguyên? (Ảnh hưởng cách FE gửi payload.)
