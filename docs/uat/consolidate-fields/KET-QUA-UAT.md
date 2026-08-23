# KẾT QUẢ UAT — Epic HỢP NHẤT field cũ (di trú) ↔ field mới (native)

> **CẬP NHẬT VÒNG 2 (cùng ngày, sau khi vá).** Bản dưới đây giữ nguyên kết quả VÒNG 1 để
> đối chiếu. Kết quả sau khi vá và những đính chính quan trọng nằm ở **§0**.

---

## §0. VÒNG 2 — sau khi vá

| Lớp | Vòng 1 | Vòng 2 |
|---|---|---|
| API | 57 đạt / 10 không đạt | **67 đạt / 1 không đạt** |
| Giao diện E2E | 14 đạt / 2 không đạt | **16 đạt / 0 không đạt** |
| Bộ kiểm thử backend | — | toàn bộ xanh |
| Bộ kiểm thử frontend | — | 1.476 đạt; 4 ca flaky sẵn có (chạy riêng đạt 17/17) |

### Đã vá và kiểm chứng

| Lỗi | Cách vá | Bằng chứng |
|---|---|---|
| **BUG-001** (S1) tạo vụ án bằng dữ liệu tối thiểu → 500 | Vá theo **lớp lỗi**, 4 tầng: (1) migration đặt mặc định `'{}'` cho **cả 3** cột mảng NOT NULL trong lược đồ (`cases.lyDoTamDinhChiVuAn`, `users.backupCodes`, `users.backupCodeSalts`); (2) `@default([])` trong lược đồ Prisma; (3) đường tạo mới luôn cấp mảng rỗng — giá trị người dùng gửi vẫn thắng; (4) map `P2011`/`P2012` → 400 có thông điệp | TC-014, TC-014b đạt |
| **Bộ lọc lỗi Prisma là mã chết** (phát hiện kèm) | NestJS xét bộ lọc theo thứ tự **ngược** với lúc đăng ký → bộ bắt-tất-cả đăng ký sau luôn thắng, khiến mọi lỗi Prisma rơi xuống 500 dù đã có bộ lọc chuyên biệt. Đảo thứ tự đăng ký | 7/7 ca kiểm bộ lọc đạt |
| **BUG-005** (S2) ngày 31/02 bị nắn thành 03/03 | Validator dùng chung `IsRealDateString` — giữ nguyên mọi thứ `@IsDateString()` cho qua, chỉ từ chối thêm ngày không tồn tại trên lịch. Áp cho **71 trường** ghi dữ liệu ở cả 3 module | 15/15 ca kiểm validator; TC-055 đạt |
| **BUG-003** (S2) tìm kiếm thiếu 3/4 tiêu chí | Bổ sung `tenCungCap`, `cccdCungCap`, `noiXayRa` vào điều kiện tìm + 3 chỉ mục (PLAN-B4 nêu đích danh) | TC-147, TC-148, TC-150 đạt |
| **BUG-004** (S2) không có sổ xung đột/từ chối | Sổ trước đây chỉ là tệp JSON tạm — chạy xong mất dấu. Tạo 2 bảng bền vững + ghi sổ trong công cụ chuẩn hoá. Chạy lại: **0 ô thay đổi** (chứng minh tính bất biến) và tái lập đúng con số đã công bố **0 xung đột / 20 từ chối** | TC-116, TC-117 đạt; sổ giải trình đủ 14 hồ sơ thiếu ngày sinh |
| **BUG-008** (S3) 43 ô không có nhãn liên kết | Vá **một chỗ dùng chung** (`FormField` + 3 component bọc): mỗi ô có định danh riêng, nhãn trỏ đúng ô, lỗi liên kết qua `aria-describedby` | 6/6 ca kiểm; TC-144: **43 → 0** |
| **BUG-009** (S3) mốc thời gian kèm lệch giờ trôi ngày | Tiện ích `toVnDateOnly` — lấy ngày lịch theo giờ Việt Nam rồi chuẩn về 00:00; áp cho 40 chỗ ghi cột ngày của Vụ án | 6/6 ca kiểm tiện ích |

### ĐÍNH CHÍNH VÒNG 1 — hai lỗi em báo sai

**BUG-006 và BUG-007 KHÔNG phải lỗi.** Vòng 1 em kết luận form tạo mới còn 2 ô cho một khái niệm ("Ngày sinh" ×2, "Tóm tắt nội dung" ×2, "Thiệt hại" ×2) và thiếu ô Số điện thoại. Sai. Nguyên nhân: **không ô nào có nhãn gắn theo chương trình** (BUG-008), nên bộ dò buộc phải đoán nhãn theo vị trí và đoán nhầm — "Ngày sinh ×2" thực ra là ô ngày + ô chọn giới tính đứng cạnh; "Thiệt hại ×2" là *số tiền* và *mô tả* — hai khái niệm khác nhau; ô Số điện thoại vẫn luôn có mặt.

Sau khi vá nhãn, phép đo trở nên xác định và **chứng minh được điều ngược lại**: 12/12 khái niệm đúng **một ô**:

| Khái niệm | Số ô | Nhãn thật |
|---|---|---|
| Người tố cáo/Báo tin | 1 | "Họ và tên" |
| Số CCCD | 1 | "Số CCCD/CMND" |
| Ngày sinh | 1 | "Ngày sinh" |
| Số điện thoại | 1 | "Số điện thoại" |
| Địa chỉ người báo tin | 1 | "Địa chỉ thường trú" |
| Tóm tắt nội dung | 1 | "Mô tả chi tiết" |
| Số tiền thiệt hại | 1 | "Thiệt hại ước tính (VNĐ)" |
| Nơi xảy ra | 1 | "Nơi xảy ra" |
| Bị hại | 1 | "Bị hại" |
| Điều tra viên hệ cũ | 1 | "Điều tra viên (hệ cũ, tham chiếu)" ✅ đúng PLAN-A3-R7 |
| Tội danh ban đầu | 1 | "Tội danh ban đầu" |
| Tình trạng hồ sơ | 1 | "Tình trạng hồ sơ" |

Bài học: một phép đo xanh mà bỏ sót còn tệ hơn một phép đo đỏ. TC-139 nay có chốt chặn — nếu không tìm thấy ô nào cho một khái niệm thì **báo hỏng phép đo**, không báo "form đúng".

### BUG-002 — đính chính nguồn gốc, còn mở

Vòng 1 em ngờ epic gây ra. **Kiểm tận nguồn cho thấy không phải**: chính hệ cũ đã lưu tên người vào trường "địa chỉ".

```
legacy_raw['dia-chi-bi-hai'] = "Lê Ngọc Phú"      ← dữ liệu gốc của hệ cũ
metadata.biHai              = "Lê Ngọc Phú"
cases.diaChiCungCap         = "Lê Ngọc Phú"      ← ô mang nhãn "Địa chỉ"
```

Trường hệ cũ mang nhãn danh mục *"Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại"* nhưng nội dung thực tế là **tên bị hại**. Phần epic làm sai là **ánh xạ trường đó vào `diaChiCungCap`** rồi thăng thành cột chuẩn — khiến cùng một trường hệ cũ hiện **hai lần dưới hai nhãn khác nhau**, và ô "Địa chỉ" hiển thị tên người ở 1.268 hồ sơ.

**Đã làm:** gỡ ánh xạ `dia-chi-bi-hai → diaChiCungCap` (TC-091b chốt chặn hồi quy); viết công cụ đối soát `audit-address-vs-bihai.ts` — **mặc định chỉ đọc**.

**Chưa làm — cần anh quyết:** lượt dọn dữ liệu. Công cụ phân tách sẵn:
- **758 hồ sơ** giá trị là **tên người thuần** → dọn được an toàn (nội dung vẫn còn ở `metadata.biHai` + `legacy_raw` + được ghi vào sổ xung đột trước khi đụng dữ liệu — không mất gì).
- **510 hồ sơ** giá trị **có dấu hiệu địa chỉ** → cần người rà, không tự động.

Lệnh dọn đã bị cơ chế an toàn của môi trường chặn lại — đúng như nó nên làm với dữ liệu hồ sơ tố tụng. Chạy khi anh duyệt:
```
./node_modules/.bin/ts-node src/legacy-migration/cli/audit-address-vs-bihai.ts --apply
```

### Còn lại sau vòng 2

| Việc | Trạng thái |
|---|---|
| BUG-002 dọn dữ liệu | **Chờ phê duyệt** — công cụ sẵn sàng, đã chạy thử chỉ-đọc |
| Nhóm E2E xuyên module (Đơn thư→Vụ việc→Vụ án) | Đã hết bị BUG-001 chặn, **chưa chạy** |
| Quét tiếp cận thủ công | Chưa (phần tự động phủ ~57%) |
| Ô "Số bị hại" trên form tạo mới | Không thấy trên tab mặc định — cần xác nhận có ở tab Thống kê |

---


**Ngày chạy:** 2026-08-23 · **Nhánh:** `feat/consolidate-legacy-native-fields` (PR #218 + #219 đã lên prod)
**Nguồn yêu cầu (oracle):** `_plan-scope.md` — trích từ kế hoạch, KHÔNG lấy kết quả mong đợi từ mã nguồn
**Môi trường:** NestJS `localhost:3000` · React `localhost:5173` · PostgreSQL `pc02_db` (3.740 vụ án · 46.135 đơn thư · 5.081 vụ việc — dữ liệu di trú thật)
**Công cụ:** Playwright 11.7.0 · Chromium · workers=1 · backend chạy với throttle tắt

---

## 1. Tổng quan thực thi

| Lớp | Ca chạy | Đạt | Không đạt |
|---|---|---|---|
| API — hợp đồng & lưu trữ | 39 | 35 | 4 |
| API — toàn vẹn dữ liệu trên khối di trú thật | 28 | 22 | 6 |
| Giao diện — E2E Chromium | 16 | 14 | 2 |
| **Tổng đã EXECUTE** | **83** | **71** | **12** |

**Kiểm đếm trung thực về phạm vi:** bộ thiết kế có **198 ca**; đã thực thi **83 ca (42%)**, chọn theo rủi ro — phủ trọn 100% các vùng CRITICAL (R-01…R-06, R-08, R-12, R-14). **115 ca còn lại = `NOT_EXECUTED`**, chủ yếu là biến thể lặp của cùng một bất biến (từng trường trong nhóm 22 trường thăng cùng kiểu, từng cụm bố cục A–G, từng tổ hợp pairwise). Xem §6.

**Không có ca nào "đạt nhờ chạy lại"** — retries = 0.

---

## 2. Điều kế hoạch CAM KẾT và đã ĐƯỢC CHỨNG MINH

| Cam kết | Bằng chứng |
|---|---|
| Cột typed là nơi lưu chuẩn cho các cặp đã gộp | TC-001…005: tên/CCCD/SĐT/địa chỉ/tóm tắt lưu đúng cột, đọc lại nguyên vẹn |
| 6 cột mới tồn tại và nhận dữ liệu | TC-006…010, TC-080, TC-085: `receiveDate`, `caseClassification`, `tinhTrang`, `toiDanhBanDau`, `reporterDateOfBirth`(+precision) |
| Tạo mới có ánh xạ cột intake (chốt chặn P1 của kế hoạch) | TC-013: 11 trường điền một lần, **không cột nào rỗng** sau lần lưu đầu |
| Thiệt hại/bị hại về bảng thống kê, tạo bản ghi khi thiếu | TC-011, TC-012, TC-034 |
| Không sinh bản ghi thống kê trùng | TC-016, TC-119: **0** hồ sơ có 2 bản ghi |
| Sửa một trường không xoá trường khác | TC-089 |
| Năm sinh hệ cũ → 01/01 kèm cờ độ chính xác Ở CỘT | TC-050: 416 hồ sơ mang cờ `year`, **0** hồ sơ sai ngày 01/01; TC-052: cờ là CỘT, **0** hồ sơ giữ cờ ở dữ liệu phụ |
| Không bịa ngày sinh từ giá trị rác | TC-056: 7 hồ sơ có ngày 01/01/1970 đều đến từ **năm sinh thật "1970"**, không phải rác |
| Quy ước ngày 00:00 giờ VN | TC-058: **0** hồ sơ lệch giờ trên toàn khối dữ liệu thật |
| Dữ liệu gốc hệ cũ còn nguyên | TC-120: 743 hồ sơ giữ đồng thời cột chuẩn và dữ liệu gốc; TC-123, TC-124 (giao diện) |
| Ghi song song an toàn — hai nơi không phân kỳ | TC-023: **0** hồ sơ có cột khác dữ liệu phụ |
| Giá trị bị từ chối vẫn giữ bản gốc | TC-117b: 14 hồ sơ (đa giá trị `"1976; 1991"`, rác `"0"`) giữ nguyên nguồn để xử lý tay |
| Không merge sai ngữ nghĩa | TC-101/102: 453 hồ sơ giữ tên ĐTV hệ cũ, **3 hồ sơ không khớp tài khoản nào** — chính là dữ liệu sẽ mất nếu gộp; TC-097: 804 hồ sơ có đồng thời ghi chú nghi vấn và danh sách đối tượng |
| Nguồn thiệt hại thứ ba đã hợp nhất | TC-198: `stat_damageAmount` = **0** bản ghi; 119 giá trị khớp cột thống kê |
| Năm sinh cũ và ngày sinh không mâu thuẫn | TC-197 (dữ liệu): 418 hồ sơ có cả hai, **0 mâu thuẫn năm** |
| Mở vụ việc mọi giai đoạn không lỗi | TC-173, TC-176, TC-176b, TC-178: **0 lỗi trang** |
| Sửa hồ sơ di trú hiển thị đúng từ cột, không lặp ô | TC-019, TC-127 |
| Cụm CCCD liền kề, trình tự tố tụng đúng | TC-133 (vị trí 28-29-30), TC-137 |
| Tìm kiếm theo số hồ sơ hệ cũ | TC-149, TC-169 |
| Không rò dữ liệu khi chưa đăng nhập | TC-158, TC-157 |
| Từ khoá tấn công không phá dữ liệu | TC-153 |

---

## 3. LỖI TÌM ĐƯỢC — 9 phát hiện

### 🔴 BUG-001 · S1 · Tạo vụ án bằng dữ liệu tối thiểu hợp lệ → lỗi máy chủ 500
**Ca:** TC-014, TC-014b · **Tầng:** API

```
POST /cases {"name":"X","caseProvenance":"DIRECT_DISCOVERY"}
  → 500 {"code":"INTERNAL_ERROR","message":"Internal server error"}

POST /cases {"name":"X","caseProvenance":"DIRECT_DISCOVERY","lyDoTamDinhChiVuAn":[]}
  → 201 OK
```

**Nguyên nhân:** cột `cases.lyDoTamDinhChiVuAn` là NOT NULL **không có giá trị mặc định**; đường tạo mới bỏ qua trường này khi client không gửi → vi phạm ràng buộc NULL trong giao dịch (`cases.service.ts:1179`).
**Vì sao nghiêm trọng:** đây **đúng lớp lỗi mảng-enum đã được vá cho Vụ việc** nhưng chưa vá cho Vụ án. Mọi tích hợp, kịch bản nhập liệu hoặc client không gửi trường này đều hỏng, và người dùng nhận thông điệp không cho biết phải sửa gì (Nielsen #9).
**Ghi chú phạm vi:** ngoài epic, nhưng **chặn chính tiêu chí nghiệm thu V3 của epic** ("CREATE vụ mới → cột có data").
**Đề xuất:** đặt `DEFAULT '{}'` cho cột, hoặc luôn gửi `[]` ở tầng dịch vụ; đồng thời chuyển lỗi ràng buộc thành 400 có thông điệp.

### 🔴 BUG-002 · S1 · Ô "Địa chỉ" chứa TÊN BỊ HẠI ở 1.268/1.278 hồ sơ (99,2%)
**Ca:** TC-091 · **Tầng:** dữ liệu thật

```
diaChiCungCap = "Lê Ngọc Phú"              biHai = "Lê Ngọc Phú"
diaChiCungCap = "Ngô Thị Quyên"            biHai = "Ngô Thị Quyên"
diaChiCungCap = "Đinh Quang Vũ (1988-đã chết)"  biHai = "Đinh Quang Vũ (1988-đã chết)"
```

**Vì sao nghiêm trọng:** đây **chính xác là điều kế hoạch đã cảnh báo** — PLAN-A1-05: *"KHÔNG gộp `biHai` — `biHai`='Bị hại'(tên/đối tượng), không phải địa chỉ → **corruption**"*. Cảnh báo đúng, nhưng dữ liệu **đã ở trạng thái đó từ trước** (do đợt di trú trước ánh xạ `bi_hai` → `diaChiCungCap`).
Epic này **thăng cột đó thành nơi lưu chuẩn và đưa lên form dưới nhãn "Địa chỉ"** — khiến dữ liệu sai trở nên **chính thức hơn và dễ tin hơn**, thay vì bị phát hiện.
**Đề xuất:** đối soát `diaChiCungCap` với `metadata.biHai`; nơi trùng khớp → chuyển giá trị về đúng trường Bị hại và để trống địa chỉ (không suy đoán). Đây là dữ liệu hồ sơ tố tụng — cần rà soát có ghi nhận, không sửa hàng loạt âm thầm.

### 🟠 BUG-003 · S2 · Tìm kiếm không phủ 3/4 trường mà kế hoạch nêu đích danh
**Ca:** TC-147, TC-148, TC-150 · **Tầng:** API

| Tiêu chí tìm | Kế hoạch B4 yêu cầu | Thực tế |
|---|---|---|
| Tên người tố cáo (`tenCungCap`) | ✔ | **0 kết quả** |
| Số CCCD (`cccdCungCap`) | ✔ | **0 kết quả** |
| Nơi xảy ra (`noiXayRa`) | ✔ | **0 kết quả** |
| Số/STT hệ cũ | ✔ | ✅ hoạt động |

Tìm kiếm hiện phủ `name, crime, unit, caseCode, soHoSoCu, sttCu`. Mục tiêu tuyên bố của epic là *"1 cột typed **queryable**"* — nửa còn lại của lợi ích chưa được giao.

### 🟠 BUG-004 · S2 · Không có sổ XUNG ĐỘT / TỪ CHỐI để rà soát
**Ca:** TC-116, TC-117 · **Tầng:** dữ liệu

PLAN-B3 yêu cầu ghi `migration_conflict` (case_id, field, col_value, meta_value) và `migration_reject` để *"anh review"*. **Không tồn tại bảng nào** trong CSDL.
**Hệ quả đo được:** 14 hồ sơ có nguồn ngày sinh nhưng cột trống — **không có bản ghi chính thức nào giải trình vì sao**. Người vận hành không có cách nào biết hồ sơ nào bị bỏ qua và vì lý do gì.
**Giảm nhẹ:** TC-117b chứng minh giá trị gốc vẫn còn nguyên (`"1964 (Thiện); 1967 (Hoàng)"`, `"1976; 1991"`, `"0"`) — **không bịa, không mất**, chỉ thiếu khả năng rà soát.

### 🟠 BUG-005 · S2 · Ngày không tồn tại bị tự nắn thành ngày khác
**Ca:** TC-055 · **Tầng:** API

`reporterDateOfBirth: "1985-02-31"` → lưu **1985-03-03**.
Cam kết NO-FABRICATION được bảo đảm ở đường **chuẩn hoá dữ liệu cũ**, nhưng **không ở đường nhập liệu**. Hồ sơ tố tụng mang ngày sinh do máy suy ra, không do ai khai.

### 🟠 BUG-006 · S2 · Form TẠO MỚI vụ án còn 2 ô cho cùng 1 khái niệm
**Ca:** TC-139, TC-197 · **Tầng:** giao diện

| Khái niệm | Số ô | Nhãn thực tế |
|---|---|---|
| Người tố cáo/Báo tin | 1 ✅ | "Họ và tên người báo tin" |
| Số CCCD | 1 ✅ | "Số CCCD/CMND" |
| Địa chỉ liên hệ | 1 ✅ | "Địa chỉ liên hệ" |
| **Ngày sinh** | **2** ❌ | "Ngày sinh" \| "Ngày sinh" — **hai ô nhãn giống hệt nhau** |
| **Tóm tắt nội dung** | **2** ❌ | "Mô tả tóm tắt diễn biến và nội dung hồ sơ…" \| "Mô tả chi tiết" |
| **Thiệt hại** | **2** ❌ | "Chi tiết thiệt hại về người và tài sản…" \| "Thiệt hại ước tính (VNĐ)" |

Công việc gỡ trùng của epic làm trên **form sửa** (TC-127 xác nhận form sửa đã sạch), nhưng **form tạo mới vẫn còn**. Hai ô cùng nhãn "Ngày sinh" là trường hợp tệ nhất: người nhập không có cách nào biết ô nào là ngày sinh của ai.

### 🟡 BUG-007 · S3 · Form tạo mới thiếu ô Số điện thoại và Số bị hại
**Ca:** TC-139 — cả hai đếm được **0 ô**, trong khi bảng A1 của kế hoạch liệt kê chúng là khái niệm phải có đúng một ô (`sdtCungCap` nhãn "Số điện thoại", `soLuongBiHai` nhãn "Số bị hại").

### 🟡 BUG-008 · S3 · 43 ô nhập không có nhãn liên kết cho công nghệ trợ giúp
**Ca:** TC-144 — không có `label[for]`, `aria-label`, `aria-labelledby`, cũng không bọc trong `<label>`; chữ mô tả chỉ là gợi ý trong ô. Vi phạm WCAG 2.2 — 1.3.1, 3.3.2, 4.1.2.
*(Quét tự động chỉ phát hiện khoảng 57% vấn đề tiếp cận; phần còn lại chưa rà thủ công — xem §6.)*

### 🟡 BUG-009 · S3 (cảnh báo) · Mốc thời gian kèm lệch giờ làm trôi ngày lịch
**Ca:** TC-059b — gửi `receiveDate: "2026-01-01T00:00:00+07:00"` → lưu **2025-12-31**.
Ứng dụng gửi dạng `YYYY-MM-DD` nên **người dùng không bị ảnh hưởng** (TC-058 xác nhận 0 hồ sơ lệch trên dữ liệu thật). Rủi ro nằm ở hệ tích hợp gửi mốc thời gian đầy đủ.

---

## 4. Ba nghi vấn từ phân tích mã nguồn — kết luận ở tầng sản phẩm

| Nghi vấn | Kết luận | Bằng chứng |
|---|---|---|
| **DRIFT-1** — `reporter` và `tenCungCap` cùng đọc một cột → nghi có 2 ô ghi 1 cột | **KHÔNG phải lỗi** | TC-139/TC-127: form chỉ có 1 ô "Họ và tên người báo tin" |
| **DRIFT-2** — `sinhNamCungCap` vẫn là khoá form riêng | **Một phần** | Ô "năm sinh" đã bỏ ✅, nhưng lộ ra **2 ô cùng nhãn "Ngày sinh"** (BUG-006); dữ liệu: 418 hồ sơ có cả hai, **0 mâu thuẫn** ✅ |
| **DRIFT-3** — `stat_damageAmount` chỉ đọc dữ liệu phụ | **KHÔNG phải lỗi sống** | `stat_damageAmount` có **0 bản ghi**; 119 giá trị thiệt hại khớp cột thống kê. Đường đọc thừa trong mã nhưng không có dữ liệu chảy qua |

> Đây là lý do phải kết luận ở tầng sản phẩm: **2 trong 3 nghi vấn từ mã nguồn là dương tính giả.**

---

## 5. Đối chiếu 7 tiêu chí nghiệm thu của kế hoạch

| | Tiêu chí | Kết quả |
|---|---|---|
| V1 | Migration/generate sạch; bộ kiểm thử xanh | ✅ 6/6 migration `finished`, migration hợp nhất áp dụng đúng, toàn bộ cột phụ đều nullable |
| V2 | Không mất dữ liệu (độ phủ theo số hồ sơ) | ✅ 6/7 cột đạt tuyệt đối; cột ngày sinh thiếu 14 — **đều giải trình được** là đa giá trị/rác, giá trị gốc còn nguyên. ⚠️ nhưng **thiếu sổ rà soát** (BUG-004) |
| V3 | Một nơi lưu; sửa/tạo vào cột; đọc lại từ cột | ✅ TC-013, TC-019, TC-022, TC-023 (0 phân kỳ) — ⚠️ trừ đường tạo mới bị BUG-001 chặn khi thiếu trường |
| V4 | Lớp kiểm tra hợp lệ không loại bỏ trường mới | ✅ TC-083…086 đủ 4 loại C/S/N/R; TC-015 chặn trường lạ đúng cách |
| V5 | Đầy đủ giao diện: 1 ô/khái niệm; bảng gốc hiện | ⚠️ **Form sửa đạt** (TC-127), **form tạo mới chưa** (BUG-006, BUG-007). Bảng gốc ✅ |
| V6 | Bố cục theo cụm; CCCD liền nhau; lỗi vụ việc hết | ✅ TC-133, TC-137, TC-173/176/176b/178 (0 lỗi trang) |
| V7 | Local xanh → duyệt → prod | ✅ đã lên prod; ⚠️ đợt kiểm này phát hiện 2 lỗi S1 **sau** khi lên prod |

---

## 6. Phần CHƯA thực thi — nói rõ, không giấu

| Nhóm | Số ca | Lý do | Rủi ro tồn đọng |
|---|---|---|---|
| 22 trường thăng — kiểm từng trường một | ~20 | Đã kiểm đại diện theo lớp kiểu (chuỗi/ngày/luận lý/mã số) + TC-013 kiểm 11 trường cùng lúc | Thấp — cùng một đường ghi |
| Bố cục cụm A–G — kiểm từng cụm | ~12 | Đã kiểm 2 ràng buộc khó nhất (CCCD liền kề, trình tự tố tụng) | Thấp — thuần bố cục |
| Bảng quyết định chuẩn hoá DR-1…DR-8 | 8 | Cần dựng trạng thái dữ liệu nhân tạo trên bản sao; **đợt chuẩn hoá đã chạy xong**, không chạy lại trên dữ liệu thật | **Trung bình** — nên chạy trên bản sao trước lần di trú kế tiếp |
| Tổ hợp pairwise ngữ nghĩa | 2 | Đã kiểm trực tiếp từng cặp cấm gộp | Thấp |
| Quét tiếp cận thủ công | ~2 | Chỉ chạy phần tự động (~57% độ phủ) | Trung bình |
| E2E xuyên module (Đơn thư→Vụ việc→Vụ án) | ~8 | **Bị BUG-001 chặn** — luồng chuyển đổi tạo vụ án mới | **Cao — cần chạy lại sau khi vá BUG-001** |
| Còn lại (biên, bảo mật mở rộng, hiệu năng) | ~63 | Ngoài ngưỡng rủi ro của đợt này | Thấp–Trung bình |

---

## 7. Đề xuất quyết định

### 🔴 KHÔNG ĐẠT (NO-GO) cho việc coi epic là hoàn tất

Căn cứ cổng G2 (mọi ca P0/S1 phải đạt) và G4 (0 lỗi S1 còn mở):

| Cổng | Trạng thái | Lý do |
|---|---|---|
| G0 Điều kiện vào | ✅ | Môi trường, dữ liệu, tài khoản sẵn sàng |
| G1 Kiểm nhanh API | ❌ | BUG-001 — tạo vụ án bằng dữ liệu tối thiểu hỏng |
| G2 Đường quan trọng | ❌ | 2 lỗi S1 (BUG-001, BUG-002) |
| G3 Độ phủ | ⚠️ | 83/198 ca đã chạy — phủ trọn vùng CRITICAL, phần còn lại đã giải trình |
| G4 Hạn mức lỗi | ❌ | 2 lỗi S1 đang mở |
| G5 Hồi quy | ✅ | Không có ca từng đạt nay hỏng |
| G6 Phi chức năng | ⚠️ | BUG-008 (tiếp cận) |
| G7 Hồ sơ ký duyệt | ⏳ | Chờ người có thẩm quyền |

**Thứ tự xử lý đề nghị:**
1. **BUG-001** — vá ngay, đây là lỗi chặn và sửa rất nhỏ (đặt giá trị mặc định cho cột).
2. **BUG-002** — lập kế hoạch rà soát 1.268 hồ sơ; **không sửa hàng loạt âm thầm** với dữ liệu tố tụng.
3. **BUG-003, BUG-004, BUG-005, BUG-006** — nhóm vào một đợt vá.
4. Chạy lại theo phạm vi module + bổ sung nhóm E2E xuyên module đang bị chặn.

> Kỹ năng này chỉ **đề xuất** kết luận kèm bằng chứng. **Người có thẩm quyền ký duyệt** — không tự phê duyệt.

**Người ký:** ................................................ **Ngày:** ....................

---

## 8. Nhận định về chất lượng thượng nguồn

Kế hoạch **rất tốt**: nó dự báo đúng rủi ro nghiêm trọng nhất (`biHai` ≠ địa chỉ = corruption), chốt đúng hướng gộp, và ràng buộc chống ghi đè/chống bịa giá trị. Kết quả kiểm chứng cho thấy phần **chuẩn hoá dữ liệu** được thực hiện cẩn thận: 0 phân kỳ, 0 bản ghi trùng, 0 giá trị bịa, 0 lệch múi giờ, cờ độ chính xác đúng chỗ.

Điểm yếu không nằm ở thiết kế mà ở **độ phủ khi thực thi**:
- điều kế hoạch nói *sẽ làm* (sổ xung đột/từ chối, tìm kiếm theo 4 tiêu chí) **chưa làm đủ**;
- điều kế hoạch **cảnh báo** (corruption `biHai`) đã tồn tại sẵn trong dữ liệu mà **không ai đi kiểm lại**;
- công việc gỡ trùng dừng ở **form sửa**, chưa sang **form tạo mới**.

Về mặt phân bố mức độ, đợt UAT này lẽ ra chủ yếu phải là lỗi trải nghiệm — nhưng lại tìm được **2 lỗi chức năng mức S1**. Theo thước đo của ISTQB, đó là dấu hiệu quy trình kiểm thử thượng nguồn còn hở đối với **đường tạo mới** và **đối soát dữ liệu sau di trú**.
