# UAT Checklist — PC02 Case Management

**Phiên bản:** v0.8.0.0+  
**Đối tượng:** Cán bộ UAT (Điều tra viên / Tổ trưởng)  
**Thời gian ước tính:** 45–60 phút/release  
**Mục đích:** Sign-off nghiệp vụ trước khi merge lên production. Chạy trên staging URL (Render Preview Branch hoặc `staging` branch) với commit SHA cụ thể.

**SDLC flow:**
```
feat/* branch → CI: cd backend && npm test → Deploy to staging → Chạy checklist này → Điền PR template → Merge main → Health check
```

---

## Chuẩn bị tài khoản

Dùng tài khoản test được tạo sẵn trong team password manager:

| Tài khoản | Role | Dùng cho |
|-----------|------|---------|
| `uat_test_dtvien` | Điều tra viên | BAC-001 đến BAC-006, BAC-009, BAC-010, BAC-011 |
| `uat_test_totruong` | Tổ trưởng (cùng tổ) | BAC-007 (khi implement xong Optimistic Locking) |

**Lần đầu setup** (developer thực hiện một lần):
- Tạo `uat_test_dtvien`: `POST /admin/users` với role `DIEU_TRA_VIEN`, gán vào tổ UAT
- Tạo `uat_test_totruong`: `POST /admin/users` với role `TO_TRUONG`, cùng tổ với `uat_test_dtvien`

**Trước mỗi lần UAT — cleanup dữ liệu cũ:**
- Vào `/admin/cases` và xóa các hồ sơ test từ lần UAT trước, hoặc
- Nhờ developer chạy `prisma studio` để cleanup

---

## Kiểm tra môi trường (bắt buộc trước khi bắt đầu)

- [ ] Backend healthy: `GET /api/v1/health` → status 200
- [ ] Đăng nhập bằng `uat_test_dtvien` → sidebar hiển thị đầy đủ menu (không blank)
- [ ] Ghi lại: **Staging URL:** ___________________ | **Commit SHA:** ___________________

---

## Nhóm 1: Hồ sơ Vụ án

- [ ] **BAC-001:** Tạo hồ sơ mới với đủ trường bắt buộc → hồ sơ hiện đúng trạng thái ban đầu ("Tiếp nhận"), audit log có entry tạo hồ sơ

- [ ] **BAC-002:** Dùng hồ sơ từ BAC-001. Cập nhật thông tin (ví dụ: mô tả, ngày tháng) và lưu → dữ liệu tồn tại đúng sau F5 reload

- [ ] **BAC-003:** Dùng hồ sơ từ BAC-001 (đang ở trạng thái "Tiếp nhận"). Chuyển sang "Xác minh" → status badge cập nhật đúng

- [ ] **BAC-004:** Dùng hồ sơ từ BAC-001. Thử chuyển thẳng sang "Kết quả" (bỏ qua bước Xác minh) → hệ thống block, hiển thị lỗi rõ ràng cho người dùng

---

## Nhóm 2: Deadline và KPI

- [ ] **BAC-005:** Tạo 3 hồ sơ test riêng biệt:
  - Hồ sơ A: deadline trong **3 ngày tới** → badge màu đỏ
  - Hồ sơ B: deadline trong **7 ngày tới** → badge màu vàng *(ngưỡng CANH_BAO_SAP_HAN mặc định = 7 ngày — xác nhận trong SystemSetting nếu đã thay đổi)*
  - Hồ sơ C: deadline xa hơn 7 ngày → badge màu xanh

- [ ] **BAC-006:** Kiểm tra KPI dashboard:
  - Ghi lại số **Thụ lý** trên dashboard TRƯỚC khi tạo hồ sơ BAC-001
  - Sau khi tạo BAC-001: số Thụ lý tăng thêm **1**
  - Sau khi chuyển trạng thái BAC-003 (Tiếp nhận → Xác minh): số Giải quyết chưa tăng (hồ sơ chưa kết thúc)
  - Verify 4 chỉ tiêu TT28 nhất quán với hành động vừa thực hiện

---

## Nhóm 3: Multi-user (Concurrency)

- [ ] **BAC-007:** *(DEFERRED — skip nếu tính năng Optimistic Locking chưa được implement. Ghi "DEFERRED — TODOS CONC-001" trong PR description)*

  Khi đã implement: Yêu cầu 2 thiết bị hoặc 2 trình duyệt khác nhau (Chrome + Firefox incognito) với `uat_test_dtvien` và `uat_test_totruong`.
  - User A mở hồ sơ và sửa một trường (CHƯA lưu)
  - User B mở cùng hồ sơ đó từ bản cũ và lưu trước → thành công
  - User A nhấn lưu sau → hệ thống hiển thị cảnh báo "Hồ sơ đã thay đổi. Vui lòng tải lại." (KHÔNG overwrite silently)
  - Audit log ghi đúng thứ tự: chỉ có một lần ghi từ User B

---

## Nhóm 4: Đơn thư và Vụ việc

- [ ] **BAC-009:** Tạo Đơn thư mới → STT tự sinh đúng định dạng `DT-YYYY-NNNNN` (ví dụ: `DT-2026-00001`), trạng thái ban đầu đúng

- [ ] **BAC-010:** Tạo Vụ việc mới → trạng thái ban đầu đúng, deadline tự tính theo SystemSetting (theo BLTTHS Điều 147-149)

---

## Nhóm 5: Phân quyền

- [ ] **BAC-011:** Đăng nhập bằng `uat_test_dtvien`. Xác nhận không thấy hồ sơ/đơn thư/vụ việc của tổ khác — DataScope đang enforce đúng cho cả 3 resource types (Cases, Petitions, Incidents)

---

## Kết quả tổng hợp

| Scenario | PASS / FAIL / DEFERRED | Ghi chú |
|----------|------------------------|---------|
| BAC-001 | | |
| BAC-002 | | |
| BAC-003 | | |
| BAC-004 | | |
| BAC-005 | | |
| BAC-006 | | |
| BAC-007 | DEFERRED — TODOS CONC-001 | Chờ Optimistic Locking |
| BAC-009 | | |
| BAC-010 | | |
| BAC-011 | | |

**Kết quả chung: PASS / FAIL**

---

## Ghi chú thêm (nếu có FAIL)

Mô tả scenario bị fail, behavior thực tế vs expected, có blocking merge không:

```
Scenario: 
Behavior thực tế: 
Expected: 
Blocking: yes / no
```

---

*Checklist version: v1.0 — cập nhật file này khi thêm/bỏ scenario.*
