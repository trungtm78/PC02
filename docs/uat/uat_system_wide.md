# UAT — SYSTEM-WIDE (Toàn hệ thống PC02)

**Hệ thống**: PC02 Case Management System  
**Phiên bản**: ≥ v0.67.x  
**Ngày tạo**: 2026-05-31  
**Môi trường**: `http://171.244.40.245` · API base: `/api/v1`  
**Tổng TC system-wide**: ~57 TC bổ sung (trên 500 TC feature-level đã có)

> **Quan hệ với feature-level UAT:**  
> - Cases: 130 TC → `docs/uat/cases/uat_cases.md`  
> - Incidents: 140 TC → `docs/uat/incidents/uat_incidents.md`  
> - Petitions: 120 TC → `docs/uat/petitions/uat_petitions.md`  
> - UTDT: 110 TC → `docs/uat/utdt/uat_utdt.md`  
> File này kiểm tra **tích hợp xuyên module, journeys E2E, nhất quán UI/UX và phi chức năng** mà feature-level không cover.

---

## S1. Bản đồ hệ thống & phạm vi UAT

| Mục | Nội dung |
|-----|----------|
| **Tên hệ thống** | PC02 Case Management System |
| **Loại hệ thống** | Hệ thống quản lý nghiệp vụ nội bộ Công an (Phường/Xã/Huyện) — NestJS API + React SPA |
| **Các actor/role** | ADMIN · OFFICER (Điều tra viên) · DEADLINE_APPROVER · _(VIEWER/DISPATCHER/WARD_OFFICER chưa seed — không test)_ |
| **Module IN SCOPE** | Auth & Phân quyền · Cases · Incidents · Petitions · UTDT · Document Numbers · Ho Sơ Journey · KPI Dashboard · Notifications · Activity Log · SystemSetting |
| **OUT OF SCOPE** | Mobile native · Email delivery gateway · SSO/LDAP · 3rd-party chưa tích hợp |
| **Feature-level đã có** | 500 TC trong `docs/uat/` (Cases 130 + Incidents 140 + Petitions 120 + UTDT 110) |
| **Giả định** | ① Deadline theo BLTTHS 2015 Đ.147/148/149 là default. ② VIEWER role chưa cần test. ③ KPI 4 chỉ tiêu TT28 là static formula |

---

## S2. Thứ tự test module

| Thứ tự | Module | Phụ thuộc | Master data cần sẵn |
|--------|--------|-----------|---------------------|
| 1 | Auth & Phân quyền | — | 5 accounts `_shared/test-accounts.json`; `feature_flags` seed |
| 2 | SystemSetting | Auth | Config thời hạn TT28 |
| 3 | Petitions | Auth | STT pattern; danh mục loại đơn |
| 4 | Incidents | Auth, Petitions (opt) | Danh mục loại vụ việc |
| 5 | Cases | Auth, Incidents, Petitions | Danh mục tội danh; caseCode |
| 6 | UTDT | Auth, Cases | Danh mục đơn vị giao |
| 7 | Document Numbers | Auth, Cases/Incidents/Petitions | Template config |
| 8 | Ho Sơ Journey | Cases, Incidents, Petitions | Data từ module 3-5 |
| 9 | KPI Dashboard | Cases, Incidents, Petitions | ≥10 records các trạng thái |
| 10 | Notifications | Tất cả (event emit) | event_categories seed |
| 11 | Activity Log | Tất cả | — |

---

## S3. Ma trận tích hợp module

| Module nguồn | Module đích | Dữ liệu bàn giao | Điều cần verify | Ưu tiên |
|--------------|-------------|------------------|-----------------|---------|
| Petitions | Cases | `petitionType` → auto-create Petition khi tạo Case | Petition tạo ngay; STT đúng; link 2 chiều | **P0** |
| Cases | Petitions (sync ngược) | Update `petitionType` → sync Petition liên kết | Petition cập nhật đúng loại; không duplicate | **P0** |
| Cases | Incidents | `caseId` → auto-create Incident (branch 3) | `caseCode` trên Incident đúng | **P0** |
| Cases | UTDT | `caseId` bắt buộc | Không tạo UTDT nếu Case không tồn tại; cascade khi xóa Case | **P0** |
| Petitions | Cases | `convertToCase` transaction | Atomic: Petition=CONVERTED + Case tạo; rollback khi fail | **P0** |
| Cases/Incidents/Petitions | Document Numbers | Entity ID + template | Số không trùng trong năm; format đúng | **P0** |
| Cases/Incidents/Petitions | Ho Sơ Journey | Timeline events | Thứ tự thời gian đúng; cross-module actor đúng | **P1** |
| Cases/Incidents/Petitions | KPI Dashboard | Trạng thái + thời gian | 4 chỉ tiêu TT28 đúng; drill-down theo Tổ đúng scope | **P1** |
| Tất cả write actions | Notifications | Event emit | Đúng user nhận; SSE realtime; không gửi nhầm | **P1** |
| Tất cả write actions | Activity Log | Actor + action + entity | Mỗi CRUD có audit record; không missing khi concurrent | **P1** |
| Auth | Tất cả | JWT scope + teamId | DataScope: officer1 không thấy data team B — TẤT CẢ 4 module | **P0** |
| SystemSetting | Cases | `processingDeadlineDays` | Auto-deadline = ngày tạo + days từ setting | **P1** |

---

## S4. Danh mục User Journey E2E

| JID | Journey | Module | Actor | Ưu tiên | Loại |
|-----|---------|--------|-------|---------|------|
| J01 | Tiếp nhận đơn thư → xác minh → đóng | Petitions → Log | OFFICER | P0 | Happy |
| J02 | Tạo Case kèm petitionType → kiểm auto-Petition → sync | Cases → Petitions | OFFICER | P0 | Auto-create |
| J03 | Case → auto-Incident → UTDT → hoàn kết | Cases → Incidents → UTDT | OFFICER+ADMIN | P0 | Cross-module |
| J04 | Đơn thư → convertToCase → rollback nếu fail | Petitions → Cases | OFFICER | P0 | Atomic/Rollback |
| J05 | OFFICER tạo case → ADMIN xem KPI drill-down | Cases → KPI | OFFICER+ADMIN | P1 | Cross-role |
| J06 | Tạo entity → nhận thông báo realtime | Cases/Incidents/Petitions → Notifications | OFFICER | P1 | Realtime |
| J07 | Case qua nhiều trạng thái → xem Hành trình hồ sơ | Cases (15 trạng thái) → Journey | OFFICER | P1 | Audit trail |
| J08 | OFFICER team A cố truy cập data team B — tất cả module | Cases+Incidents+Petitions+UTDT | OFFICER (cross-team) | P0 | SECURITY |
| J09 | Tạo case → sinh số hồ sơ → xem trên detail | Cases → Document Numbers | OFFICER | P1 | Sub-flow |
| J10 | Admin đổi SystemSetting → tạo Case → verify deadline | SystemSetting → Cases | ADMIN+OFFICER | P1 | Config-driven |
| J11 | Session timeout giữa điền form → redirect login → resume | Auth → Cases | OFFICER | P1 | Interrupted |
| J12 | Xóa Case có Petition liên kết → kiểm cascade | Cases → Petitions | ADMIN | P1 | Constraint |

---

## S5. Vòng đời dữ liệu — Đơn thư (Petition)

| Giai đoạn | Module | Trạng thái | Điều verify khi chuyển tiếp |
|-----------|--------|-----------|------------------------------|
| Tạo mới | Petitions | `RECEIVED` | STT `DT-YYYY-NNNNN` sinh đúng; auto-deadline từ SystemSetting |
| Phân loại | Petitions | `CLASSIFIED` | petitionType ghi đúng; audit log có record |
| Xác minh | Petitions | `UNDER_REVIEW` | Không skip trạng thái không hợp lệ |
| Chuyển thành Vụ án | Petitions → Cases | `CONVERTED` | Atomic; rollback nếu fail; không cho undo sau CONVERTED |
| Đóng (không tạo case) | Petitions | `CLOSED` | Không tạo Case; không xóa được sau CLOSED |
| Sau convert — Case | Cases | 15 trạng thái BCA | Case kế thừa thông tin Petition gốc |

---

## S6. Phi chức năng mức hệ thống

| Khía cạnh | Điều cần verify | Ưu tiên |
|-----------|-----------------|---------|
| DataScope xuyên hệ thống | officer1 KHÔNG thấy data Cases/Incidents/Petitions/UTDT của officer2's team — API + UI | **P0** |
| Transaction atomic | `convertToCase` và `auto-create Petition` rollback đúng khi fail giữa chừng | **P0** |
| Phiên & JWT | JWT expired → 401 mọi API; logout invalidate; refresh rotation không để ghost token | **P0** |
| Tải đồng thời nhẹ | 5 officer đồng thời tạo Case không conflict; concurrent update 1 Case → optimistic lock đúng | **P1** |
| Timezone VN | Deadline = `createdAt (GMT+7)` + days; không drift qua đêm | **P1** |
| SSE Notifications | Kết nối >10 phút không drop; reconnect auto sau mất mạng | **P1** |
| Khôi phục sự cố | Backend restart → frontend thông báo lỗi rõ, không treo state | **P1** |
| **Nhất quán UI/UX xuyên hệ thống** | ① Màu badge trạng thái đồng nhất xuyên 4 module · ② Tên nút nhất quán ("Lưu"/"Tạo mới"/"Hủy"/"Xóa") · ③ Format ngày dd/MM/yyyy HH:mm nhất quán · ④ Vị trí Primary CTA nhất quán · ⑤ Confirm dialog pattern nhất quán · ⑥ Toast góc phải trên, auto-close 3s · ⑦ Empty state cùng pattern · ⑧ Loading spinner nhất quán | **P1** |

---

## S7. Smoke Test

| ID | Kiểm tra nhanh | Module | Tài khoản |
|----|----------------|--------|-----------|
| SMK-01 | `GET /api/v1/health` → `{"status":"ok"}` | API | — |
| SMK-02 | Login thành công, nhận JWT | Auth | admin@ |
| SMK-03 | Sidebar ≥4 nghiệp vụ (feature_flags seed) | UI | officer1@ |
| SMK-04 | Danh sách Cases load không lỗi 500 | Cases | officer1@ |
| SMK-05 | Danh sách Incidents load không lỗi 500 | Incidents | officer1@ |
| SMK-06 | Danh sách Petitions load không lỗi 500 | Petitions | officer1@ |
| SMK-07 | Danh sách UTDT load không lỗi 500 | UTDT | officer1@ |
| SMK-08 | KPI Dashboard load, 4 chỉ tiêu hiển thị | KPI | admin@ |
| SMK-09 | Tạo 1 Petition → STT sinh đúng pattern `DT-YYYY-NNNNN` | Petitions | officer1@ |
| SMK-10 | Notification bell → panel mở không lỗi | Notifications | officer1@ |

---

## S8. Ưu tiên theo rủi ro

**Thứ tự thực thi khi bị cắt thời gian:**
1. Auth + DataScope (J08) — mọi fail = lộ dữ liệu nghiệp vụ nhạy cảm
2. J04 convertToCase atomic — mất dữ liệu nếu partial commit
3. J02 auto-create Petition + J03 Case→Incident→UTDT chain — core business rule
4. 255 P0 TC feature-level (Cases 62 + Incidents 73 + Petitions 62 + UTDT 58)
5. UI_CONSISTENCY cross-module (sau khi functional pass)
6. KPI, Notifications, Journey, Document Numbers

**Câu hỏi PO/BA:**
1. VIEWER / DISPATCHER role: cần seed hay bỏ qua?
2. KPI refresh: realtime hay T+1?
3. UTDT khi xóa Case: cascade delete hay block xóa?
4. STT Petition reset đầu năm hay chạy liên tục?
5. Design token badge trạng thái: có Figma spec không?

---

# PHẦN II — TC CHI TIẾT SYSTEM-WIDE

## TC Smoke Tests

| TC-ID | SMK-01 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Health check API trả về ok trước khi bắt đầu UAT |
| **Điều kiện tiên quyết** | Môi trường UAT đang chạy |
| **Các bước kiểm thử** | 1. Gửi `GET http://171.244.40.245/api/v1/health` |
| **Kết quả mong đợi** | 1. HTTP 200<br>2. Body: `{"status":"ok"}` |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | SMK-02 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Login admin thành công — tiền đề cho toàn bộ UAT |
| **Điều kiện tiên quyết** | SMK-01 đạt |
| **Các bước kiểm thử** | 1. `POST /api/v1/auth/login` body `{"email":"admin@pc02.local","password":"68@Love2love68"}` |
| **Kết quả mong đợi** | 1. HTTP 200<br>2. Response có `accessToken` (JWT)<br>3. Token dùng được cho request tiếp theo |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | SMK-03 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Sidebar hiển thị đủ 4 nghiệp vụ sau login |
| **Điều kiện tiên quyết** | `feature_flags` đã seed; login với officer1@ |
| **Các bước kiểm thử** | 1. Đăng nhập với `officer1@pc02.local`<br>2. Quan sát sidebar trái |
| **Kết quả mong đợi** | 1. Sidebar hiển thị ≥4 mục nghiệp vụ: Vụ án, Vụ việc, Đơn thư, Ủy thác điều tra<br>2. Không có mục nào bị ẩn do feature_flags trống |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Nếu fail: chạy `npm run db:seed:features` trên VM (source .env trước) |

---

| TC-ID | SMK-09 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Tạo Petition — STT sinh đúng pattern DT-YYYY-NNNNN |
| **Điều kiện tiên quyết** | Login officer1@; chưa có Petition nào trong ngày test |
| **Các bước kiểm thử** | 1. Mở trang tạo Đơn thư mới<br>2. Điền đủ thông tin bắt buộc<br>3. Click Tạo mới |
| **Kết quả mong đợi** | 1. Petition được tạo thành công<br>2. Trường STT hiển thị format `DT-2026-NNNNN` (N là số thứ tự 5 chữ số)<br>3. STT không trùng với Petition đã có |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

## TC E2E Journeys (P0)

### J01 — Tiếp nhận đơn thư → xác minh → đóng

| Mục | Nội dung |
|-----|----------|
| **TC-ID** | J01 |
| **Loại** | E2E |
| **Độ ưu tiên** | P0 |
| **User story** | Là OFFICER, tôi tiếp nhận một đơn thư, xác minh nội dung và đóng đơn sau khi xử lý xong |
| **Module đi qua** | Petitions (tạo → phân loại → xác minh → đóng) → Activity Log |
| **Điều kiện tiên quyết** | 1. Login officer1@<br>2. Danh mục loại đơn đã có dữ liệu |
| **Các bước kiểm thử** | 1. [Tạo] Mở form tạo Đơn thư mới, điền đầy đủ thông tin, click Tạo mới<br>2. [Phân loại] Mở đơn vừa tạo, cập nhật loại đơn, click Lưu<br>3. [Xác minh] Chuyển trạng thái sang "Đang xác minh"<br>4. [Đóng] Chuyển trạng thái sang "Đã đóng"<br>5. [Kiểm tra] Mở Activity Log, lọc theo đơn vừa tạo |
| **Luồng dữ liệu chuyển tiếp** | STT sinh ở B1 = hiển thị nhất quán xuyên B2→B5; actor ở B1-B4 = actor ghi trong Activity Log B5 |
| **Kết quả mong đợi** | 1. Mỗi bước chuyển trạng thái thành công, không lỗi<br>2. Không cho phép chuyển từ RECEIVED sang CLOSED trực tiếp (bỏ qua UNDER_REVIEW) — nếu hệ thống chặn → đúng<br>3. Activity Log có ≥4 entries tương ứng 4 action<br>4. Sau khi CLOSED: nút chỉnh sửa bị vô hiệu hóa hoặc ẩn |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

### J02 — Tạo Case kèm petitionType → kiểm auto-Petition → sync ngược

| Mục | Nội dung |
|-----|----------|
| **TC-ID** | J02 |
| **Loại** | E2E |
| **Độ ưu tiên** | P0 |
| **User story** | Là OFFICER, tôi tạo Vụ án với loại đơn thư kèm theo, hệ thống tự sinh Đơn thư liên kết, và khi tôi cập nhật loại trên Vụ án thì Đơn thư cũng tự cập nhật |
| **Module đi qua** | Cases (tạo có petitionType) → Petitions (auto-create) → Cases (update petitionType) → Petitions (sync) |
| **Điều kiện tiên quyết** | 1. Login officer1@<br>2. Danh mục petitionType đã có ≥2 loại |
| **Các bước kiểm thử** | 1. [Tạo Case] Tạo Vụ án mới, chọn petitionType = "Loại A", submit<br>2. [Verify auto-Petition] Mở danh sách Đơn thư, kiểm tra Petition mới xuất hiện với loại = "Loại A" và liên kết caseId đúng<br>3. [Update Case] Mở Case vừa tạo, đổi petitionType = "Loại B", lưu<br>4. [Verify sync] Mở lại Petition vừa auto-tạo, kiểm tra loại đã đổi sang "Loại B" |
| **Luồng dữ liệu chuyển tiếp** | petitionType ở B1 = petitionType trên Petition B2; petitionType mới ở B3 = petitionType Petition B4 |
| **Kết quả mong đợi** | 1. B2: Petition xuất hiện ngay (không phải manual tạo), STT đúng format<br>2. B2: Petition có `caseId` trỏ đúng về Case vừa tạo<br>3. B4: Petition hiển thị petitionType = "Loại B" — không cần refresh thủ công<br>4. Không tạo thêm Petition thứ 2 khi update (chỉ sync, không duplicate) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

### J03 — Case → auto-Incident → UTDT → hoàn kết

| Mục | Nội dung |
|-----|----------|
| **TC-ID** | J03 |
| **Loại** | E2E |
| **Độ ưu tiên** | P0 |
| **User story** | Là OFFICER, tôi xử lý một vụ án phức tạp: vụ án tự sinh vụ việc, tôi thêm ủy thác điều tra, rồi hoàn kết toàn bộ |
| **Module đi qua** | Cases → Incidents (auto) → UTDT (tạo thủ công) → Cases (kết thúc) |
| **Điều kiện tiên quyết** | 1. Login officer1@ (tạo Case) + admin@ (verify UTDT)<br>2. Danh mục đơn vị giao UTDT đã có |
| **Các bước kiểm thử** | 1. [Tạo Case] Tạo Vụ án, chuyển sang giai đoạn trigger auto-create Incident (branch 3)<br>2. [Verify Incident] Mở danh sách Vụ việc, tìm Incident có `caseCode` = Case vừa tạo<br>3. [Thêm UTDT] Trong trang Case, chuyển tab Ủy thác điều tra, tạo UTDT mới với đơn vị giao<br>4. [Verify UTDT] UTDT hiển thị trong danh sách UTDT chung, caseCode đúng<br>5. [Hoàn kết] Chuyển Case sang trạng thái kết thúc<br>6. [Verify cascade] Incident và UTDT liên kết hiển thị đúng trạng thái |
| **Luồng dữ liệu chuyển tiếp** | caseId Case B1 = caseId Incident B2 = caseId UTDT B3 = caseId trên tất cả sub-records B4-B6 |
| **Kết quả mong đợi** | 1. Incident auto-created có `caseCode` = Case B1<br>2. UTDT tạo được; không tạo được nếu caseId không hợp lệ<br>3. Sau B5: Case = COMPLETED; Incident và UTDT vẫn accessible (không cascade delete)<br>4. Tất cả entries xuất hiện trong Activity Log |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

### J04 — Đơn thư → convertToCase → kiểm tra atomicity

| Mục | Nội dung |
|-----|----------|
| **TC-ID** | J04-A |
| **Loại** | E2E |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | convertToCase thành công — Petition=CONVERTED và Case tạo trong cùng transaction |
| **Module đi qua** | Petitions → Cases |
| **Điều kiện tiên quyết** | 1. Login officer1@<br>2. Có Petition ở trạng thái cho phép convert (không phải CLOSED/CONVERTED) |
| **Các bước kiểm thử** | 1. Mở Petition hợp lệ<br>2. Click "Chuyển thành Vụ án" (convertToCase)<br>3. Điền thông tin Case bắt buộc nếu có form<br>4. Xác nhận |
| **Kết quả mong đợi** | 1. Petition chuyển trạng thái = CONVERTED ngay lập tức<br>2. Case mới được tạo với thông tin kế thừa từ Petition<br>3. Case mới có liên kết trỏ về Petition gốc (petitionId)<br>4. Không thể convert Petition này lần 2 — nút bị ẩn/disabled<br>5. Cả 2 thay đổi (Petition + Case) xuất hiện trong Activity Log |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | J04-B |
|-------|-------|
| **Loại** | E2E |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | convertToCase với dữ liệu Case thiếu bắt buộc — Petition KHÔNG bị thay đổi trạng thái |
| **Điều kiện tiên quyết** | Như J04-A; cần biết field nào bắt buộc khi tạo Case |
| **Các bước kiểm thử** | 1. Mở Petition hợp lệ<br>2. Click "Chuyển thành Vụ án"<br>3. Bỏ trống field bắt buộc của Case<br>4. Submit |
| **Kết quả mong đợi** | 1. Hệ thống báo lỗi validation — không tạo Case<br>2. **Quan trọng**: Petition vẫn ở trạng thái cũ (không bị đổi sang CONVERTED)<br>3. Không có record nào bị treo ở trạng thái nửa vời |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Test atomicity — đây là P0 vì partial commit = mất dữ liệu |

---

### J08 — DataScope cross-team (SECURITY P0)

| TC-ID | J08-A |
|-------|-------|
| **Loại** | SECURITY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | OFFICER team B không xem được Cases của OFFICER team A qua UI |
| **Điều kiện tiên quyết** | 1. officer1@ và officer2@ thuộc 2 team khác nhau<br>2. officer1@ đã tạo ≥1 Case |
| **Các bước kiểm thử** | 1. Login officer1@, tạo 1 Case, ghi lại caseId<br>2. Đăng xuất<br>3. Login officer2@<br>4. Mở trang danh sách Cases |
| **Kết quả mong đợi** | 1. Danh sách Cases của officer2@ không có Case của officer1@<br>2. Truy cập trực tiếp `/cases/{caseId-của-officer1}` → 403 hoặc 404 (không trả về data) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | **BLOCKER** nếu fail — không release |

---

| TC-ID | J08-B |
|-------|-------|
| **Loại** | SECURITY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | OFFICER team B không truy cập được Incidents, Petitions, UTDT của team A qua API |
| **Điều kiện tiên quyết** | officer1@ đã có data trên cả 4 module; officer2@ ở team khác |
| **Các bước kiểm thử** | 1. Lấy JWT của officer2@ qua login<br>2. Gọi `GET /api/v1/cases/{id-team-A}` với token officer2@<br>3. Gọi `GET /api/v1/incidents/{id-team-A}` với token officer2@<br>4. Gọi `GET /api/v1/petitions/{id-team-A}` với token officer2@<br>5. Gọi `GET /api/v1/utdt/{id-team-A}` với token officer2@ |
| **Kết quả mong đợi** | Tất cả 4 request đều trả về 403 hoặc 404 — không trả về data của team A |
| **Kết quả thực tế** | _(QA điền — ghi rõ HTTP status từng request)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | J08-C |
|-------|-------|
| **Loại** | SECURITY |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | OFFICER team B không sửa/xóa được data của team A qua API |
| **Điều kiện tiên quyết** | Như J08-B |
| **Các bước kiểm thử** | 1. JWT officer2@<br>2. `PATCH /api/v1/cases/{id-team-A}` body `{"title":"hack"}` với token officer2@<br>3. `DELETE /api/v1/cases/{id-team-A}` với token officer2@ |
| **Kết quả mong đợi** | 1. PATCH → 403 (không sửa được)<br>2. DELETE → 403 (không xóa được)<br>3. Data của officer1@ không bị thay đổi — verify bằng GET với token officer1@ |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

## TC Tích hợp (Integration Spot-checks)

### INT — Auto-create Petition khi tạo Case có petitionType

| TC-ID | INT-01 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Tạo Case với petitionType → Petition tự động tạo và link |
| **Điều kiện tiên quyết** | Login officer1@; petitionType hợp lệ tồn tại |
| **Các bước kiểm thử** | 1. `POST /api/v1/cases` body có `petitionType: "LOAI_A"`<br>2. Lấy caseId từ response<br>3. `GET /api/v1/petitions?caseId={caseId}` |
| **Kết quả mong đợi** | 1. Case tạo thành công HTTP 201<br>2. Petition tự tạo: `GET /petitions?caseId` trả về 1 record; STT đúng `DT-YYYY-NNNNN`; `petitionType` = "LOAI_A"; `caseId` đúng |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | INT-02 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Update petitionType trên Case → Petition liên kết sync ngược |
| **Điều kiện tiên quyết** | Có Case đã liên kết với Petition (kết quả INT-01) |
| **Các bước kiểm thử** | 1. Ghi lại petitionId từ Petition được tạo ở INT-01<br>2. `PATCH /api/v1/cases/{caseId}` body `{"petitionType":"LOAI_B"}`<br>3. `GET /api/v1/petitions/{petitionId}` |
| **Kết quả mong đợi** | 1. PATCH Case → 200<br>2. Petition: `petitionType` = "LOAI_B"; không tạo Petition mới (vẫn đúng 1 Petition liên kết) |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | INT-03 |
|-------|--------|
| **Loại** | RED |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | Tạo UTDT với caseId không tồn tại → từ chối |
| **Điều kiện tiên quyết** | Login officer1@ |
| **Các bước kiểm thử** | 1. `POST /api/v1/utdt` body `{"caseId":"non-existent-id", ...}` |
| **Kết quả mong đợi** | 1. HTTP 400 hoặc 404<br>2. Message rõ lý do (caseId không tồn tại hoặc không trong scope)<br>3. Không tạo UTDT orphan |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | INT-04 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P0 |
| **Tiêu đề** | convertToCase — atomic: Petition=CONVERTED và Case tạo cùng lúc |
| **Điều kiện tiên quyết** | Petition ở trạng thái hợp lệ để convert |
| **Các bước kiểm thử** | 1. Ghi trạng thái Petition trước: `GET /petitions/{id}`<br>2. `POST /api/v1/petitions/{id}/convert-to-case` với body đầy đủ<br>3. `GET /petitions/{id}` sau convert<br>4. `GET /cases?petitionId={id}` |
| **Kết quả mong đợi** | 1. Petition status = "CONVERTED"<br>2. Tồn tại đúng 1 Case mới với petitionId = Petition gốc<br>3. Case kế thừa thông tin từ Petition (tên, loại, người nộp…)<br>4. Không thể convert lần 2: `POST convert-to-case` lần 2 → 400/409 |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | INT-05 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Document Number sinh đúng format và không trùng trong cùng năm |
| **Điều kiện tiên quyết** | Có ≥1 Case tồn tại; template config đã cấu hình |
| **Các bước kiểm thử** | 1. Tạo số hồ sơ cho Case A<br>2. Tạo số hồ sơ cho Case B (cùng năm, cùng loại) |
| **Kết quả mong đợi** | 1. Số Case A: đúng format template, suffix tự tăng (vd: PC02/2026/0001)<br>2. Số Case B: cùng prefix, suffix tăng lên (0002 hoặc số tiếp theo) — không trùng với 0001 |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | INT-06 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Ho Sơ Journey tổng hợp đúng thứ tự thời gian từ Cases + Incidents |
| **Điều kiện tiên quyết** | Có Case đã liên kết Incident, cả 2 đã qua ≥2 trạng thái |
| **Các bước kiểm thử** | 1. Ghi lại thứ tự thao tác thực hiện trên Case và Incident (timestamp)<br>2. Mở trang Hành trình hồ sơ của Case |
| **Kết quả mong đợi** | 1. Timeline hiển thị events từ cả Case và Incident theo đúng thứ tự thời gian<br>2. Actor đúng với người thực hiện từng action<br>3. Không thiếu event nào đã thực hiện |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | INT-07 |
|-------|--------|
| **Loại** | GREEN |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Notification realtime khi tạo entity mới |
| **Điều kiện tiên quyết** | Login 2 tab: tab A = officer1@, tab B = admin@ (admin nhận notification); SSE connection active |
| **Các bước kiểm thử** | 1. Tab B: mở trang, quan sát notification bell<br>2. Tab A: tạo 1 Case mới<br>3. Tab B: quan sát bell trong vòng 5 giây |
| **Kết quả mong đợi** | 1. Tab B: bell badge tăng lên hoặc notification mới xuất hiện trong ≤5 giây sau B2<br>2. Click bell: notification có đúng tiêu đề và link về Case vừa tạo<br>3. Không cần refresh trang |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

## TC UI/UX Consistency (UI_CONSISTENCY)

### UIC — Nhất quán badge trạng thái

| TC-ID | UIC-01 |
|-------|--------|
| **Loại** | UI_CONSISTENCY |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Màu badge trạng thái tương đương nhất quán xuyên Cases, Incidents, Petitions, UTDT |
| **Module kiểm tra** | Cases (danh sách) → Incidents (danh sách) → Petitions (danh sách) → UTDT (danh sách) |
| **Điều kiện tiên quyết** | Mỗi module có ≥1 record ở trạng thái đang hoạt động (vd: "Đang xử lý" / "Đang xác minh" / trạng thái tương đương) |
| **Các bước kiểm thử** | 1. Mở danh sách Cases — chụp màu badge trạng thái "đang tiến hành"<br>2. Mở danh sách Incidents — chụp màu badge trạng thái tương đương<br>3. Mở danh sách Petitions — chụp màu badge<br>4. Mở danh sách UTDT — chụp màu badge<br>5. So sánh 4 ảnh chụp |
| **Kết quả mong đợi** | 1. Badge "trạng thái đang tiến hành" trên 4 module có cùng màu nền và màu chữ<br>2. Màu semantic nhất quán: xanh lá = hoàn thành, đỏ = từ chối/lỗi, vàng = đang chờ/xử lý, xám = tạm dừng<br>3. Không có module nào dùng màu "đặc biệt" không xuất hiện ở module khác |
| **Kết quả thực tế** | _(QA điền — đính kèm screenshot 4 module để đối chiếu)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |
| **Ghi chú** | Nếu fail → tạo ticket "Design inconsistency — badge color" với screenshot đối chiếu |

---

| TC-ID | UIC-02 |
|-------|--------|
| **Loại** | UI_CONSISTENCY |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Nhãn nút hành động nhất quán xuyên 4 module (Lưu / Tạo mới / Hủy / Xóa) |
| **Module kiểm tra** | Form tạo/sửa của Cases, Incidents, Petitions, UTDT |
| **Các bước kiểm thử** | 1. Mở form tạo mới Cases — ghi nhận nhãn nút xác nhận và nút hủy<br>2. Mở form tạo mới Incidents — tương tự<br>3. Mở form tạo mới Petitions — tương tự<br>4. Mở form tạo mới UTDT — tương tự<br>5. Lặp lại cho form chỉnh sửa (edit) ở 4 module<br>6. Kiểm tra confirm dialog xóa ở 4 module |
| **Kết quả mong đợi** | 1. Nút xác nhận tạo mới: cùng nhãn (vd: "Tạo mới") ở 4 module<br>2. Nút xác nhận chỉnh sửa: cùng nhãn (vd: "Lưu") ở 4 module<br>3. Nút hủy: cùng nhãn (vd: "Hủy") ở 4 module<br>4. Nút xóa trong confirm dialog: cùng nhãn (vd: "Xóa") ở 4 module<br>5. Vị trí Primary CTA nhất quán (góc phải dưới hoặc đầu trang — chọn 1) |
| **Kết quả thực tế** | _(QA điền — liệt kê nhãn thực tế từng module nếu khác nhau)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | UIC-03 |
|-------|--------|
| **Loại** | UI_CONSISTENCY |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Format ngày/giờ nhất quán dd/MM/yyyy HH:mm xuyên tất cả module |
| **Module kiểm tra** | Table danh sách + form detail của Cases, Incidents, Petitions, UTDT, Activity Log |
| **Các bước kiểm thử** | 1. Mở table danh sách Cases — ghi nhận format cột ngày (ngày tạo, ngày cập nhật, deadline)<br>2. Mở detail 1 Case — ghi nhận format ngày trên form<br>3. Lặp lại cho Incidents, Petitions, UTDT<br>4. Mở Activity Log — ghi nhận format timestamp |
| **Kết quả mong đợi** | 1. Tất cả cột ngày trên table dùng format `dd/MM/yyyy` hoặc `dd/MM/yyyy HH:mm`<br>2. Không có module nào dùng format `MM/dd/yyyy` hay `yyyy-MM-dd` (ISO) hiển thị cho người dùng<br>3. Timezone hiển thị nhất quán (GMT+7 cho mọi timestamp) |
| **Kết quả thực tế** | _(QA điền — ghi format thực tế từng module nếu khác nhau)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | UIC-04 |
|-------|--------|
| **Loại** | UI_CONSISTENCY |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Confirm dialog xóa nhất quán xuyên 4 module (tiêu đề, nội dung, vị trí nút) |
| **Module kiểm tra** | Xóa Cases, Incidents, Petitions, UTDT |
| **Các bước kiểm thử** | 1. Click xóa 1 Case — quan sát confirm dialog: tiêu đề, nội dung, vị trí nút Xóa/Hủy<br>2. Lặp lại cho Incident, Petition, UTDT<br>3. So sánh 4 dialog |
| **Kết quả mong đợi** | 1. Tiêu đề dialog nhất quán (vd: "Xác nhận xóa" ở cả 4)<br>2. Nút nguy hiểm (Xóa) nhất quán vị trí — phải hoặc trái, không lẫn lộn<br>3. Màu nút nguy hiểm nhất quán (đỏ ở cả 4)<br>4. Nút Hủy nhất quán vị trí đối diện nút Xóa |
| **Kết quả thực tế** | _(QA điền — chụp screenshot 4 dialog để đối chiếu)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | UIC-05 |
|-------|--------|
| **Loại** | UI_CONSISTENCY |
| **Độ ưu tiên** | P1 |
| **Tiêu đề** | Toast notification nhất quán về vị trí, màu sắc và thời gian tự đóng |
| **Module kiểm tra** | Tạo/sửa/xóa thành công trên Cases, Incidents, Petitions, UTDT |
| **Các bước kiểm thử** | 1. Tạo Case thành công — quan sát toast: vị trí, màu nền, text, thời gian tự đóng<br>2. Xóa Case thành công — quan sát toast<br>3. Tạo Petition thành công — quan sát toast<br>4. Xóa UTDT thành công — quan sát toast |
| **Kết quả mong đợi** | 1. Tất cả toast xuất hiện cùng vị trí (vd: góc phải trên / góc phải dưới — chọn 1)<br>2. Toast thành công: cùng màu xanh lá ở 4 module<br>3. Thời gian tự đóng nhất quán (2-4 giây) — không có toast tồn tại vĩnh viễn |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | UIC-06 |
|-------|--------|
| **Loại** | UI_CONSISTENCY |
| **Độ ưu tiên** | P2 |
| **Tiêu đề** | Empty state nhất quán khi danh sách không có dữ liệu |
| **Module kiểm tra** | Danh sách Cases, Incidents, Petitions, UTDT (filter trả về 0 kết quả) |
| **Các bước kiểm thử** | 1. Áp filter không trả về kết quả nào ở trang Cases<br>2. Lặp lại ở Incidents, Petitions, UTDT |
| **Kết quả mong đợi** | 1. Tất cả 4 trang hiển thị empty state (không blank hoàn toàn)<br>2. Pattern nhất quán: cùng icon/illustration + cùng format message<br>3. Message tiếng Việt phù hợp ngữ cảnh |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

| TC-ID | UIC-07 |
|-------|--------|
| **Loại** | UI_CONSISTENCY |
| **Độ ưu tiên** | P2 |
| **Tiêu đề** | Loading state nhất quán khi API đang gọi |
| **Module kiểm tra** | Tất cả 4 trang danh sách + form submit |
| **Các bước kiểm thử** | 1. Throttle network xuống Slow 3G trong DevTools<br>2. Mở trang danh sách Cases — quan sát loading state<br>3. Lặp lại cho Incidents, Petitions, UTDT<br>4. Submit form tạo mới với mạng chậm — quan sát nút submit |
| **Kết quả mong đợi** | 1. Trang danh sách: hiển thị skeleton loader hoặc spinner nhất quán — không blank rồi bật data đột ngột<br>2. Nút submit khi loading: disabled + có visual feedback (spinner hoặc text thay đổi) ở cả 4 module<br>3. Không có module nào để user nhấn submit 2 lần khi đang load |
| **Kết quả thực tế** | _(QA điền)_ |
| **Trạng thái** | _(Đạt / Không đạt / Bị chặn)_ |

---

## Ma trận truy vết — TC System-Wide

| TC-ID | Loại | Module | Tiêu đề tóm tắt | Độ ưu tiên |
|-------|------|--------|-----------------|------------|
| SMK-01 | GREEN | API | Health check | P0 |
| SMK-02 | GREEN | Auth | Login admin | P0 |
| SMK-03 | GREEN | UI/Features | Sidebar hiển thị đủ nghiệp vụ | P0 |
| SMK-04~07 | GREEN | Cases/Incidents/Petitions/UTDT | Danh sách load không lỗi | P0 |
| SMK-08 | GREEN | KPI | Dashboard load 4 chỉ tiêu | P0 |
| SMK-09 | GREEN | Petitions | STT sinh đúng pattern | P0 |
| SMK-10 | GREEN | Notifications | Bell panel mở không lỗi | P0 |
| J01 | E2E | Petitions→Log | Petition đầy đủ vòng đời | P0 |
| J02 | E2E | Cases→Petitions | Auto-Petition + sync ngược | P0 |
| J03 | E2E | Cases→Incidents→UTDT | Chain 3 module | P0 |
| J04-A | E2E | Petitions→Cases | convertToCase thành công | P0 |
| J04-B | E2E | Petitions→Cases | convertToCase rollback khi fail | P0 |
| J08-A | SECURITY | Cases | DataScope UI: team B không thấy team A | P0 |
| J08-B | SECURITY | 4 modules | DataScope API GET cross-team | P0 |
| J08-C | SECURITY | 4 modules | DataScope API PATCH/DELETE cross-team | P0 |
| INT-01 | GREEN | Cases→Petitions | Auto-create Petition | P0 |
| INT-02 | GREEN | Cases→Petitions | Sync petitionType ngược | P0 |
| INT-03 | RED | UTDT | Từ chối UTDT caseId không tồn tại | P0 |
| INT-04 | GREEN | Petitions→Cases | Atomicity convertToCase | P0 |
| INT-05 | GREEN | Document Numbers | Số không trùng trong năm | P1 |
| INT-06 | GREEN | Journey | Timeline đúng thứ tự | P1 |
| INT-07 | GREEN | Notifications | Realtime SSE | P1 |
| UIC-01 | UI_CONSISTENCY | 4 modules | Badge color nhất quán | P1 |
| UIC-02 | UI_CONSISTENCY | 4 modules | Nhãn nút nhất quán | P1 |
| UIC-03 | UI_CONSISTENCY | 4 modules | Format ngày nhất quán | P1 |
| UIC-04 | UI_CONSISTENCY | 4 modules | Confirm dialog nhất quán | P1 |
| UIC-05 | UI_CONSISTENCY | 4 modules | Toast nhất quán | P1 |
| UIC-06 | UI_CONSISTENCY | 4 modules | Empty state nhất quán | P2 |
| UIC-07 | UI_CONSISTENCY | 4 modules | Loading state nhất quán | P2 |

**Tổng system-wide:** 29 TC mới + 500 TC feature-level = **529 TC tổng**

---

## Checklist độ phủ

| Loại | Số TC system-wide | Trạng thái | Ghi chú |
|------|-------------------|------------|---------|
| GREEN | 15 | ✅ | Smoke + integration happy paths |
| RED | 2 | ✅ | INT-03 + J04-B |
| EDGE | 0 | N/A | Covered trong feature-level UAT |
| BOUNDARY | 0 | N/A | Covered trong feature-level UAT |
| SECURITY | 3 | ✅ | J08-A/B/C — DataScope cross-team |
| DATA | 0 | N/A | Covered trong feature-level UAT |
| PERFORMANCE | 0 | N/A | Covered trong feature-level UAT |
| UI_CONSISTENCY | 7 | ✅ | UIC-01 đến UIC-07 — BẮT BUỘC |
| E2E (Journey) | 7 | ✅ | J01→J04 + J08 + INT-06 + INT-07 |
| **Tổng** | **29** | | |

---

## Tóm tắt quyết định release (UAT Sign-off)

| Tiêu chí | Ngưỡng | Thực tế | Đạt? |
|----------|--------|---------|------|
| P0 feature-level pass | 100% (255/255) | …/255 | … |
| P0 system-wide pass | 100% (17/17) | …/17 | … |
| J08 DataScope pass | 100% (3/3) | …/3 | … |
| Lỗi nghiêm trọng đang mở | 0 | … | … |
| UI_CONSISTENCY P1 pass | ≥80% (5/7 UIC) | …/7 | … |
| Smoke test pass | 100% (10/10) | …/10 | … |
| **Khuyến nghị** | | | **GO / NO-GO / GO có điều kiện** |
