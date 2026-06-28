# UAT — In chứng từ ĐỘNG cho Đơn thư (PR3)

> Phạm vi: FEATURE-LEVEL. Hệ PC02 (NestJS + React). FE http://localhost:5173, BE http://localhost:3000/api/v1. Tài khoản: admin@pc02.local.

## 1. Hiểu biết về Feature

| Mục | Nội dung |
|-----|----------|
| **Tên feature** | In chứng từ ĐỘNG cho Đơn thư (cutover từ engine tĩnh sang mẫu .docx lưu DB) |
| **Module/Màn hình** | Form Đơn thư (edit) → nút "In chứng từ" → popup `DynamicExportDocumentsModal` (entity=petitions) |
| **Actor chính** | Cán bộ tiếp nhận/xử lý đơn thư (có quyền read Petition) |
| **Business goal** | Sinh 7 loại chứng từ Đơn thư từ mẫu admin tự quản (sửa mẫu không cần deploy), cấp số văn bản chuẩn, tự điền dữ liệu đơn |
| **API liên quan** | `GET /petitions/export-templates` (danh sách mẫu DON_THU); `GET /petitions/:id/export-readiness-dynamic` (trường thiếu per mẫu); `POST /petitions/:id/export-documents-dynamic {templateIds, mode, manualValues}` (xuất gộp/zip); `PUT /petitions/:id` (Lưu bổ sung cột phẳng) |
| **UI screens** | PetitionFormPage (edit) + DynamicExportDocumentsModal + ExportReadinessChecklist |
| **Input** | petitionId, templateIds (mẫu chọn), mode (merged/zip), manualValues (bổ sung non-savable) |
| **Output** | File .docx (gộp) hoặc .zip (tách); số văn bản cấp atomic per mẫu needsNumber |
| **7 mẫu** | PHIEU_DE_XUAT, PHIEU_CHUYEN_NGUON_TIN, PHIEU_CHUYEN_DON, THONG_BAO_CHUYEN, THONG_BAO_HUONG_DAN, THONG_BAO_TRA_LAI, BIEN_NHAN (đều needsNumber=true) |
| **Series cấp số** | DOC_TYPE_TO_SERIES — PHIEU_CHUYEN_NGUON_TIN + PHIEU_CHUYEN_DON dùng chung series `PHIEU_CHUYEN`; THONG_BAO_CHUYEN + THONG_BAO_TRA_LAI dùng chung `THONG_BAO` |
| **Required per docType** | mọi mẫu: ghiTen (senderName) + noiDung; PHIEU_DE_XUAT +nhanThay+deXuat; PHIEU_CHUYEN_NGUON_TIN +lyDoChuyen+canCuPhapLy; PHIEU_CHUYEN_DON +lyDoChuyen; THONG_BAO_HUONG_DAN +huongDanKhoiKien; THONG_BAO_TRA_LAI +lyDoTraDon |
| **Giả định (cần PO xác nhận)** | (a) Engine tĩnh cũ vẫn còn làm fallback — UAT này chỉ test đường ĐỘNG; (b) admin@ có quyền read Petition + đã có ≥1 đơn thư có đủ data nền |

## 2. Ma trận truy vết

| TC-ID | Loại | Tiêu đề | Ưu tiên | Yêu cầu |
|-------|------|---------|---------|---------|
| TC-01 | GREEN | Mở popup → tải đủ 7 mẫu động | P0 | export-templates |
| TC-02 | GREEN | In 1 mẫu đủ data → tải .docx + cấp số đúng | P0 | export-documents-dynamic |
| TC-03 | GREEN | In nhiều mẫu, gộp 1 Word (merged) | P0 | mode=merged |
| TC-04 | GREEN | In nhiều mẫu, tách ZIP | P1 | mode=zip |
| TC-05 | GREEN | Readiness báo trường thiếu đúng per mẫu | P0 | export-readiness-dynamic |
| TC-06 | GREEN | Lưu bổ sung (savable) → PUT cột vào đơn → mẫu sẵn sàng | P0 | savable PUT |
| TC-07 | GREEN | Bổ sung non-savable → dùng manualValues khi xuất | P1 | manualValues |
| TC-08 | RED | Xuất khi thiếu required (không bổ sung) → chặn, KHÔNG cấp số | P0 | validate fail-closed |
| TC-09 | RED | Xuất 0 mẫu chọn → nút "Xuất file" disabled | P1 | UI guard |
| TC-10 | RED | templateIds trùng → 400, không tiêu số gấp đôi | P0 | dedup |
| TC-11 | RED | templateId không tồn tại/đã xoá → 400 | P1 | pre-validate |
| TC-12 | RED | mẫu sai entityType (gửi mẫu VU_AN) → 400 | P1 | entityType guard |
| TC-13 | EDGE | Số văn bản tăng tuần tự khi in lại cùng mẫu | P0 | counter |
| TC-14 | EDGE | 2 mẫu khác nhau dùng CHUNG series → số nối tiếp, không trùng | P0 | shared series |
| TC-15 | EDGE | noiDung rỗng nhưng summary có → tự fill từ summary | P1 | computed noiDung |
| TC-16 | EDGE | Mẫu không bị khoá (đủ data) auto-tick khi mở | P1 | readiness ready |
| TC-17 | BOUNDARY | Chọn cả 7 mẫu cùng lúc → xuất OK, cấp 7 số | P1 | batch all |
| TC-18 | SECURITY | Forge soVanBan qua manualValues → bị bỏ qua, dùng số engine | P0 | strip soVanBan |
| TC-19 | SECURITY | manualValues value non-string (số/object) → 400 nghiệp vụ, KHÔNG 500 | P0 | coerce/guard |
| TC-20 | SECURITY | Injection token `{deXuat}` trong giá trị nhập → escape, không nội suy | P0 | escape |
| TC-21 | SECURITY | User ngoài phạm vi dữ liệu mở đơn người khác → 403/404 | P0 | RBAC scope |
| TC-22 | DATA | Tên tiếng Việt có dấu + ký tự đặc biệt render đúng | P1 | i18n |
| TC-23 | DATA | Atomic: lỗi giữa chừng (1 mẫu lỗi) → rollback HẾT, 0 số bị tiêu | P0 | $transaction |
| TC-24 | PERFORMANCE | Xuất 7 mẫu gộp < 5s | P2 | perf |
| TC-25 | UI_CONSISTENCY | Popup động giống popup Vụ án/Vụ việc (cùng component) | P1 | consistency |
| TC-26 | RED | Đóng popup giữa chừng → ở lại form, không về danh sách | P1 | nav |
| TC-27 | EDGE | Optimistic-lock: Lưu bổ sung với updatedAt cũ → 409, không mất data | P1 | expectedUpdatedAt |

## 3. Test Cases chi tiết

### 3.1. Module: Tải mẫu & Readiness

| TC-ID | TC-01 |
|-------|--------|
| **Loại** | GREEN | **Độ ưu tiên** | P0 | **Yêu cầu** | export-templates |
| **Điều kiện tiên quyết** | 1. Đã đăng nhập admin@pc02.local<br>2. Đã seed 7 mẫu DON_THU (chạy `db:seed:doc-templates`)<br>3. Mở 1 đơn thư bất kỳ ở edit mode |
| **Các bước** | 1. Click nút "In chứng từ"<br>2. Quan sát danh sách mẫu trong popup |
| **Dữ liệu** | petitionId hợp lệ |
| **Kết quả mong đợi** | 1. `GET /petitions/export-templates` trả 200, đúng 7 mẫu DON_THU<br>2. Popup `dynamic-export-modal` hiện 7 dòng (Phiếu đề xuất, Phiếu chuyển nguồn tin, Phiếu chuyển đơn, Thông báo chuyển đơn, Thông báo hướng dẫn, Thông báo trả lại đơn, Biên nhận)<br>3. Mỗi dòng có mô tả `category · code` |
| **Kết quả thực tế** | _(QA điền)_ | **Trạng thái** | _(Đạt/Không đạt/Bị chặn)_ |

| TC-ID | TC-05 |
|-------|--------|
| **Loại** | GREEN | **Độ ưu tiên** | P0 |
| **Điều kiện tiên quyết** | Đơn thư THIẾU `senderName` (đơn nặc danh) hoặc thiếu nhanThay/deXuat |
| **Các bước** | 1. Mở popup In chứng từ<br>2. Quan sát mẫu PHIEU_DE_XUAT |
| **Kết quả mong đợi** | 1. `GET .../export-readiness-dynamic` trả per mẫu `{ready, missing[]}`<br>2. PHIEU_DE_XUAT bị KHOÁ (checkbox disabled), hiện "Thiếu: Họ tên người gửi, Nhận thấy, Đề xuất"<br>3. Ô bổ sung text/textarea hiện đúng từng trường thiếu (dedup union) |
| **Kết quả thực tế** | _(QA)_ | **Trạng thái** | _()_ |

### 3.2. Module: Xuất & Cấp số

| TC-ID | TC-02 |
|-------|--------|
| **Loại** | GREEN | **Độ ưu tiên** | P0 |
| **Điều kiện tiên quyết** | Đơn thư đủ data cho BIEN_NHAN (có senderName + noiDung) |
| **Các bước** | 1. Mở popup<br>2. Tick "Biên nhận"<br>3. Chọn "Gộp 1 file Word"<br>4. Click "Xuất file" |
| **Kết quả mong đợi** | 1. `POST .../export-documents-dynamic {templateIds:[BIEN_NHAN.id], mode:merged, manualValues:{}}` trả 200 blob<br>2. Tải về file `ChungTu_*.docx`, mở được, có {ghiTen}/{noiDung} điền đúng từ đơn<br>3. {soVanBan} = số cấp từ series BIEN_NHAN (định dạng số văn bản)<br>4. Render log có petitionId của đơn |
| **Kết quả thực tế** | _(QA)_ | **Trạng thái** | _()_ |

| TC-ID | TC-08 |
|-------|--------|
| **Loại** | RED | **Độ ưu tiên** | P0 |
| **Điều kiện tiên quyết** | Đơn thư thiếu `senderName`; mẫu PHIEU_DE_XUAT yêu cầu ghiTen+noiDung+nhanThay+deXuat |
| **Các bước** | 1. Cố tình KHÔNG bổ sung trường thiếu<br>2. (Qua API) gọi `POST export-documents-dynamic {templateIds:[PHIEU_DE_XUAT.id]}` |
| **Kết quả mong đợi** | 1. Trả HTTP 400, message "Thiếu thông tin bắt buộc để in: …"<br>2. KHÔNG cấp số văn bản nào (counter không tăng)<br>3. KHÔNG có render log mới<br>4. UI: nút Xuất disabled vì mẫu chưa ready |
| **Kết quả thực tế** | _(QA)_ | **Trạng thái** | _()_ |

| TC-ID | TC-13 |
|-------|--------|
| **Loại** | EDGE | **Độ ưu tiên** | P0 |
| **Các bước** | 1. In BIEN_NHAN lần 1 → ghi số N<br>2. In BIEN_NHAN lần 2 (cùng/khác đơn) → ghi số M |
| **Kết quả mong đợi** | M = N+1 (cùng kỳ), không trùng, không gap |
| **Kết quả thực tế** | _(QA)_ | **Trạng thái** | _()_ |

| TC-ID | TC-14 |
|-------|--------|
| **Loại** | EDGE | **Độ ưu tiên** | P0 |
| **Các bước** | 1. In PHIEU_CHUYEN_NGUON_TIN → số A<br>2. In PHIEU_CHUYEN_DON → số B (cùng series PHIEU_CHUYEN) |
| **Kết quả mong đợi** | A và B nối tiếp trên CÙNG bộ đếm series PHIEU_CHUYEN, không trùng nhau (B=A+1) |
| **Kết quả thực tế** | _(QA)_ | **Trạng thái** | _()_ |

| TC-ID | TC-23 |
|-------|--------|
| **Loại** | DATA/atomic | **Độ ưu tiên** | P0 |
| **Các bước** | 1. Chọn 2 mẫu, mô phỏng lỗi render mẫu thứ 2 (vd file mẫu hỏng)<br>2. Xuất |
| **Kết quả mong đợi** | 1. Toàn bộ rollback trong $transaction → 0 số bị tiêu (kể cả mẫu 1 đã render)<br>2. Không có render log nào được tạo<br>3. Trả lỗi, không trả file nửa vời |
| **Kết quả thực tế** | _(QA)_ | **Trạng thái** | _()_ |

### 3.3. Module: Bổ sung thông tin

| TC-ID | TC-06 |
|-------|--------|
| **Loại** | GREEN | **Độ ưu tiên** | P0 |
| **Điều kiện tiên quyết** | Đơn thiếu senderName |
| **Các bước** | 1. Mở popup → ô "Họ tên người gửi" hiện (savable)<br>2. Nhập "Nguyễn Văn A"<br>3. Click "Lưu bổ sung" |
| **Kết quả mong đợi** | 1. `PUT /petitions/:id {senderName:'Nguyễn Văn A', expectedUpdatedAt}` trả 200<br>2. Mẫu chuyển sang "sẵn sàng" (hết khoá), auto-tick<br>3. Form cha cập nhật field (không bị dirty/chặn) |
| **Kết quả thực tế** | _(QA)_ | **Trạng thái** | _()_ |

| TC-ID | TC-18 |
|-------|--------|
| **Loại** | SECURITY | **Độ ưu tiên** | P0 |
| **Các bước** | (API) `POST export-documents-dynamic {templateIds:[BIEN_NHAN.id], manualValues:{soVanBan:'GIA-MAO-999'}}` |
| **Kết quả mong đợi** | 1. soVanBan GIA-MAO-999 bị STRIP (không vào render)<br>2. {soVanBan} trên file = số THẬT do engine cấp, không phải GIA-MAO-999 |
| **Kết quả thực tế** | _(QA)_ | **Trạng thái** | _()_ |

| TC-ID | TC-19 |
|-------|--------|
| **Loại** | SECURITY | **Độ ưu tiên** | P0 |
| **Các bước** | (API) gửi `manualValues:{ghiTen:{"$gt":""}}` (object) cho mẫu có ghiTen required |
| **Kết quả mong đợi** | KHÔNG trả 500 (TypeError); coerce String() → xử lý như chuỗi (400 nghiệp vụ hoặc render an toàn), không crash |
| **Kết quả thực tế** | _(QA)_ | **Trạng thái** | _()_ |

| TC-ID | TC-20 |
|-------|--------|
| **Loại** | SECURITY | **Độ ưu tiên** | P0 |
| **Các bước** | Nhập giá trị bổ sung chứa `{deXuat}` hoặc `<script>` |
| **Kết quả mong đợi** | Giá trị render NGUYÊN VĂN (escape token docxtemplater), KHÔNG nội suy thành placeholder khác, không lỗi render |
| **Kết quả thực tế** | _(QA)_ | **Trạng thái** | _()_ |

| TC-ID | TC-21 |
|-------|--------|
| **Loại** | SECURITY | **Độ ưu tiên** | P0 |
| **Các bước** | User tổ khác (ngoài scope) gọi `GET /petitions/:id/export-readiness-dynamic` cho đơn không thuộc phạm vi |
| **Kết quả mong đợi** | 403/404 (loadPetitionForExport → getById assert scope), KHÔNG lộ dữ liệu đơn |
| **Kết quả thực tế** | _(QA)_ | **Trạng thái** | _()_ |

## 4. Test Cases liên module (E2E)

### E2E-01: Cán bộ in Phiếu đề xuất cho đơn thiếu thông tin

| Mục | Nội dung |
|-----|----------|
| **TC-ID** | E2E-01 | **Loại** | E2E | **Độ ưu tiên** | P0 |
| **User story** | Là cán bộ, tôi mở đơn thư còn thiếu nghiệp vụ, bổ sung ngay trong popup, in được Phiếu đề xuất có số văn bản |
| **Module đi qua** | Form Đơn thư → Readiness → Lưu bổ sung (PUT đơn) → Xuất (cấp số + render) → Tải file |
| **Các bước** | 1. Mở đơn thư edit<br>2. In chứng từ → popup<br>3. PHIEU_DE_XUAT bị khoá, thiếu "Nhận thấy/Đề xuất"<br>4. Nhập nhanThay + deXuat → Lưu bổ sung<br>5. Mẫu hết khoá, auto-tick → chọn Gộp Word → Xuất file<br>6. Mở file tải về |
| **Luồng dữ liệu chuyển tiếp** | • nhanThay/deXuat nhập (B4) = nội dung render trên file (B6)<br>• senderName/noiDung trên đơn = {ghiTen}/{noiDung} trên file<br>• Số cấp (B5) = {soVanBan} trên file (B6); ghi vào render log với petitionId |
| **Kết quả mong đợi** | 1. Không phải rời popup để sửa đơn (bổ sung tại chỗ)<br>2. File phản ánh đúng mọi dữ liệu vừa nhập + cấp số đúng series PHIEU_DE_XUAT<br>3. Không dead-end, không cần refresh thủ công |
| **Điểm cần quan sát** | Số click thừa; có rõ trường nào còn thiếu không; thông báo lỗi khi xuất thiếu có dễ hiểu không |

### E2E-02: In ZIP nhiều mẫu chia sẻ series + rollback

| Mục | Nội dung |
|-----|----------|
| **TC-ID** | E2E-02 | **Loại** | E2E/Rollback | **Độ ưu tiên** | P0 |
| **Các bước** | 1. Chọn PHIEU_CHUYEN_NGUON_TIN + PHIEU_CHUYEN_DON (chung series) + THONG_BAO_CHUYEN<br>2. Chế độ ZIP → Xuất |
| **Luồng dữ liệu** | 2 phiếu chuyển nối tiếp số trên series PHIEU_CHUYEN; THONG_BAO_CHUYEN số riêng series THONG_BAO |
| **Kết quả mong đợi** | ZIP gồm 3 file đúng tên; số văn bản 3 mẫu đúng series, không trùng; nếu 1 mẫu lỗi → rollback HẾT (0 số tiêu) |

## 5. Dữ liệu kiểm thử

### 5.1. Tài khoản
| ID | Email | Vai trò | Ghi chú |
|----|-------|---------|---------|
| U001 | admin@pc02.local | ADMIN | Có quyền read Petition + Setting |
| U002 | officer khác tổ | OFFICER | Test RBAC scope (TC-21) — đơn ngoài phạm vi |

### 5.2. Đơn thư mẫu
| ID | senderName | detailContent/summary | nhanThay/deXuat | Dùng cho |
|----|-----------|----------------------|-----------------|----------|
| P-FULL | "Trần Văn B" | có | có | TC-02/03/13/14/17 (đủ data) |
| P-MISS | (rỗng) | (rỗng) | (rỗng) | TC-05/06/08, E2E-01 (thiếu) |
| P-SUMMARY | "Lê C" | detailContent rỗng, summary có | — | TC-15 (computed noiDung) |

### 5.3. Payload bất thường (RED/SECURITY)
| Trường | Giá trị | Lý do |
|--------|---------|-------|
| manualValues.soVanBan | "GIA-MAO-999" | TC-18 forge |
| manualValues.ghiTen | `{"$gt":""}` (object) | TC-19 non-string |
| giá trị bổ sung | `{deXuat}` / `<script>alert(1)</script>` | TC-20 injection |
| templateIds | [id, id] (trùng) | TC-10 |
| templateIds | ["khong-ton-tai"] | TC-11 |

## 6. Checklist độ phủ

| Loại | Số TC | Trạng thái | Ghi chú |
|------|-------|------------|---------|
| GREEN | 7 (01-07) | ✅ | tải mẫu, readiness, xuất merged/zip, lưu bổ sung |
| RED | 5 (08-12,26) | ✅ | thiếu required, 0 mẫu, trùng, không tồn tại, sai entityType, đóng popup |
| EDGE | 4 (13-16,27) | ✅ | số tuần tự, series chung, computed noiDung, auto-tick, optimistic-lock |
| BOUNDARY | 1 (17) | ✅ | chọn cả 7 mẫu |
| SECURITY | 4 (18-21) | ✅ | forge soVanBan, non-string, injection, RBAC scope |
| DATA | 2 (22,23) | ✅ | i18n tiếng Việt, atomic rollback |
| PERFORMANCE | 1 (24) | ✅ | 7 mẫu gộp <5s |
| UI_CONSISTENCY | 1 (25) | ✅ | đồng bộ popup Vụ án/Vụ việc (cùng DynamicExportDocumentsModal) |
| E2E | 2 | ✅ | bổ sung→in; ZIP series chung + rollback |
| **Tổng** | **27** | | Phủ đủ lớp/biên/nhánh/rủi ro (cấp số, validate, security là trọng tâm P0) |

## 7. Nhận định trải nghiệm & Đề xuất cải tiến

| ID | Mức độ | Loại | Quan sát (user thật) | Tác động | Đề xuất |
|----|--------|------|----------------------|----------|---------|
| UX-01 | Trung bình | Phản hồi trạng thái | Khi xuất, nút "Xuất file" đã có spinner+disable — tốt. Nhưng nếu cấp số chậm, user không biết đang cấp số hay đang render | Lo lắng nhẹ | Thêm dòng trạng thái "Đang cấp số văn bản…" khi mẫu needsNumber |
| UX-02 | Trung bình | Luồng dữ liệu | Trường "savable" PUT thẳng vào đơn; nếu user chỉ muốn in 1 lần mà không lưu vĩnh viễn vào đơn thì không có lựa chọn | Có thể ghi đè data đơn ngoài ý muốn | Cho phép tick "chỉ dùng để in, không lưu vào đơn" cho trường savable |
| UX-03 | Thấp | Nhất quán | Popup động dùng chung component với Vụ án/Vụ việc → nhất quán tốt (điểm tích cực cần giữ) | — | Giữ nguyên |
| UX-04 | Thấp | Rõ ràng | Mẫu bị khoá hiện "Thiếu: X, Y" — rõ; nhưng không nói trường nào lưu-vào-đơn vs nhập-tạm | Hơi mơ hồ | Gắn nhãn nhỏ "(lưu vào đơn)" cho field savable |

## 8. Câu hỏi cho PO/BA

1. Trường "savable" (senderName, detailContent, nhanThay, deXuat, lyDoChuyen, canCuPhapLy, huongDanKhoiKien, lyDoTraDon) có được phép GHI ĐÈ vào đơn khi bổ sung lúc in không, hay chỉ dùng tạm để in? (Hiện đang PUT vào đơn).
2. Số văn bản cấp ra có cần đối chiếu 1-1 với engine tĩnh cũ (cùng định dạng/chuỗi) trong giai đoạn chạy song song không?
3. Khi đơn thư nặc danh (senderName rỗng hợp lệ), có vẫn bắt buộc nhập "Họ tên người gửi" để in không, hay cho phép để trống?

---

## Tóm tắt quyết định release (UAT Sign-off)

| Tiêu chí | Ngưỡng | Thực tế | Đạt? |
|----------|--------|---------|------|
| P0 pass | 100% | …/14 | … |
| P1 pass | ≥95% | …/… | … |
| Lỗi Nghiêm trọng/Cao đang mở | 0 | … | … |
| E2E P0 thông suốt | 100% | …/2 | … |
| **Khuyến nghị** | | | **GO / NO-GO / GO có điều kiện** |
