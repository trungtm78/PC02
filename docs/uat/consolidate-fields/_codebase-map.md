# _codebase-map.md — Bước 1: Codebase Analysis (CHỈ lấy điểm neo)

## Bức tường lửa (do người dùng chỉ đạo)
| Được lấy từ code | KHÔNG được lấy từ code |
|---|---|
| Endpoint, tên trường, testid/nhãn, lệnh chạy, danh sách trạng thái | **Kết quả mong đợi (oracle)** |
| Đo độ phức tạp làm sàn số TC | Suy luận "code làm thế nên đúng là thế" |

Oracle vẫn 100% từ `_plan-scope.md`. Code chỉ dùng để **ngắm đúng chỗ** và phát hiện **drift** (code ≠ plan) — drift là *finding cần verify ở tầng sản phẩm*, KHÔNG phải oracle.

---

## 1. Điểm neo API (`/api/v1`)

| Module | Liệt kê | Tạo | Chi tiết | Sửa | Chuyển đổi |
|---|---|---|---|---|---|
| Vụ án | `GET /cases` | `POST /cases` | `GET /cases/:id` | **`PUT /cases/:id`** | — |
| Đơn thư | `GET /petitions` | `POST /petitions` | `GET /petitions/:id` | **`PUT /petitions/:id`** | `POST /petitions/:id/convert-incident`, `POST /petitions/:id/convert-case` |
| Vụ việc | `GET /incidents` | `POST /incidents` | `GET /incidents/:id` | (PUT/PATCH `:id`) | — |

Khác: `GET /cases/stats`, `GET /petitions/stats`, `GET /incidents/stats`, `GET /:id/journey`, `GET /:id/export-readiness`.
→ **Neo cho E2E tích hợp:** chuỗi Đơn thư → Vụ việc → Vụ án đi qua `convert-incident` / `convert-case`.

## 2. Điểm neo trường form Vụ án
186 khoá form trong lớp nạp dữ liệu. Các khoá thuộc phạm vi epic đã xác nhận tồn tại: `tenCungCap`, `sinhNamCungCap`, `cccdCungCap`, `ngayCapCccd`, `noiCapCccd`, `sdtCungCap`, `reporter`, `reporterIdNumber`, `reporterDateOfBirth`, `reporterDateOfBirthPrecision`, `reporterPhone`, `reporterAddress`, `receiveDate`, `caseClassification`, `tinhTrang`, `toiDanhBanDau`, `deXuatXuLy`, `dieuTraVienText`, `nguonDon`, `nhanXet`, `biHai`, `noiXayRa`, `nghiVanDoiTuong`, `phuongThucThuDoan`, `ketQuaXuLyKhac`, `soPhieuChuyen`, `sttCu`, `soHoSoCu`, `phanLoaiToiPhamLinhVuc`, `yeuCauBoSung`, `damageAmount`, `stat_damageAmount`, `description`, `statistic`.

## 3. ⚠️ DRIFT CANDIDATES — code ≠ plan (phải verify ở TẦNG SẢN PHẨM, không kết luận từ code)

| # | Quan sát trong code | Plan nói gì | TC verify |
|---|---|---|---|
| **DRIFT-1** | `reporter`, `reporterIdNumber`, `reporterPhone`, `reporterAddress` và `tenCungCap`, `cccdCungCap`, `sdtCungCap` **cùng đọc MỘT cột** — nghĩa là 2 khoá form/1 cột | PLAN §B4: "field đã vào form chính phải gỡ khỏi parityState — **tránh 2 nguồn cùng ghi 1 cột**" | TC-018, TC-139, **TC-091b** |
| **DRIFT-2** | `sinhNamCungCap` **vẫn là khoá form riêng** đọc cột `sinhNamCungCap`, song song `reporterDateOfBirth` | PLAN §A1 hàng 3: hai ô **gộp thành một**, canonical `reporterDateOfBirth` | **TC-076b** |
| **DRIFT-3** | `stat_damageAmount` **chỉ đọc từ metadata**, không đọc cột thống kê | PLAN §A3 R1: cả ba nguồn phải đọc **CÙNG cột statistic** | TC-037, **TC-046b** |
| DRIFT-4 | Khoá form `deXuatXuLy` vẫn tồn tại (đọc cột `deXuat`) | PLAN §A2 (R): "dùng cột `deXuat`, **bỏ form-key** `deXuatXuLy`" | TC-077 |
| DRIFT-5 | `dieuTraVienText` đọc cột `dieuTraVien` | PLAN §A3 R7: giữ cả hai — **khớp plan**, không phải drift | TC-079, TC-101 |

> Quy tắc xử lý drift: **không kết luận FAIL từ code**. Một khoá form tồn tại ≠ có ô hiển thị cho người dùng. Verdict chỉ được ra sau khi quan sát **form đang chạy**.

## 4. M2 — Đo độ phức tạp (điểm quyết định)

| Tệp | Điểm quyết định | Dòng |
|---|---|---|
| `mergeCaseApiToFormData.ts` (đọc: cột → metadata → cũ) | **216** | 293 |
| `buildCreateCasePayload.ts` (ghi) | **190** | 540 |
| `backfill-consolidate.ts` (chuẩn hoá dữ liệu) | **71** | 304 |
| `cases.service.ts` | 447 | 2204 |
| `PetitionFormPage.tsx` | 210 | 1286 |
| `IncidentFormPage.tsx` | 127 | 1068 |
| `CaseFormPage/index.tsx` | 111 | 665 |
| `CaseFormPage/tabs.tsx` | 33 | 1901 |

**M2_raw (3 tệp lõi của epic) = 477.**

**Diễn giải trung thực:** 216 điểm quyết định trong 293 dòng là **mật độ nhánh cực cao** — đây chính là nơi lỗi mất dữ liệu âm thầm ẩn nấp (mỗi chuỗi `cột ?? metadata ?? giá trị cũ` là một nhánh có thể chọn sai nguồn).

Nhưng **basis-path là sàn cho tầng ĐƠN VỊ, không phải tầng UAT**: ép 477 ca ở tầng người dùng sẽ tạo ra hàng trăm ca trùng nhau về mặt nghiệp vụ (vi phạm cấm padding). Áp dụng đúng tầng:
- **Tầng đơn vị/tích hợp** gánh basis-path — dự án đã có 2875 ca kiểm thử backend + bộ frontend. UAT **kiểm chứng** rằng bộ này thực sự chạy (PLAN-V1), không thay thế nó.
- **M2_UAT** = số điểm quyết định **người dùng quan sát được** = 38 khái niệm trong phạm vi plan × 2 đường đọc (cột / dữ liệu cũ) = **76**.

| Mã | Giá trị | Ghi chú |
|---|---|---|
| M1 spec coverage | **180** | |
| M2_UAT | 76 | M2_raw 477 → báo cáo như **tín hiệu nhắm bắn**, dồn độ sâu vào F1/F2/F7 |
| M3 function points | N/A | epic refactor dữ liệu, không thêm giao dịch nghiệp vụ mới |
| M4 risk-tier CRITICAL | 120 | |
| **TC_min = MAX** | **180** | Kế hoạch 195 TC ✅ |

## 5. Lệnh chạy (plumbing)
- Backend: `cd backend && npm run start:dev` (cổng 3000) · test: `npx jest --no-coverage`
- Frontend: `cd frontend && npm run dev` (Vite, cổng 5173) · test: `npx vitest run --no-coverage` · type-check: `npm run build` (`tsc -b`)
- DB: `backend/.env` → `127.0.0.1:5432/pc02_db` *(chỉ thị toàn cục nêu PostgreSQL 18 @5433 — ghi nhận chênh lệch môi trường, không tự sửa)*
