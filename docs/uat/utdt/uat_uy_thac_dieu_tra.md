# UAT — Quản lý Ủy Thác Điều Tra (UTDT)

> **Phiên bản:** 1.0.0  
> **Ngày soạn:** 2026-05-31  
> **Tác giả:** Claude (uat-test-writer-web)  
> **Chuẩn áp dụng:** ISO/IEC/IEEE 29119, ISTQB Foundation, Nielsen's 10 Heuristics, ISO 25010  

---

## Phase 0 — Phân tích Pattern Codebase (UI_CONSISTENCY Baseline)

Trước khi viết test case, em so sánh UTDT với 3 module list đã có (Cases, Incidents, Petitions):

| Pattern | Cases | Incidents | Petitions | **UTDT** | Gap? |
|---------|-------|-----------|-----------|----------|------|
| Bulk selection (checkbox + BulkActionBar) | ✅ | ✅ | ✅ | ❌ | **P0 gap — majority 3/3** |
| Stats cards strip (đầu trang) | ✅ 5 cards | ✅ 5 cards | ✅ 5 cards | ✅ 5 cards | Nhất quán |
| Status filter chips | ✅ | ✅ | ✅ | ✅ | Nhất quán |
| Toolbar 2-row layout | ✅ | ✅ | ✅ | ✅ | Nhất quán |
| Actions column (cuối bảng) | ✅ cuối | ✅ cuối | ✅ cuối | ✅ cuối | Nhất quán |
| Delete với reason textarea (≥10 ký tự) | ✅ | ✅ | ✅ | ✅ | Nhất quán |
| Overdue row highlight (đỏ) | ❌ | ✅ | ✅ | ✅ (QUA_HAN) | Nhất quán (Incidents/Petitions) |
| Pagination 20/page | ✅ | ✅ | ✅ | ✅ | Nhất quán |
| Empty state | ✅ | ✅ | ✅ | cần verify | Chờ kiểm tra |
| Export bulk | ✅ | ✅ | ✅ | ❌ | P2 (thiếu bulk adapter) |

**Kết luận Phase 0:** 1 gap P0 (bulk selection), 1 gap P2 (export). Sẽ sinh test case UI_CONSISTENCY tự động.

---

## 1. Hiểu biết về Feature

| Mục | Nội dung |
|-----|----------|
| **Tên feature** | Quản lý Ủy Thác Điều Tra (UTDT) |
| **Module/Màn hình** | `/uy-thac-dieu-tra` (List), `/cases/new?caseProvenance=UY_THAC_DIEU_TRA` (Tạo mới), `/cases/:id/edit` tab "Thông tin Ủy thác" (Sửa) |
| **Actor chính** | Dispatcher (toàn quyền), Điều tra viên (chỉ trong phạm vi đơn vị), Admin |
| **Business goal** | Quản lý việc tiếp nhận và theo dõi phản hồi các vụ việc được ủy thác từ đơn vị khác, theo Điều 171 BLTTHS 2015 và TT 28/2020/TT-BCA |
| **API endpoints liên quan** | `GET /api/v1/cases?caseType=UY_THAC_DIEU_TRA` — Danh sách UTDT<br>`GET /api/v1/cases/utdt-stats` — Thống kê 5 chỉ số<br>`GET /api/v1/cases/:id` — Chi tiết<br>`POST /api/v1/cases` (caseProvenance=UY_THAC_DIEU_TRA) — Tạo mới<br>`PATCH /api/v1/cases/:id` — Cập nhật<br>`DELETE /api/v1/cases/:id` — Xóa mềm (soft delete) |
| **UI screens liên quan** | UyThacDieuTraListPage, CaseFormPage (tab 1 = CaseFormTab1UyThac) |
| **Input bắt buộc** | `donViGiao` (Đơn vị giao) — trường bắt buộc; `loaiUyThac` — khuyến nghị |
| **Output kỳ vọng** | Hồ sơ UTDT được lưu, trạng thái phản hồi tự tính (`TrangThaiPhanHoi` = computed), hiển thị đúng trong danh sách |
| **Trạng thái phản hồi (computed — KHÔNG lưu DB)** | `DA_PHAN_HOI`: `ketQuaUyThac ≠ null AND ngayTraKetQua ≠ null`<br>`KHONG_THUC_HIEN_DUOC`: `metadata.lyDoKhongThucHienDuoc ≠ null`<br>`QUA_HAN`: `thoiHanUyThac < now() AND không phản hồi AND không có lý do`<br>`CHUA_PHAN_HOI`: còn lại (default) |
| **Giả định (cần PO xác nhận)** | [GT-1] Khi cả `DA_PHAN_HOI` và `KHONG_THUC_HIEN_DUOC` đều có dữ liệu, `DA_PHAN_HOI` được ưu tiên (giả định dựa trên logic service)<br>[GT-2] `thoiHanUyThac = hôm nay` (midnight) được coi là QUA_HAN khi so sánh `< now()` (tức là hết ngày hôm qua là quá hạn)<br>[GT-3] Không có field `donViGiao` required validation ở backend DTO — chỉ required ở frontend form validation |

---

## 2. Ma trận truy vết

| TC-ID | Loại | Module | Tiêu đề | Độ ưu tiên | Yêu cầu |
|-------|------|--------|---------|------------|---------|
| TC-001 | GREEN | Danh sách | Trang UTDT load thành công với dữ liệu | P0 | REQ-UTDT-01 |
| TC-002 | GREEN | Thống kê | Stats cards hiển thị đúng 5 chỉ số | P0 | REQ-UTDT-02 |
| TC-003 | GREEN | Tạo mới | Tạo UTDT với đầy đủ thông tin hợp lệ | P0 | REQ-UTDT-03 |
| TC-004 | GREEN | Sửa | Cập nhật kết quả điều tra → trạng thái DA_PHAN_HOI | P0 | REQ-UTDT-04 |
| TC-005 | GREEN | Xóa | Xóa UTDT với lý do hợp lệ (≥10 ký tự) | P0 | REQ-UTDT-05 |
| TC-006 | GREEN | Lọc | Filter chip CHUA_PHAN_HOI hoạt động đúng | P1 | REQ-UTDT-06 |
| TC-007 | GREEN | Lọc | Filter chip DA_PHAN_HOI hoạt động đúng | P1 | REQ-UTDT-06 |
| TC-008 | GREEN | Lọc | Filter chip QUA_HAN — row highlight đỏ | P1 | REQ-UTDT-06 |
| TC-009 | GREEN | Lọc | Filter nâng cao — Loại ủy thác | P1 | REQ-UTDT-07 |
| TC-010 | GREEN | Lọc | Filter nâng cao — Đơn vị giao (text search) | P1 | REQ-UTDT-07 |
| TC-011 | GREEN | Lọc | Filter nâng cao — Date range Ngày tiếp nhận | P1 | REQ-UTDT-07 |
| TC-012 | GREEN | Tìm kiếm | Global search theo tên đối tượng, đơn vị giao | P1 | REQ-UTDT-08 |
| TC-013 | GREEN | Phân trang | Chuyển trang, URL cập nhật đúng | P1 | REQ-UTDT-09 |
| TC-014 | RED | Tạo mới | Tạo UTDT thiếu Đơn vị giao → validation lỗi | P0 | REQ-UTDT-10 |
| TC-015 | RED | Xóa | Xóa với lý do < 10 ký tự → bị chặn | P0 | REQ-UTDT-10 |
| TC-016 | RED | Xóa | Xóa không nhập lý do → bị chặn | P0 | REQ-UTDT-10 |
| TC-017 | RED | Lọc | Date range ToDate < FromDate → không crash, 0 kết quả | P1 | REQ-UTDT-10 |
| TC-018 | EDGE | Trạng thái | UTDT không có thời hạn → không vào QUA_HAN | P0 | REQ-UTDT-11 |
| TC-019 | EDGE | Trạng thái | Có cả ketQuaUyThac và lyDoKhongThucHienDuoc → DA_PHAN_HOI | P1 | REQ-UTDT-11 |
| TC-020 | EDGE | Trạng thái | Có ketQuaUyThac nhưng thiếu ngayTraKetQua → CHUA_PHAN_HOI | P0 | REQ-UTDT-11 |
| TC-021 | BOUNDARY | Xóa | Lý do xóa đúng 9 ký tự → thất bại | P0 | REQ-UTDT-12 |
| TC-022 | BOUNDARY | Xóa | Lý do xóa đúng 10 ký tự → thành công | P0 | REQ-UTDT-12 |
| TC-023 | BOUNDARY | Trạng thái | thoiHanUyThac = hôm nay → kiểm tra QUA_HAN behavior | P1 | REQ-UTDT-12 |
| TC-024 | BOUNDARY | Tìm kiếm | Search query trống → trả về toàn bộ danh sách | P1 | REQ-UTDT-12 |
| TC-025 | SECURITY | Phân quyền | Non-dispatcher chỉ thấy UTDT trong phạm vi đơn vị (DataScope) | P0 | REQ-UTDT-13 |
| TC-026 | SECURITY | IDOR | Truy cập trực tiếp `/cases/:id` của đơn vị khác → từ chối | P0 | REQ-UTDT-13 |
| TC-027 | SECURITY | Phân quyền | Điều tra viên không xóa được UTDT của đơn vị khác | P0 | REQ-UTDT-13 |
| TC-028 | SECURITY | Injection | SQL injection trong ô tìm kiếm | P0 | REQ-UTDT-14 |
| TC-029 | SECURITY | Injection | XSS trong trường donViGiao khi hiển thị | P0 | REQ-UTDT-14 |
| TC-030 | DATA | Encoding | Tên đơn vị giao tiếng Việt đầy dấu (Quận/Huyện) | P1 | REQ-UTDT-15 |
| TC-031 | DATA | Encoding | Kết quả điều tra chứa ký tự đặc biệt (ngoặc kép, xuống dòng) | P1 | REQ-UTDT-15 |
| TC-032 | DATA | Encoding | Đối tượng nghi vấn có emoji → hệ thống không crash | P2 | REQ-UTDT-15 |
| TC-033 | DATA | Validation | Date param không hợp lệ trong URL (utdt_tnf=abc) → ignore/400 | P1 | REQ-UTDT-15 |
| TC-034 | PERFORMANCE | Hiệu năng | GET /cases?caseType=UY_THAC_DIEU_TRA trả về <2s với 1000 records | P1 | REQ-UTDT-16 |
| TC-035 | PERFORMANCE | Hiệu năng | GET /cases/utdt-stats trả về <3s | P1 | REQ-UTDT-16 |
| TC-036 | PERFORMANCE | Hiệu năng | Search debounce — không gọi API mỗi keystroke | P2 | REQ-UTDT-16 |
| TC-037 | UI_CONSISTENCY | Nhất quán UI | UTDT thiếu bulk selection so với Cases/Incidents/Petitions | P0 | REQ-UTDT-17 |
| TC-038 | UI_CONSISTENCY | Nhất quán UI | Cột Thao tác ở cuối bảng (giống Cases/Incidents/Petitions) | P1 | REQ-UTDT-17 |
| TC-039 | UI_CONSISTENCY | Nhất quán UI | Badge QUA_HAN màu đỏ (nhất quán với overdue ở Incidents/Petitions) | P1 | REQ-UTDT-17 |
| TC-040 | UI_CONSISTENCY | Nhất quán UI | Empty state có CTA "Nhập ủy thác mới" | P1 | REQ-UTDT-17 |
| TC-041 | UI_CONSISTENCY | Nhất quán UI | Delete modal yêu cầu reason (giống Cases/Incidents/Petitions) | P0 | REQ-UTDT-17 |

---

## 3. Test Cases chi tiết

### 3.1. Module: Danh sách UTDT

| TC-ID | TC-001 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Trang UTDT load thành công với dữ liệu |
| **Yêu cầu** | REQ-UTDT-01 |
| **Điều kiện tiên quyết** | 1. Đã đăng nhập với tài khoản Dispatcher (dispatcher@pc02.local)<br>2. Có ít nhất 3 hồ sơ UTDT trong hệ thống với các trạng thái khác nhau<br>3. Trình duyệt đang ở màn hình bất kỳ |
| **Các bước kiểm thử** | 1. Click menu "Ủy Thác Điều Tra" trong sidebar<br>2. Chờ trang `/uy-thac-dieu-tra` load xong<br>3. Quan sát toàn bộ layout |
| **Dữ liệu kiểm thử** | Tài khoản: dispatcher@pc02.local |
| **Kết quả mong đợi** | 1. URL chuyển thành `/uy-thac-dieu-tra`<br>2. Tiêu đề "Ủy Thác Điều Tra" hiển thị ở header<br>3. `GET /api/v1/cases?caseType=UY_THAC_DIEU_TRA` trả về HTTP 200<br>4. `GET /api/v1/cases/utdt-stats` trả về HTTP 200<br>5. Stats cards strip hiển thị ở đầu trang (5 thẻ: Tổng, Chưa phản hồi, Đã phản hồi, Không thực hiện, Quá hạn)<br>6. Bảng danh sách hiển thị đủ 11 cột<br>7. Nút "Nhập ủy thác mới" có mặt ở góc phải header<br>8. Không có lỗi console |
| **Kết quả thực tế** | _(QA điền sau khi chạy)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Smoke test — phải đạt mỗi lần deploy |

---

| TC-ID | TC-002 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Stats cards hiển thị đúng 5 chỉ số, đồng bộ với danh sách |
| **Yêu cầu** | REQ-UTDT-02 |
| **Điều kiện tiên quyết** | 1. Đã đăng nhập Dispatcher<br>2. Có sẵn: 2 hồ sơ CHUA_PHAN_HOI, 1 DA_PHAN_HOI, 1 KHONG_THUC_HIEN_DUOC, 1 QUA_HAN |
| **Các bước kiểm thử** | 1. Mở `/uy-thac-dieu-tra`<br>2. Ghi lại số trên mỗi stats card<br>3. Click chip "Chưa phản hồi" — đếm số row trong bảng<br>4. So sánh với số trên card "Chưa phản hồi"<br>5. Lặp lại bước 3-4 cho chip "Quá hạn", "Đã phản hồi" |
| **Dữ liệu kiểm thử** | Tài khoản: dispatcher@pc02.local |
| **Kết quả mong đợi** | 1. Card "Tổng" = tổng số UTDT records<br>2. Card "Chưa phản hồi" khớp với số row khi filter CHUA_PHAN_HOI<br>3. Card "Quá hạn" khớp với số row khi filter QUA_HAN<br>4. Card "Đã phản hồi" khớp với số row khi filter DA_PHAN_HOI<br>5. Số liệu cards cập nhật ngay khi thêm/sửa/xóa hồ sơ (không cần F5) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | API stats strip filter `trangThaiPhanHoi` trước khi gửi lên server |

---

| TC-ID | TC-003 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Tạo mới UTDT với đầy đủ thông tin hợp lệ |
| **Yêu cầu** | REQ-UTDT-03 |
| **Điều kiện tiên quyết** | 1. Đã đăng nhập Dispatcher<br>2. Đang ở trang `/uy-thac-dieu-tra`<br>3. Không có hồ sơ nào với Số QĐ "58-UTDT-2026" |
| **Các bước kiểm thử** | 1. Click nút "Nhập ủy thác mới"<br>2. Trình duyệt chuyển tới form tạo Case mới<br>3. Chọn tab "Thông tin Ủy thác"<br>4. Điền Loại ủy thác: "Ủy thác điều tra"<br>5. Điền Ngày tiếp nhận: 15/05/2026<br>6. Điền Đơn vị giao: "PC01 - Công an TP. Hà Nội"<br>7. Điền Số QĐ/Phiếu ủy thác: "58-UTDT-2026"<br>8. Điền Thời hạn thực hiện: 15/06/2026<br>9. Điền Loại thông tin: "Tố giác"<br>10. Điền Nghi vấn đối tượng: "Nguyễn Văn A, SN 1990"<br>11. Điền thông tin tab khác (tên vụ việc, tội danh...)<br>12. Click nút "Lưu" |
| **Dữ liệu kiểm thử** | Đơn vị giao: PC01 - Công an TP. Hà Nội<br>Số QĐ: 58-UTDT-2026<br>Ngày tiếp nhận: 2026-05-15<br>Thời hạn: 2026-06-15 |
| **Kết quả mong đợi** | 1. `POST /api/v1/cases` trả về HTTP 201 với caseId mới<br>2. Hệ thống điều hướng về `/uy-thac-dieu-tra`<br>3. Hồ sơ mới xuất hiện đầu danh sách<br>4. Cột "Đơn vị giao" hiển thị "PC01 - Công an TP. Hà Nội"<br>5. Cột "Số QĐ/Phiếu" hiển thị "58-UTDT-2026"<br>6. Badge Trạng thái phản hồi hiển thị "Chưa phản hồi" (vì chưa có kết quả)<br>7. Card "Tổng" tăng thêm 1<br>8. Toast success "Tạo hồ sơ thành công" hiển thị |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | returnPath=/uy-thac-dieu-tra phải được truyền qua URL để redirect về đúng |

---

| TC-ID | TC-004 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Cập nhật kết quả điều tra → trạng thái tự chuyển DA_PHAN_HOI |
| **Yêu cầu** | REQ-UTDT-04 |
| **Điều kiện tiên quyết** | 1. Đã đăng nhập Dispatcher<br>2. Có sẵn UTDT "TC-004-TEST" với trạng thái CHUA_PHAN_HOI (ketQuaUyThac=null, ngayTraKetQua=null)<br>3. Đang xem danh sách UTDT |
| **Các bước kiểm thử** | 1. Click icon Sửa (bút chì) trên row "TC-004-TEST"<br>2. Chọn tab "Thông tin Ủy thác"<br>3. Quan sát badge "Trạng thái phản hồi" hiện = "Chưa phản hồi"<br>4. Điền Ngày trả kết quả: 30/05/2026<br>5. Điền Kết quả xử lý: "Đã xác minh và lập hồ sơ chuyển cơ quan có thẩm quyền xử lý"<br>6. Click "Lưu" |
| **Dữ liệu kiểm thử** | Ngày trả kết quả: 2026-05-30<br>Kết quả xử lý: "Đã xác minh và lập hồ sơ chuyển cơ quan có thẩm quyền xử lý" |
| **Kết quả mong đợi** | 1. `PATCH /api/v1/cases/:id` trả về HTTP 200<br>2. Khi vừa điền đủ cả 2 trường, badge "Trạng thái phản hồi" trong form tự cập nhật thành "Đã phản hồi" (real-time computed)<br>3. Sau khi lưu, row trong danh sách hiển thị badge "Đã phản hồi" (màu xanh lá)<br>4. Card "Đã phản hồi" trong stats tăng thêm 1<br>5. Card "Chưa phản hồi" giảm 1 |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | TrangThaiPhanHoi phải computed real-time trong form — không cần lưu để thấy preview |

---

| TC-ID | TC-005 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Xóa UTDT với lý do hợp lệ (≥10 ký tự) |
| **Yêu cầu** | REQ-UTDT-05 |
| **Điều kiện tiên quyết** | 1. Đã đăng nhập Dispatcher<br>2. Có sẵn UTDT "TC-005-DELETE" chưa phản hồi<br>3. Đang ở trang danh sách UTDT |
| **Các bước kiểm thử** | 1. Click icon Xóa (thùng rác) trên row "TC-005-DELETE"<br>2. Dialog xác nhận xóa hiện ra<br>3. Nhập lý do: "Hủy theo yêu cầu đơn vị giao - QĐ số 15/2026"<br>4. Click nút "Xác nhận xóa" |
| **Dữ liệu kiểm thử** | Lý do xóa: "Hủy theo yêu cầu đơn vị giao - QĐ số 15/2026" (45 ký tự) |
| **Kết quả mong đợi** | 1. `DELETE /api/v1/cases/:id` trả về HTTP 200 hoặc 204<br>2. Hồ sơ biến mất khỏi danh sách ngay lập tức<br>3. Toast "Đã xóa hồ sơ" hiển thị<br>4. Card "Tổng" giảm 1<br>5. Dữ liệu thực tế vẫn còn trong DB (soft delete — `deletedAt` được set, không phải hard delete) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Audit trail: lý do xóa phải được ghi vào audit log (DELEGATION_DELETED) |

---

| TC-ID | TC-006 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Filter chip "Chưa phản hồi" lọc đúng danh sách |
| **Yêu cầu** | REQ-UTDT-06 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có hồ sơ ở cả 4 trạng thái phản hồi |
| **Các bước kiểm thử** | 1. Mở `/uy-thac-dieu-tra` — không có filter nào<br>2. Click chip "Chưa phản hồi"<br>3. Quan sát kết quả bảng và URL |
| **Dữ liệu kiểm thử** | Tài khoản: dispatcher@pc02.local |
| **Kết quả mong đợi** | 1. URL cập nhật: `?utdt_status=CHUA_PHAN_HOI`<br>2. API gọi: `GET /cases?caseType=UY_THAC_DIEU_TRA&trangThaiPhanHoi=CHUA_PHAN_HOI`<br>3. Tất cả row hiển thị đều có badge "Chưa phản hồi"<br>4. Không có row nào có badge "Đã phản hồi", "Quá hạn", "Không thực hiện"<br>5. Chip "Chưa phản hồi" có visual active state (màu/border khác biệt)<br>6. Click lại chip → bỏ filter, trả về toàn bộ |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Filter chip URL-persistent: F5 trang vẫn giữ filter |

---

| TC-ID | TC-007 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Filter chip "Quá hạn" — row hiển thị highlight đỏ |
| **Yêu cầu** | REQ-UTDT-06 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có ít nhất 1 UTDT với thoiHanUyThac < hôm nay và chưa phản hồi |
| **Các bước kiểm thử** | 1. Mở `/uy-thac-dieu-tra`<br>2. Click chip "Quá hạn"<br>3. Quan sát màu nền các row trong bảng |
| **Dữ liệu kiểm thử** | UTDT "TC-007-QUA-HAN": thoiHanUyThac = 2026-05-01 (quá hạn) |
| **Kết quả mong đợi** | 1. Chỉ hiển thị các UTDT có `thoiHanUyThac < now()` và chưa phản hồi<br>2. Các row trong danh sách có background highlight màu đỏ nhạt (giống Incidents/Petitions quá hạn)<br>3. Cột "Thời hạn" hiển thị ngày với text màu đỏ<br>4. Badge trạng thái "Quá hạn" màu đỏ |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Row highlight đỏ là pattern nhất quán với Incidents/Petitions — phải có |

---

| TC-ID | TC-008 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Filter nâng cao — Loại ủy thác lọc đúng |
| **Yêu cầu** | REQ-UTDT-07 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có UTDT với loaiUyThac = UY_THAC_DIEU_TRA và CHUYEN_DON_NGUON_TIN |
| **Các bước kiểm thử** | 1. Mở `/uy-thac-dieu-tra`<br>2. Mở bộ lọc nâng cao<br>3. Chọn "Loại ủy thác" = "Ủy thác điều tra"<br>4. Quan sát kết quả |
| **Dữ liệu kiểm thử** | Lọc: loaiUyThac = UY_THAC_DIEU_TRA |
| **Kết quả mong đợi** | 1. Chỉ hiển thị hồ sơ có loaiUyThac = UY_THAC_DIEU_TRA<br>2. URL cập nhật: `?utdt_lut=UY_THAC_DIEU_TRA`<br>3. Sub-label trong badge trạng thái hiển thị "Ủy thác điều tra"<br>4. Nút "Xóa bộ lọc" hoặc clear button hiển thị |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | 3 giá trị enum: UY_THAC_DIEU_TRA, CHUYEN_DON_NGUON_TIN, UY_THAC_GIAI_QUYET |

---

| TC-ID | TC-009 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Filter nâng cao — Đơn vị giao (text search) |
| **Yêu cầu** | REQ-UTDT-07 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có UTDT với donViGiao = "PC01" và hồ sơ khác với donViGiao = "CA Quận 1" |
| **Các bước kiểm thử** | 1. Mở `/uy-thac-dieu-tra`<br>2. Mở filter nâng cao<br>3. Nhập "PC01" vào ô "Đơn vị giao"<br>4. Quan sát bảng |
| **Dữ liệu kiểm thử** | Đơn vị giao filter: "PC01" |
| **Kết quả mong đợi** | 1. Chỉ hiển thị UTDT có donViGiao chứa "PC01" (case-insensitive partial match)<br>2. URL: `?utdt_dv=PC01`<br>3. Không hiển thị hồ sơ của "CA Quận 1" |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | TC-010 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Filter nâng cao — Date range Ngày tiếp nhận |
| **Yêu cầu** | REQ-UTDT-07 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có UTDT tiếp nhận 2026-05-01, 2026-05-15, 2026-05-30 |
| **Các bước kiểm thử** | 1. Mở `/uy-thac-dieu-tra`<br>2. Mở filter nâng cao<br>3. Chọn Ngày tiếp nhận từ: 10/05/2026<br>4. Chọn Ngày tiếp nhận đến: 20/05/2026<br>5. Quan sát bảng |
| **Dữ liệu kiểm thử** | Từ ngày: 2026-05-10, Đến ngày: 2026-05-20 |
| **Kết quả mong đợi** | 1. Chỉ hiển thị UTDT ngày tiếp nhận 15/05/2026 (trong khoảng)<br>2. Không hiển thị hồ sơ ngày 01/05 (trước từ) và 30/05 (sau đến)<br>3. URL: `?utdt_tnf=2026-05-10&utdt_tnt=2026-05-20`<br>4. API: `ngayTiepNhanFrom=2026-05-10&ngayTiepNhanTo=2026-05-20` |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | TC-011 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Global search theo tên đối tượng nghi vấn |
| **Yêu cầu** | REQ-UTDT-08 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có UTDT với nghiVanDoiTuong = "Trần Văn Bình" và hồ sơ khác không liên quan |
| **Các bước kiểm thử** | 1. Mở `/uy-thac-dieu-tra`<br>2. Nhập "Trần Văn Bình" vào ô tìm kiếm<br>3. Dừng 500ms (debounce)<br>4. Quan sát kết quả |
| **Dữ liệu kiểm thử** | Search query: "Trần Văn Bình" |
| **Kết quả mong đợi** | 1. Chỉ hiển thị hồ sơ khớp với "Trần Văn Bình" trong `metadata.nghiVanDoiTuong`<br>2. URL: `?utdt_q=Tr%E1%BA%A7n+V%C4%83n+B%C3%ACnh`<br>3. API chỉ gọi 1 lần sau 300ms debounce (không gọi mỗi keystroke)<br>4. Khi xóa search → trở về toàn bộ danh sách |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Search fields: name, crime, unit, donViGiao, soQuyetDinhUyThac, metadata.nghiVanDoiTuong |

---

| TC-ID | TC-012 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Phân trang hoạt động đúng, URL cập nhật |
| **Yêu cầu** | REQ-UTDT-09 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có ≥ 25 UTDT trong hệ thống |
| **Các bước kiểm thử** | 1. Mở `/uy-thac-dieu-tra`<br>2. Trang 1 hiển thị 20 rows<br>3. Click nút "Trang sau" hoặc số trang 2<br>4. Quan sát bảng và URL |
| **Dữ liệu kiểm thử** | Tài khoản: dispatcher@pc02.local |
| **Kết quả mong đợi** | 1. Trang 1: 20 records, URL không có `utdt_page` hoặc `utdt_page=1`<br>2. Click trang 2: URL = `?utdt_page=2`<br>3. Bảng trang 2 hiển thị records khác (offset 20)<br>4. Nút "Trang trước" ở trang 2 hoạt động, quay về trang 1<br>5. Tổng số records hiển thị "Hiển thị 21-25 / 25" (hoặc format tương đương) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

### 3.2. Module: Negative (RED)

| TC-ID | TC-013 |
|-------|--------|
| **Loại** | RED |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Tạo UTDT thiếu trường Đơn vị giao → validation lỗi, không submit được |
| **Yêu cầu** | REQ-UTDT-10 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Đang ở form tạo Case mới với caseProvenance=UY_THAC_DIEU_TRA |
| **Các bước kiểm thử** | 1. Điền các trường bắt buộc của tab chính (tên vụ việc, tội danh...)<br>2. Chọn tab "Thông tin Ủy thác"<br>3. **Không điền** ô "Đơn vị giao"<br>4. Điền các trường khác của tab này<br>5. Click nút "Lưu" |
| **Dữ liệu kiểm thử** | Đơn vị giao: (để trống) |
| **Kết quả mong đợi** | 1. Form không submit<br>2. Ô "Đơn vị giao" highlight lỗi (viền đỏ hoặc shake animation)<br>3. Message lỗi hiển thị bên dưới: "Đơn vị giao là bắt buộc" (hoặc tương đương)<br>4. Không có `POST /api/v1/cases` nào được gửi đi<br>5. Người dùng vẫn ở form, dữ liệu đã nhập không bị mất |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Nếu validation chỉ ở frontend: test thêm POST trực tiếp bỏ qua UI |

---

| TC-ID | TC-014 |
|-------|--------|
| **Loại** | RED |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Xóa UTDT không nhập lý do → nút xác nhận bị disabled |
| **Yêu cầu** | REQ-UTDT-10 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có hồ sơ UTDT "TC-014-DEL" |
| **Các bước kiểm thử** | 1. Click icon Xóa trên row "TC-014-DEL"<br>2. Dialog xóa mở ra<br>3. **Không nhập** gì vào textarea lý do<br>4. Quan sát nút "Xác nhận xóa" |
| **Dữ liệu kiểm thử** | Lý do xóa: (để trống) |
| **Kết quả mong đợi** | 1. Nút "Xác nhận xóa" bị disabled (không click được)<br>2. Không có `DELETE /api/v1/cases/:id` nào được gửi<br>3. Hồ sơ không bị xóa |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | TC-015 |
|-------|--------|
| **Loại** | RED |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Xóa UTDT với lý do < 10 ký tự → bị chặn |
| **Yêu cầu** | REQ-UTDT-10 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có hồ sơ "TC-015-DEL" |
| **Các bước kiểm thử** | 1. Click Xóa trên row "TC-015-DEL"<br>2. Nhập lý do: "Hủy bỏ" (8 ký tự)<br>3. Click nút "Xác nhận xóa" (nếu không disabled) |
| **Dữ liệu kiểm thử** | Lý do xóa: "Hủy bỏ" (8 ký tự — dưới 10) |
| **Kết quả mong đợi** | 1. Nút "Xác nhận xóa" bị disabled KHI lý do < 10 ký tự<br>HOẶC nếu nút enable được: submit thất bại với message "Lý do phải có ít nhất 10 ký tự"<br>2. Counter ký tự hiển thị: "8/10" hoặc tương đương để user biết còn thiếu |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | TC-016 |
|-------|--------|
| **Loại** | RED |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Filter date range ToDate < FromDate → không crash, trả về kết quả hợp lý |
| **Yêu cầu** | REQ-UTDT-10 |
| **Điều kiện tiên quyết** | Đăng nhập Dispatcher, đang ở danh sách UTDT |
| **Các bước kiểm thử** | 1. Mở filter nâng cao<br>2. Ngày tiếp nhận đến: 01/01/2026<br>3. Ngày tiếp nhận từ: 31/12/2026 (FromDate > ToDate)<br>4. Quan sát kết quả |
| **Dữ liệu kiểm thử** | From: 2026-12-31, To: 2026-01-01 (ngược chiều) |
| **Kết quả mong đợi** | 1. Hệ thống không crash<br>2. Hiển thị 0 kết quả VÀ/HOẶC hiện validation "Ngày đến phải sau ngày từ"<br>3. Không có lỗi 500 từ API |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

### 3.3. Module: Edge Cases

| TC-ID | TC-017 |
|-------|--------|
| **Loại** | EDGE |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | UTDT không có thời hạn (thoiHanUyThac = null) → không vào QUA_HAN |
| **Yêu cầu** | REQ-UTDT-11 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có UTDT "TC-017-NO-DL" với thoiHanUyThac = null và ketQuaUyThac = null |
| **Các bước kiểm thử** | 1. Mở danh sách UTDT<br>2. Tìm hồ sơ "TC-017-NO-DL"<br>3. Quan sát badge Trạng thái phản hồi<br>4. Click chip "Quá hạn" — kiểm tra hồ sơ này có xuất hiện không |
| **Dữ liệu kiểm thử** | UTDT: thoiHanUyThac=null, ketQuaUyThac=null |
| **Kết quả mong đợi** | 1. Badge hiển thị "Chưa phản hồi" (không phải "Quá hạn")<br>2. Khi filter "Quá hạn" → hồ sơ này **không** xuất hiện<br>3. Cột "Thời hạn" hiển thị "—" (không có ngày) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Logic QUA_HAN chỉ check `thoiHanUyThac < now()` khi thoiHanUyThac ≠ null |

---

| TC-ID | TC-018 |
|-------|--------|
| **Loại** | EDGE |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Cả DA_PHAN_HOI và KHONG_THUC_HIEN_DUOC đều có data → ưu tiên DA_PHAN_HOI |
| **Yêu cầu** | REQ-UTDT-11 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Tạo UTDT "TC-018-EDGE" có: ketQuaUyThac="Đã điều tra", ngayTraKetQua=2026-05-20, VÀ lyDoKhongThucHienDuoc="Không có đủ chứng cứ" |
| **Các bước kiểm thử** | 1. Mở danh sách UTDT<br>2. Tìm hồ sơ "TC-018-EDGE"<br>3. Quan sát badge Trạng thái phản hồi |
| **Dữ liệu kiểm thử** | ketQuaUyThac = "Đã điều tra xong"<br>ngayTraKetQua = 2026-05-20<br>lyDoKhongThucHienDuoc = "Không có đủ chứng cứ" |
| **Kết quả mong đợi** | 1. Badge hiển thị "Đã phản hồi" (DA_PHAN_HOI được ưu tiên)<br>2. Không hiển thị "Không thực hiện được" |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | [GT-1] — cần PO xác nhận priority order của computed logic |

---

| TC-ID | TC-019 |
|-------|--------|
| **Loại** | EDGE |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Có ketQuaUyThac nhưng thiếu ngayTraKetQua → vẫn là CHUA_PHAN_HOI |
| **Yêu cầu** | REQ-UTDT-11 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Tạo UTDT "TC-019-PARTIAL" có ketQuaUyThac="Đã điều tra" nhưng ngayTraKetQua = null |
| **Các bước kiểm thử** | 1. Mở danh sách UTDT<br>2. Tìm hồ sơ "TC-019-PARTIAL"<br>3. Quan sát badge Trạng thái phản hồi |
| **Dữ liệu kiểm thử** | ketQuaUyThac = "Đã điều tra xong"<br>ngayTraKetQua = null |
| **Kết quả mong đợi** | 1. Badge hiển thị "Chưa phản hồi" (vì thiếu ngayTraKetQua)<br>2. Phải có đủ CẢ HAI trường mới là DA_PHAN_HOI |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Logic: `DA_PHAN_HOI = ketQuaUyThac ≠ null AND ngayTraKetQua ≠ null` |

---

### 3.4. Module: Boundary Values

| TC-ID | TC-020 |
|-------|--------|
| **Loại** | BOUNDARY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Lý do xóa đúng 9 ký tự → bị từ chối |
| **Yêu cầu** | REQ-UTDT-12 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có hồ sơ "TC-020-BND" |
| **Các bước kiểm thử** | 1. Click Xóa trên "TC-020-BND"<br>2. Nhập lý do: "123456789" (đúng 9 ký tự)<br>3. Quan sát trạng thái nút / validation |
| **Dữ liệu kiểm thử** | Lý do: "123456789" (9 ký tự) |
| **Kết quả mong đợi** | 1. Nút "Xác nhận xóa" vẫn disabled HOẶC validation hiển thị "Còn thiếu 1 ký tự"<br>2. Hồ sơ không bị xóa |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | TC-021 |
|-------|--------|
| **Loại** | BOUNDARY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Lý do xóa đúng 10 ký tự → được chấp nhận (boundary pass) |
| **Yêu cầu** | REQ-UTDT-12 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có hồ sơ "TC-021-BND" |
| **Các bước kiểm thử** | 1. Click Xóa trên "TC-021-BND"<br>2. Nhập lý do: "1234567890" (đúng 10 ký tự)<br>3. Click "Xác nhận xóa" |
| **Dữ liệu kiểm thử** | Lý do: "1234567890" (10 ký tự — ngưỡng tối thiểu) |
| **Kết quả mong đợi** | 1. Nút "Xác nhận xóa" enable được<br>2. `DELETE /api/v1/cases/:id` được gọi, trả về 200/204<br>3. Hồ sơ bị xóa khỏi danh sách |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | TC-022 |
|-------|--------|
| **Loại** | BOUNDARY |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | thoiHanUyThac = hôm nay — kiểm tra boundary QUA_HAN |
| **Yêu cầu** | REQ-UTDT-12 |
| **Điều kiện tiên quyết** | Đăng nhập Dispatcher; có UTDT "TC-022-TODAY" với thoiHanUyThac = ngày hôm nay, chưa phản hồi |
| **Các bước kiểm thử** | 1. Mở danh sách UTDT sáng sớm (giờ < 12:00)<br>2. Tìm "TC-022-TODAY"<br>3. Ghi lại badge hiển thị<br>4. Click chip "Quá hạn" — hồ sơ này có trong kết quả không |
| **Dữ liệu kiểm thử** | thoiHanUyThac = today (2026-05-31) |
| **Kết quả mong đợi** | 1. Nếu so sánh `< now()` → thời điểm đầu ngày hôm nay vẫn chưa quá hạn, cuối ngày mới quá<br>2. Behavior phải nhất quán và có thể dự đoán được (ghi rõ rule khi test) |
| **Kết quả thực tế** | _(QA điền — ghi rõ giờ kiểm tra)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | [GT-2] Cần PO clarify behavior: today = quá hạn hay chưa? |

---

### 3.5. Module: Security & Phân quyền

| TC-ID | TC-023 |
|-------|--------|
| **Loại** | SECURITY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Non-dispatcher chỉ thấy UTDT trong phạm vi đơn vị (DataScope) |
| **Yêu cầu** | REQ-UTDT-13 |
| **Điều kiện tiên quyết** | 1. 2 đơn vị: Đơn vị A và Đơn vị B<br>2. UTDT-A thuộc Đơn vị A; UTDT-B thuộc Đơn vị B<br>3. officer1@pc02.local là điều tra viên Đơn vị A (non-dispatcher) |
| **Các bước kiểm thử** | 1. Đăng nhập officer1@pc02.local<br>2. Mở `/uy-thac-dieu-tra`<br>3. Tìm UTDT-B trong danh sách |
| **Dữ liệu kiểm thử** | Tài khoản: officer1@pc02.local (Đơn vị A) |
| **Kết quả mong đợi** | 1. Chỉ thấy UTDT-A (thuộc đơn vị mình)<br>2. UTDT-B **không xuất hiện** trong danh sách<br>3. `GET /api/v1/cases?caseType=UY_THAC_DIEU_TRA` trả về 200 nhưng chỉ có data của đơn vị A |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | DataScope enforcement là yêu cầu nghiệp vụ tuyệt đối — non-dispatch không được thấy dữ liệu đơn vị khác |

---

| TC-ID | TC-024 |
|-------|--------|
| **Loại** | SECURITY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | IDOR — truy cập trực tiếp `/cases/:id` của đơn vị khác bị từ chối |
| **Yêu cầu** | REQ-UTDT-13 |
| **Điều kiện tiên quyết** | 1. officer1@pc02.local thuộc Đơn vị A<br>2. UTDT-B thuộc Đơn vị B, có ID = "utdt-b-id-123" |
| **Các bước kiểm thử** | 1. Đăng nhập officer1@pc02.local<br>2. Gọi trực tiếp API: `GET /api/v1/cases/utdt-b-id-123` (ID của Đơn vị B) |
| **Dữ liệu kiểm thử** | Case ID: "utdt-b-id-123" (Đơn vị B)<br>Tài khoản: officer1@pc02.local (Đơn vị A) |
| **Kết quả mong đợi** | 1. API trả về HTTP 403 Forbidden HOẶC 404 Not Found (không leak thông tin tồn tại của record)<br>2. Không trả về dữ liệu của UTDT-B<br>3. Không trả về HTTP 200 với data |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Predictable IDs (cuid()) — vẫn phải có authz check; không thể đoán được ID nhưng leak qua URL vẫn phải block |

---

| TC-ID | TC-025 |
|-------|--------|
| **Loại** | SECURITY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | SQL injection trong ô tìm kiếm — không gây lỗi hay leak data |
| **Yêu cầu** | REQ-UTDT-14 |
| **Điều kiện tiên quyết** | Đăng nhập bất kỳ tài khoản hợp lệ |
| **Các bước kiểm thử** | 1. Mở `/uy-thac-dieu-tra`<br>2. Nhập vào ô tìm kiếm: `' OR 1=1 --`<br>3. Chờ kết quả<br>4. Thử thêm: `"; DROP TABLE cases; --` |
| **Dữ liệu kiểm thử** | Payload 1: `' OR 1=1 --`<br>Payload 2: `"; DROP TABLE cases; --` |
| **Kết quả mong đợi** | 1. Hệ thống không crash (không có HTTP 500)<br>2. Không trả về nhiều data hơn bình thường (không phải "toàn bộ bảng")<br>3. Trả về 0 kết quả (không match từ khóa literal) hoặc kết quả bình thường<br>4. Prisma ORM sử dụng parameterized queries — SQL injection bị prevent ở tầng ORM |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | TC-026 |
|-------|--------|
| **Loại** | SECURITY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | XSS trong trường donViGiao khi hiển thị danh sách |
| **Yêu cầu** | REQ-UTDT-14 |
| **Điều kiện tiên quyết** | Đăng nhập Dispatcher |
| **Các bước kiểm thử** | 1. Tạo UTDT với donViGiao = `<script>alert('xss')</script>`<br>2. Lưu hồ sơ<br>3. Mở danh sách UTDT và tìm hồ sơ vừa tạo<br>4. Quan sát cột "Đơn vị giao" |
| **Dữ liệu kiểm thử** | donViGiao: `<script>alert('xss')</script>` |
| **Kết quả mong đợi** | 1. Cột "Đơn vị giao" hiển thị text thô: `<script>alert('xss')</script>` (escaped)<br>2. Script không thực thi — không có popup/alert<br>3. React's JSX rendering tự escape HTML entities |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

### 3.6. Module: Data Validation

| TC-ID | TC-027 |
|-------|--------|
| **Loại** | DATA |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Tên đơn vị giao tiếng Việt đầy dấu — lưu và hiển thị đúng |
| **Yêu cầu** | REQ-UTDT-15 |
| **Điều kiện tiên quyết** | Đăng nhập Dispatcher |
| **Các bước kiểm thử** | 1. Tạo UTDT với donViGiao = "Công an Quận Hoàng Mai - Hà Nội"<br>2. Lưu, quay về danh sách<br>3. Tìm hồ sơ vừa tạo |
| **Dữ liệu kiểm thử** | donViGiao: "Công an Quận Hoàng Mai - Hà Nội" (đầy dấu, 33 ký tự) |
| **Kết quả mong đợi** | 1. `PATCH/POST` API nhận đúng Unicode string<br>2. Cột "Đơn vị giao" hiển thị: "Công an Quận Hoàng Mai - Hà Nội" (không bị mất dấu, không có ký tự lạ)<br>3. Search bằng "Hoàng Mai" tìm thấy hồ sơ này |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | TC-028 |
|-------|--------|
| **Loại** | DATA |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Kết quả điều tra có ngoặc kép và xuống dòng — lưu đúng |
| **Yêu cầu** | REQ-UTDT-15 |
| **Điều kiện tiên quyết** | Đăng nhập Dispatcher; có UTDT sẵn để sửa |
| **Các bước kiểm thử** | 1. Mở sửa một UTDT<br>2. Tab Thông tin Ủy thác → Kết quả xử lý<br>3. Nhập: `Đã xác minh: "Nguyễn Văn A" không liên quan.\nKiến nghị: chuyển cho CA Quận 1.`<br>4. Lưu<br>5. Mở lại hồ sơ để kiểm tra |
| **Dữ liệu kiểm thử** | ketQuaUyThac: `Đã xác minh: "Nguyễn Văn A" không liên quan.\nKiến nghị: chuyển.` |
| **Kết quả mong đợi** | 1. Dữ liệu lưu đúng với ngoặc kép và xuống dòng<br>2. Khi mở lại, textarea hiển thị đúng nội dung ban đầu<br>3. Không bị escape HTML entities kép (không hiển thị `&quot;` hay `\n` literal) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | TC-029 |
|-------|--------|
| **Loại** | DATA |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Date param không hợp lệ trong URL filter → xử lý an toàn |
| **Yêu cầu** | REQ-UTDT-15 |
| **Điều kiện tiên quyết** | Đăng nhập bất kỳ |
| **Các bước kiểm thử** | 1. Truy cập URL thủ công: `/uy-thac-dieu-tra?utdt_tnf=abc&utdt_tnt=2026-99-99`<br>2. Quan sát trang |
| **Dữ liệu kiểm thử** | URL: `?utdt_tnf=abc&utdt_tnt=2026-99-99` |
| **Kết quả mong đợi** | 1. Trang không crash<br>2. Params không hợp lệ bị ignore (trust boundary — sanitize URL params)<br>3. Trang load như không có filter nào<br>4. Không có HTTP 400 vì frontend sanitize trước khi gửi API |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Frontend có trust-boundary: ISO 8601 regex + calendar validity check |

---

### 3.7. Module: Hiệu năng (Performance)

| TC-ID | TC-030 |
|-------|--------|
| **Loại** | PERFORMANCE |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Danh sách UTDT API response < 2 giây với 1000 records |
| **Yêu cầu** | REQ-UTDT-16 |
| **Điều kiện tiên quyết** | DB có ít nhất 1000 hồ sơ UTDT (caseType=UY_THAC_DIEU_TRA) |
| **Các bước kiểm thử** | 1. Đăng nhập Dispatcher (toàn quyền — không DataScope filter)<br>2. Mở DevTools → Network tab<br>3. Mở `/uy-thac-dieu-tra`<br>4. Ghi lại response time của `GET /api/v1/cases?caseType=UY_THAC_DIEU_TRA&limit=20` |
| **Dữ liệu kiểm thử** | DB seed: 1000 UTDT cases |
| **Kết quả mong đợi** | 1. API response time < 2000ms (bao gồm network latency)<br>2. Trang render hoàn toàn < 3000ms<br>3. Không có timeout hay error |
| **Kết quả thực tế** | _(QA điền: response time thực tế)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | TC-031 |
|-------|--------|
| **Loại** | PERFORMANCE |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | API utdt-stats < 3 giây (aggregate query) |
| **Yêu cầu** | REQ-UTDT-16 |
| **Điều kiện tiên quyết** | DB có ≥ 1000 UTDT |
| **Các bước kiểm thử** | 1. Đăng nhập Dispatcher<br>2. DevTools → Network<br>3. Mở `/uy-thac-dieu-tra`<br>4. Ghi lại response time của `GET /api/v1/cases/utdt-stats` |
| **Dữ liệu kiểm thử** | DB: 1000+ UTDT |
| **Kết quả mong đợi** | 1. `GET /api/v1/cases/utdt-stats` trả về < 3000ms<br>2. 4 computed state (DA_PHAN_HOI, KHONG_THUC_HIEN_DUOC, QUA_HAN, CHUA_PHAN_HOI) tính đúng |
| **Kết quả thực tế** | _(QA điền: response time thực tế)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | getUtdtStats tính computed state ở app layer — phức tạp hơn stored status; cần index tốt |

---

| TC-ID | TC-032 |
|-------|--------|
| **Loại** | PERFORMANCE |
| **Độ ưu tiên** | P2 |
| **Tiêu đề** | Search debounce — không gọi API mỗi keystroke |
| **Yêu cầu** | REQ-UTDT-16 |
| **Điều kiện tiên quyết** | Đăng nhập Dispatcher, DevTools → Network |
| **Các bước kiểm thử** | 1. Mở `/uy-thac-dieu-tra`<br>2. Bật Network tab<br>3. Gõ nhanh "nguyen van a" vào ô search (9 ký tự trong < 1s)<br>4. Đếm số request API thực sự được gửi |
| **Dữ liệu kiểm thử** | Search: "nguyen van a" (gõ nhanh) |
| **Kết quả mong đợi** | 1. Chỉ có 1 request API sau khi ngừng gõ 300ms (debounce)<br>2. Không có 9 requests riêng biệt (1 per keystroke)<br>3. Response hiển thị đúng kết quả cho "nguyen van a" |
| **Kết quả thực tế** | _(QA điền: số requests thực tế)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

### 3.8. Module: UI Nhất quán (UI_CONSISTENCY)

| TC-ID | TC-033 |
|-------|--------|
| **Loại** | UI_CONSISTENCY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | UTDT thiếu bulk selection — gap P0 so với Cases/Incidents/Petitions |
| **Yêu cầu** | REQ-UTDT-17 |
| **Modules baseline** | Bulk selection có ở: Cases ✅, Incidents ✅, Petitions ✅ |
| **Điều kiện tiên quyết** | Đăng nhập Dispatcher, có ≥ 3 UTDT |
| **Các bước kiểm thử** | 1. Mở `/cases` → quan sát cột checkbox đầu bảng và BulkActionBar<br>2. Mở `/uy-thac-dieu-tra` → quan sát cùng vị trí<br>3. So sánh |
| **Dữ liệu kiểm thử** | Dispatcher: toàn quyền trên cả hai module |
| **Kết quả mong đợi** | Hiện tại: UTDT **không có** checkbox bulk selection<br>Kỳ vọng (nếu gap cần fix): UTDT có checkbox ở cột 0, BulkActionBar xuất hiện khi chọn nhiều row, cho phép xóa hàng loạt |
| **Real user signal** | "Tại sao trang Cases có thể chọn nhiều để xóa, còn UTDT phải xóa từng cái?" |
| **Kết quả thực tế** | _(QA ghi nhận: có hay không, log ticket nếu thiếu)_ |
| **Trạng thái** | _(Đạt = có bulk / Không đạt = thiếu bulk)_ |
| **Ghi chú** | P0 vì majority 3/3 modules đã có — log ticket với screenshot đối chiếu Cases |

---

| TC-ID | TC-034 |
|-------|--------|
| **Loại** | UI_CONSISTENCY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Delete modal có reason textarea — nhất quán với Cases/Incidents/Petitions |
| **Yêu cầu** | REQ-UTDT-17 |
| **Modules baseline** | Delete modal with reason ở: Cases ✅, Incidents ✅, Petitions ✅ |
| **Các bước kiểm thử** | 1. Mở `/uy-thac-dieu-tra`<br>2. Click xóa một hồ sơ<br>3. Quan sát dialog |
| **Kết quả mong đợi** | 1. Dialog xuất hiện với: tiêu đề cảnh báo, textarea "Lý do xóa", bộ đếm ký tự, nút "Xác nhận xóa" + "Hủy"<br>2. Textarea bắt buộc (≥10 ký tự) trước khi submit<br>3. Layout nhất quán với delete modal ở Cases |
| **Real user signal** | "Xóa ở đây có cảnh báo không?" |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | TC-035 |
|-------|--------|
| **Loại** | UI_CONSISTENCY |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Badge QUA_HAN màu đỏ — nhất quán với overdue ở Incidents/Petitions |
| **Yêu cầu** | REQ-UTDT-17 |
| **Modules baseline** | Row highlight đỏ cho quá hạn: Incidents ✅, Petitions ✅ |
| **Các bước kiểm thử** | 1. Mở Incidents → tìm incident quá hạn → ghi nhận màu badge và row<br>2. Mở UTDT → tìm UTDT quá hạn → so sánh màu badge và row highlight |
| **Kết quả mong đợi** | 1. Badge "Quá hạn" cùng màu đỏ với overdue badge ở Incidents/Petitions<br>2. Row background highlight màu đỏ nhạt khi QUA_HAN, giống Incidents quá hạn<br>3. Không có module nào dùng màu khác cho cùng concept "quá hạn" |
| **Real user signal** | "Màu đỏ ở đây có nghĩa khác màu đỏ kia không?" |
| **Kết quả thực tế** | _(QA điền — note hex color nếu khác)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | TC-036 |
|-------|--------|
| **Loại** | UI_CONSISTENCY |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Empty state khi không có UTDT nào — có CTA "Nhập ủy thác mới" |
| **Yêu cầu** | REQ-UTDT-17 |
| **Modules baseline** | Empty state với CTA: Cases ✅, Incidents ✅, Petitions ✅ |
| **Các bước kiểm thử** | 1. Đăng nhập tài khoản chưa có UTDT nào trong phạm vi<br>2. Mở `/uy-thac-dieu-tra`<br>3. Quan sát vùng bảng khi trống |
| **Kết quả mong đợi** | 1. Không hiển thị bảng rỗng (0 row)<br>2. Hiển thị Empty State: icon/illustration + text "Chưa có ủy thác nào" + nút CTA "Nhập ủy thác mới"<br>3. Layout nhất quán với Empty State ở Cases/Incidents |
| **Real user signal** | "Mới vào chưa có gì, không biết bắt đầu từ đâu" |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

## 4. Test Cases liên module (E2E / User Journey)

### E2E-001: Vòng đời đầy đủ UTDT — Tiếp nhận → Điều tra → Phản hồi kết quả

| Mục | Nội dung |
|-----|----------|
| **TC-ID** | E2E-001 |
| **Loại** | E2E |
| **Độ ưu tiên** | P0 |
| **User story** | Là Dispatcher, tôi muốn nhập một vụ ủy thác điều tra, giao cho điều tra viên, và theo dõi tới khi có kết quả phản hồi gửi lại đơn vị giao |
| **Các module đi qua** | UTDT List → Form tạo mới → UTDT Detail/Edit → Trạng thái DA_PHAN_HOI → Stats cards update |
| **Yêu cầu** | REQ-UTDT-03, REQ-UTDT-04, REQ-UTDT-02 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có điều tra viên officer1@pc02.local<br>3. Không có UTDT nào với số QĐ "E2E-001-2026" |
| **Các bước kiểm thử** | 1. [List] Mở `/uy-thac-dieu-tra`, ghi lại số card "Tổng" và "Chưa phản hồi"<br>2. [Tạo] Click "Nhập ủy thác mới", điền: donViGiao="PC02 CA Thành phố", loaiUyThac=UY_THAC_DIEU_TRA, ngayTiepNhan=hôm nay, soQuyetDinh="E2E-001-2026", thoiHanUyThac=30 ngày sau<br>3. [Tạo] Giao điều tra viên: chọn officer1@pc02.local<br>4. [Tạo] Click Lưu<br>5. [List] Verify hồ sơ xuất hiện, badge = "Chưa phản hồi"<br>6. [Edit] Click Sửa, chuyển tab Thông tin Ủy thác<br>7. [Edit] Điền ketQuaUyThac="Đã xác minh, đối tượng cư trú tại địa chỉ X"; ngayTraKetQua=hôm nay<br>8. [Edit] Click Lưu<br>9. [List] Verify badge đã đổi sang "Đã phản hồi"<br>10. [Stats] Verify card "Đã phản hồi" tăng 1, "Chưa phản hồi" giảm 1 |
| **Luồng dữ liệu chuyển tiếp** | • soQuyetDinh "E2E-001-2026" (B2) xuất hiện đúng ở cột bảng (B5) và khi mở sửa (B6)<br>• Badge CHUA_PHAN_HOI (B5) → DA_PHAN_HOI (B9) sau khi điền đủ ketQuaUyThac + ngayTraKetQua<br>• Stats card số (B1) → tăng/giảm đúng sau mỗi thay đổi (B10)<br>• officer1 được emit event `utdt.assigned` (verify in audit log) |
| **Kết quả mong đợi** | 1. Toàn bộ journey không có bước nào crash hoặc dead-end<br>2. Dữ liệu nhập ở bước tạo (B2) khớp hoàn toàn với dữ liệu ở bước xem/sửa (B6)<br>3. Trạng thái phản hồi compute đúng real-time khi điền form<br>4. Stats cards phản ánh chính xác sau mỗi thao tác |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Điểm cần quan sát** | Số bước thừa giữa tạo và xem kết quả; badge có real-time update khi điền form không; stats có require F5 không |

---

### E2E-002: Rollback journey — UTDT quá hạn không phản hồi

| Mục | Nội dung |
|-----|----------|
| **TC-ID** | E2E-002 |
| **Loại** | E2E |
| **Độ ưu tiên** | P0 |
| **User story** | Là Dispatcher, tôi muốn biết hồ sơ nào đã quá hạn để đốc thúc điều tra viên |
| **Các module đi qua** | UTDT List → Stats card QUA_HAN → Filter chip QUA_HAN → Row detail |
| **Yêu cầu** | REQ-UTDT-06, REQ-UTDT-11 |
| **Điều kiện tiên quyết** | 1. Đăng nhập Dispatcher<br>2. Có UTDT "E2E-002" với thoiHanUyThac = 2026-05-01 (đã quá hạn), ketQuaUyThac = null |
| **Các bước kiểm thử** | 1. [List] Mở `/uy-thac-dieu-tra` — ghi lại số trên card "Quá hạn"<br>2. [List] Tìm hồ sơ "E2E-002" — xác nhận badge màu đỏ "Quá hạn" và row highlight đỏ<br>3. [Filter] Click chip "Quá hạn" — verify hồ sơ "E2E-002" có trong kết quả<br>4. [Detail] Click xem detail "E2E-002"<br>5. [Edit] Điền kết quả: ketQuaUyThac="Đã điều tra", ngayTraKetQua=hôm nay<br>6. [Lưu] Lưu lại<br>7. [List] Verify hồ sơ không còn trong filter "Quá hạn"<br>8. [Stats] Verify card "Quá hạn" giảm 1, card "Đã phản hồi" tăng 1 |
| **Luồng dữ liệu chuyển tiếp** | • Trạng thái QUA_HAN (B2) là computed từ `thoiHanUyThac < now() AND ketQuaUyThac = null`<br>• Sau khi điền kết quả (B5), trạng thái chuyển sang DA_PHAN_HOI mặc dù ngày trả sau thoiHanUyThac |
| **Kết quả mong đợi** | 1. UTDT quá hạn phải nhận diện được ngay khi mở trang<br>2. Sau khi cập nhật kết quả → thoát khỏi filter "Quá hạn" ngay lập tức (không cần F5)<br>3. Stats cập nhật ngay sau save |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Điểm cần quan sát** | Có bao nhiêu clicks từ "thấy quá hạn" đến "giao việc cho điều tra viên"; badge có cập nhật không cần F5 |

---

### E2E-003: Cross-role journey — Dispatcher tạo, Officer điều tra, Dispatcher theo dõi

| Mục | Nội dung |
|-----|----------|
| **TC-ID** | E2E-003 |
| **Loại** | E2E |
| **Độ ưu tiên** | P1 |
| **User story** | Là Dispatcher, tôi giao UTDT cho Officer; Officer điền kết quả; Dispatcher thấy kết quả mà không phải hỏi |
| **Các module đi qua** | [Dispatcher] UTDT tạo mới → giao officer → [Officer] UTDT edit → điền kết quả → [Dispatcher] xem list → DA_PHAN_HOI |
| **Yêu cầu** | REQ-UTDT-03, REQ-UTDT-04, REQ-UTDT-13 |
| **Điều kiện tiên quyết** | 1. Tài khoản Dispatcher: dispatcher@pc02.local<br>2. Tài khoản Officer cùng đơn vị: officer1@pc02.local<br>3. Không có UTDT "E2E-003-CROSS" |
| **Các bước kiểm thử** | 1. [Dispatcher] Tạo UTDT "E2E-003-CROSS", giao assignedToId=officer1<br>2. [Dispatcher] Logout<br>3. [Officer] Đăng nhập officer1@pc02.local → mở `/uy-thac-dieu-tra`<br>4. [Officer] Tìm "E2E-003-CROSS" trong danh sách<br>5. [Officer] Click Sửa → điền kết quả điều tra<br>6. [Officer] Lưu<br>7. [Officer] Logout<br>8. [Dispatcher] Đăng nhập lại → mở `/uy-thac-dieu-tra`<br>9. [Dispatcher] Verify badge "E2E-003-CROSS" = DA_PHAN_HOI |
| **Luồng dữ liệu chuyển tiếp** | • assignedToId set ở B1 → event `utdt.assigned` emit → officer nhận notification (nếu có)<br>• Officer thấy UTDT mình được giao (B4) — DataScope dựa trên assignedToId hoặc cùng đơn vị<br>• Kết quả officer điền (B5) → Dispatcher thấy ở danh sách (B9) |
| **Kết quả mong đợi** | 1. Officer thấy UTDT được giao trong phạm vi DataScope<br>2. Dữ liệu officer cập nhật visible ngay với Dispatcher (không cần reset cache)<br>3. Dispatcher thấy DA_PHAN_HOI mà không cần officer thông báo thủ công |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Điểm cần quan sát** | Officer có thấy UTDT không phải mình tạo không (DataScope cho assignee); thông báo event `utdt.assigned` có hoạt động |

---

### E2E-004: Interrupted journey — Tạo UTDT nửa chừng, quay lại hoàn thiện

| Mục | Nội dung |
|-----|----------|
| **TC-ID** | E2E-004 |
| **Loại** | E2E |
| **Độ ưu tiên** | P1 |
| **User story** | Là Dispatcher, tôi điền form UTDT chưa xong phải thoát ra, sau đó quay lại hoàn thiện mà không mất dữ liệu |
| **Các module đi qua** | UTDT tạo (partial) → đóng form → UTDT list → UTDT edit → hoàn thiện |
| **Yêu cầu** | REQ-UTDT-03 |
| **Điều kiện tiên quyết** | Đăng nhập Dispatcher |
| **Các bước kiểm thử** | 1. Click "Nhập ủy thác mới"<br>2. Điền một phần: donViGiao="PC01", ngayTiepNhan=hôm nay<br>3. **Chưa điền kết quả** — click "Lưu" (lưu bản nháp)<br>4. Hệ thống xử lý lưu<br>5. Quay về `/uy-thac-dieu-tra`<br>6. Tìm hồ sơ vừa lưu<br>7. Click Sửa → điền phần còn thiếu<br>8. Lưu hoàn chỉnh |
| **Luồng dữ liệu chuyển tiếp** | • Partial data lưu B3 phải giữ nguyên khi mở lại B7<br>• donViGiao, ngayTiepNhan ở B2 phải xuất hiện đúng ở edit form B7 |
| **Kết quả mong đợi** | 1. Có thể lưu UTDT không đầy đủ (chỉ cần donViGiao)<br>2. Khi mở lại để sửa, dữ liệu đã lưu vẫn còn<br>3. Không có cảnh báo "unsaved changes" giả (không có thay đổi)<br>4. Form sửa pre-populate đúng với dữ liệu đã lưu |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Điểm cần quan sát** | Bao nhiêu trường được pre-populate; có cảnh báo "unsaved changes" khi mở lại không thay đổi gì |

---

## 5. Dữ liệu kiểm thử

### 5.1. Tài khoản kiểm thử

| ID | Email | Mật khẩu | Vai trò | Đơn vị | Ghi chú |
|----|-------|----------|---------|--------|---------|
| U001 | dispatcher@pc02.local | (xem .env) | Dispatcher | Toàn cục | Toàn quyền, không DataScope filter |
| U002 | officer1@pc02.local | (xem .env) | Officer | Đơn vị A | Non-dispatcher, DataScope filter áp dụng |
| U003 | officer2@pc02.local | (xem .env) | Officer | Đơn vị B | Khác đơn vị với officer1 |
| U004 | admin@pc02.local | (xem .env) | Admin | Toàn cục | Test phân quyền admin |

### 5.2. Hồ sơ UTDT mẫu (seed data cần có trước UAT)

| ID | Mã hồ sơ | Trạng thái (computed) | Đơn vị giao | thoiHanUyThac | Ghi chú |
|----|----------|----------------------|-------------|---------------|---------|
| D001 | HS-CHUA-01 | CHUA_PHAN_HOI | PC01 | 2026-06-30 | Baseline CHUA_PHAN_HOI |
| D002 | HS-DA-01 | DA_PHAN_HOI | CA Quận 1 | 2026-05-20 | ketQuaUyThac + ngayTraKetQua đã điền |
| D003 | HS-KHONG-01 | KHONG_THUC_HIEN_DUOC | CA Quận 3 | 2026-05-15 | lyDoKhongThucHienDuoc điền |
| D004 | HS-QUA-01 | QUA_HAN | PC04 | 2026-05-01 | thoiHanUyThac đã qua, chưa phản hồi |
| D005 | HS-NODEL-01 | CHUA_PHAN_HOI | CA Quận 5 | null | Không có thời hạn |

### 5.3. Giá trị biên (Boundary values)

| Trường | Min-1 (fail) | Min (pass) | Max test | Ghi chú |
|--------|--------------|------------|----------|---------|
| Lý do xóa | 9 ký tự | 10 ký tự | 1000 ký tự | Kiểm tra min boundary |
| donViGiao | "" (trống) | 1 ký tự | 255 ký tự | Bắt buộc |
| ketQuaUyThac | N/A | 1 ký tự | textarea không giới hạn | Optional |

### 5.4. Payload tấn công (Security)

| Loại | Payload | Trường test |
|------|---------|-------------|
| SQL Injection | `' OR 1=1 --` | Search query |
| SQL Injection | `"; DROP TABLE cases; --` | Search query |
| XSS | `<script>alert('xss')</script>` | donViGiao |
| XSS | `<img src=x onerror=alert(1)>` | ketQuaUyThac |
| Path Traversal URL | `?utdt_tnf=../../etc/passwd` | URL param |

---

## 6. Checklist độ phủ

| Loại | Số TC | Trạng thái | Ghi chú |
|------|-------|------------|---------|
| GREEN | 13 | ✅ | Phủ: list, stats, tạo, sửa, xóa, tất cả filters, search, pagination |
| RED | 4 | ✅ | Thiếu donViGiao, lý do xóa thiếu/trống, date range ngược |
| EDGE | 3 | ✅ | thoiHanUyThac null, priority DA vs KHONG, partial ketQua |
| BOUNDARY | 3 | ✅ | Delete reason 9/10 chars, thoiHanUyThac = today |
| SECURITY | 4 | ✅ | DataScope, IDOR, SQL injection, XSS |
| DATA | 3 | ✅ | Unicode tiếng Việt, ký tự đặc biệt, invalid URL params |
| PERFORMANCE | 3 | ✅ | List API < 2s, stats API < 3s, debounce check |
| UI_CONSISTENCY | 4 | ✅ | Bulk selection gap P0, delete modal, badge màu, empty state |
| E2E (liên module) | 4 | ✅ | Full lifecycle, rollback, cross-role, interrupted |
| **Tổng** | **41** | | |

**Phân tích đủ phủ theo ISTQB:**
- **Lớp tương đương TrangThaiPhanHoi:** 4 states × kiểm từng state = 4 cases (TC-006/007/008 + E2E-002)
- **Boundary lý do xóa:** [∞-∞,9] ∪ [10, ∞] → 2 boundary cases (TC-020, TC-021)
- **Decision table TrangThaiPhanHoi:** 4 nhánh logic computed → TC-017/018/019/004
- **Security bề mặt tấn công:** DataScope, IDOR, injection, XSS → 4 cases
- **Không nhân bản case vô nghĩa** — mỗi TC kiểm một điều khác biệt có ý nghĩa

---

## 7. Nhận định trải nghiệm & Đề xuất cải tiến

| ID | Mức độ | Loại vấn đề | Mô tả quan sát (như user thật) | Tác động tới user | Đề xuất cải tiến |
|----|--------|-------------|-------------------------------|-------------------|------------------|
| UX-01 | Cao | Thao tác rườm rà | Tạo UTDT mới phải đi qua `/cases/new` — URL nói "Cases" không phải "Ủy thác", gây bối rối về context | User không biết mình đang tạo UTDT hay Case thường | Hoặc (a) đổi page title thành "Tạo Ủy Thác Điều Tra" khi caseProvenance=UY_THAC_DIEU_TRA, hoặc (b) hiển thị breadcrumb "Ủy Thác Điều Tra → Tạo mới" thay vì "Cases → Tạo mới" |
| UX-02 | Cao | Thiếu nhất quán | Không có bulk selection trong khi Cases/Incidents/Petitions đều có — user phải xóa từng UTDT một khi cần dọn dẹp hàng loạt | Tốn gấp N lần thời gian khi cần xóa/cập nhật nhiều UTDT | Thêm bulk selection adapter (checkbox cột 0 + BulkActionBar với action "Xóa đã chọn") — pattern đã có sẵn ở Cases |
| UX-03 | Cao | Luồng dữ liệu phi lý | Trạng thái "Đã phản hồi" (DA_PHAN_HOI) yêu cầu điền **cả hai** trường ketQuaUyThac và ngayTraKetQua, nhưng không có visual indicator nào cho thấy "cần điền thêm gì để thay đổi trạng thái" | User điền xong ketQuaUyThac nhưng quên ngayTraKetQua → vẫn thấy "Chưa phản hồi", không hiểu tại sao | Thêm inline hint bên cạnh badge: "Điền thêm Ngày trả kết quả để đánh dấu Đã phản hồi" (Nielsen: Visibility of system status) |
| UX-04 | Trung bình | Thiếu phản hồi trạng thái | Sau khi click "Nhập ủy thác mới" → form redirect mất khoảng 1-2s nhưng không có loading indicator | User bấm lại vì tưởng click không có tác dụng | Thêm loading spinner hoặc button disabled state khi đang navigate |
| UX-05 | Trung bình | Thiếu nhất quán | Cột bảng UTDT có sub-label (badge loaiUyThac nhỏ bên dưới TrangThaiPhanHoi badge) — pattern này không có ở Cases/Incidents → tốt hơn nhưng cần áp dụng ngược lại cho các module kia | Tốt cho UTDT nhưng user bị ngạc nhiên khi quay lại Cases | Tốt - giữ nguyên pattern sub-label này; đề xuất backport sang Cases/Incidents/Petitions |
| UX-06 | Trung bình | Thao tác rườm rà | Thoihanuy thac "quá hạn" tính theo timestamp chính xác (`< now()`) không phải theo ngày — nếu deadline là 15:00 hôm nay, lúc 14:59 là "chưa hạn", 15:01 là "quá hạn"; user không biết quy tắc này | Confusing khi gần deadline — badge thay đổi mà user không biết tại sao | Hiển thị tooltip trên cột "Thời hạn" hoặc trên badge QUA_HAN: "Quá hạn kể từ dd/MM/yyyy HH:mm" |
| UX-07 | Thấp | Thiếu nhất quán | Không có nút "Export" cho UTDT trong khi Cases/Incidents/Petitions đều có export — cần khi báo cáo hàng tuần | Phải copy-paste thủ công hoặc export qua admin tool | Thêm export UTDT (ít nhất CSV) — low priority nhưng nên có trong backlog |
| UX-08 | Tích cực | Pattern đúng | Row highlight màu đỏ cho QUA_HAN cực kỳ rõ ràng — một nhìn là biết case nào cần xử lý ngay | N/A — tốt | Giữ nguyên, apply thêm cho bất kỳ module nào có deadline concept |

---

## 8. Câu hỏi cho PO/BA

1. **[GT-1] Priority của TrangThaiPhanHoi:** Khi một UTDT có cả `ketQuaUyThac` (→ DA_PHAN_HOI) lẫn `lyDoKhongThucHienDuoc` (→ KHONG_THUC_HIEN_DUOC) — trạng thái nào được ưu tiên? Hiện tại code giả định DA_PHAN_HOI win.

2. **[GT-2] Boundary QUA_HAN:** `thoiHanUyThac = hôm nay` (set ngày không giờ) so sánh `< now()` (có giờ) — behavior mong muốn là "hết ngày hôm nay" hay "bất kỳ lúc nào sau 00:00 ngày đó"? Cần chuẩn hóa để user không bị bất ngờ.

3. **[GT-3] Frontend-only validation cho donViGiao:** Nếu gọi API trực tiếp (bypass UI), có thể tạo UTDT không có `donViGiao` không? Backend DTO hiện tại không mark required. Nên thêm `@IsNotEmpty()` ở backend nếu đây là business requirement.

4. **Bulk selection:** UTDT không có bulk selection. Có phải thiếu sót cần fix không, hay đây là quyết định thiết kế (UTDT ít trường hợp cần batch operation)?

5. **Export:** Cases/Incidents/Petitions có export Excel. UTDT có cần không, và nếu có, export theo format nào (cột nào)?

6. **Notification khi giao UTDT:** Event `utdt.assigned` được emit. Officer có nhận được in-app notification không? Cần verify luồng notification hoạt động đầu cuối.

---

## Tóm tắt quyết định release (UAT Sign-off)

| Tiêu chí | Ngưỡng | Thực tế | Đạt? |
|----------|--------|---------|------|
| P0 pass (TC-001~TC-025, TC-033~TC-034) | 100% | ___/21 | ___ |
| P1 pass (TC-006~TC-016, TC-027~TC-032, TC-035~TC-036, E2E-001~004) | ≥95% | ___/20 | ___ |
| Lỗi Nghiêm trọng/Cao đang mở | 0 | ___ | ___ |
| E2E P0 thông suốt (E2E-001, E2E-002) | 100% | ___/2 | ___ |
| **Khuyến nghị** | | | **GO / NO-GO / GO có điều kiện** |

**Lưu ý blocker:**
- TC-033 (bulk selection gap) là P0 về UI Consistency — nếu team quyết định đây là thiếu sót, phải fix trước release hoặc PO chấp nhận bằng văn bản defer sang sprint sau.
- TC-023, TC-024 (DataScope + IDOR) là P0 Security — phải PASS trước khi release lên production.

---

*Kết thúc tài liệu UAT UTDT v1.0.0*
