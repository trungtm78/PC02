# Sổ phủ (Coverage Ledger) — UAT v0.72.0.0 sắp xếp danh sách

> Liệt kê MỌI hạng mục cần phủ **TRƯỚC** khi viết ca kiểm. Độ phủ được **tính từ bảng**,
> không tự nhận. Hạng mục chưa phủ = dòng GAP có lý do.

## Sàn tối thiểu `TC_min` — lấy MAX của 4 cách đo

| Mã | Cách tính | Số |
|---|---|---|
| **M1** | Hạng mục phủ theo đặc tả: 13 AC×2 = 26 · 5 chế độ hỏng = 5 · phân hoạch (3 module × {có ngày, rỗng, phi lý}) = 9 · biên (ranh giới 1900/2100, ±1 ngày) = 4 · bảng quyết định (3 nhịp bấm × cột đang/không sắp) = 6 · chuyển trạng thái sắp (mặc định→giảm→tăng→mặc định + đổi cột) = 5 | **55** |
| **M2** | ΣV(G) hàm dưới test: `buildListOrderBy` V(G)≈7 (3 nhánh điều kiện + alias + nulls + tiebreak) · `resolveNextSort` V(G)=4 · `isImplausibleDate` V(G)=4 · `useListSort.onSort` V(G)=3 | **18** |
| **M3** | Function Points ước ~9 (3 màn × {đổi mặc định, bấm sắp, cột mới}) → ceil(9^1.2) | **14** |
| **M4** | Risk-tier **STANDARD** (đổi thứ tự hiển thị; không đụng quyền, không đụng nội dung hồ sơ, có thể đảo ngược bằng 1 commit) | **50** |

→ **`TC_min = MAX(55, 18, 14, 50) = 55`**

**Vì sao tier STANDARD chứ không CRITICAL:** thay đổi không sửa/xoá dữ liệu hồ sơ (cột sinh
chỉ ĐỌC từ cột gốc), không đụng phân quyền hay phạm vi dữ liệu, và đảo ngược được. Rủi ro
cao nhất là *cán bộ không tìm thấy hồ sơ ở vị trí quen thuộc* — nghiêm trọng về trải nghiệm
chứ không mất mát.

## Bảng phủ

### A. Thứ tự mặc định (PLAN-AC1, AC2)

| cov_id | Hạng mục | TC | rule_ref |
|---|---|---|---|
| COV-DEF-01 | Đơn thư: mặc định mới→cũ theo ngày nhận | TC-001 | PLAN-AC1/AC2 |
| COV-DEF-02 | Vụ việc: mặc định mới→cũ theo ngày tiếp nhận | TC-002 | PLAN-AC1/AC2 |
| COV-DEF-03 | Vụ án: mặc định mới→cũ theo ngày tiếp nhận | TC-003 | PLAN-AC1/AC2 |
| COV-DEF-04 | Mặc định KHÔNG dùng ngày tạo (chứng minh phủ định) | TC-004 | PLAN-AC2 |
| COV-DEF-05 | UTDT (dùng chung endpoint Vụ án) cũng theo thứ tự mới | TC-005 | PLAN-AC2 |

### B. Hồ sơ rỗng và ngày phi lý (PLAN-AC3, AC5, AC6)

| cov_id | Hạng mục | TC | rule_ref |
|---|---|---|---|
| COV-NULL-01 | Vụ việc: hồ sơ không có ngày nằm CUỐI, không nổi đầu | TC-006 | PLAN-AC3 |
| COV-NULL-02 | Vụ án: hồ sơ không có ngày nằm CUỐI | TC-007 | PLAN-AC3 |
| COV-NULL-03 | Đảo chiều tăng dần: hồ sơ rỗng VẪN ở cuối | TC-008 | PLAN-AC3 |
| COV-BAD-01 | Đơn thư: hồ sơ năm 3023/2925/0225 KHÔNG ở màn hình đầu | TC-009 | PLAN-AC5 |
| COV-BAD-02 | Hồ sơ ngày phi lý vẫn TỒN TẠI (bị đẩy cuối, không bị giấu/xoá) | TC-010 | PLAN-AC5 |
| COV-BAD-03 | Giao diện đánh dấu cảnh báo cho ngày phi lý | TC-011 | PLAN-AC6 |
| COV-BAD-04 | Ngày hợp lệ KHÔNG bị đánh dấu nhầm | TC-012 | PLAN-AC6 |

### C. Biên khoảng hợp lý (BVA — 1900/2100)

| cov_id | Hạng mục (3-value) | TC | rule_ref |
|---|---|---|---|
| COV-BVA-01 | 1899-12-31 → phi lý | TC-013 | PLAN-AC5 |
| COV-BVA-02 | 1900-01-01 → hợp lệ (biên dưới, bao gồm) | TC-014 | PLAN-AC5 |
| COV-BVA-03 | 2099-12-31 → hợp lệ | TC-015 | PLAN-AC5 |
| COV-BVA-04 | 2100-01-01 → phi lý (biên trên, loại trừ) | TC-016 | PLAN-AC5 |
| COV-BVA-05 | Biên đánh giá cùng múi giờ giữa CSDL và trình duyệt | TC-017 | PLAN-AC6 |

### D. Bấm cột để sắp (PLAN-AC7, AC10, AC12)

| cov_id | Hạng mục | TC | rule_ref |
|---|---|---|---|
| COV-CLICK-01 | Nhịp 1: cột chưa sắp → giảm dần | TC-018 | PLAN-AC7 |
| COV-CLICK-02 | Nhịp 2: bấm lại → tăng dần | TC-019 | PLAN-AC7 |
| COV-CLICK-03 | Nhịp 3: bấm lần nữa → về mặc định | TC-020 | PLAN-AC7 |
| COV-CLICK-04 | Đổi sang cột khác → bắt đầu lại bằng giảm dần | TC-021 | PLAN-AC7 |
| COV-CLICK-05 | Cột "Thao tác" KHÔNG bấm được | TC-022 | PLAN-AC10 |
| COV-CLICK-06 | `aria-sort` đúng: descending / ascending / none | TC-023 | PLAN-AC12 |
| COV-CLICK-07 | Danh sách THẬT SỰ nạp lại khi bấm (không chỉ đổi URL) | TC-024 | PLAN-AC7 |

### E. Giữ thứ tự qua địa chỉ trang (PLAN-AC8, AC9)

| cov_id | Hạng mục | TC | rule_ref |
|---|---|---|---|
| COV-URL-01 | Bấm sắp → địa chỉ trang mang tham số | TC-025 | PLAN-AC8 |
| COV-URL-02 | Tải lại trang (F5) → giữ nguyên thứ tự | TC-026 | PLAN-AC8 |
| COV-URL-03 | Mở đường dẫn có tham số ở phiên mới → đúng thứ tự | TC-027 | PLAN-AC8 |
| COV-URL-04 | Đổi thứ tự khi đang ở trang 7 → về trang 1 | TC-028 | PLAN-AC9 |
| COV-URL-05 | Hai danh sách trên cùng trang không giẫm tham số nhau | TC-029 | PLAN-AC8 |

### F. Phân trang ổn định (PLAN-AC4)

| cov_id | Hạng mục | TC | rule_ref |
|---|---|---|---|
| COV-PAGE-01 | Trang 1 và trang 2 không có hồ sơ trùng | TC-030 | PLAN-AC4 |
| COV-PAGE-02 | Sang trang 10 rồi về trang 1 → danh sách không đổi | TC-031 | PLAN-AC4 |
| COV-PAGE-03 | Nhiều hồ sơ TRÙNG ngày vẫn có thứ tự xác định | TC-032 | PLAN-AC4 |
| COV-PAGE-04 | Tổng số hồ sơ duyệt qua mọi trang = tổng đếm được | TC-033 | PLAN-AC4 |

### G. Cột hiển thị (PLAN-AC13)

| cov_id | Hạng mục | TC | rule_ref |
|---|---|---|---|
| COV-COL-01 | Đơn thư có đủ cột "Ngày nhận" + "Ngày tạo" | TC-034 | PLAN-AC13 |
| COV-COL-02 | Vụ việc có đủ "Ngày tiếp nhận" + "Ngày tạo" | TC-035 | PLAN-AC13 |
| COV-COL-03 | Vụ án có đủ "Ngày tiếp nhận" + "Ngày tạo" | TC-036 | PLAN-AC13 |
| COV-COL-04 | API trả về trường ngày tiếp nhận cho Vụ án | TC-037 | PLAN-AC13 |

### H. Chế độ hỏng / bảo mật (PLAN-FM1..FM5)

| cov_id | Hạng mục | TC | rule_ref |
|---|---|---|---|
| COV-FM-01 | `sortOrder=xyz` → không 500, rơi về giảm dần | TC-038 | PLAN-FM1 |
| COV-FM-02 | `sortOrder` rỗng / thiếu → không 500 | TC-039 | PLAN-FM1 |
| COV-FM-03 | `sortBy=passwordHash` → không 500, không lộ, rơi mặc định | TC-040 | PLAN-FM2 |
| COV-FM-04 | `sortBy` với chuỗi SQL → không 500, không thực thi | TC-041 | PLAN-FM2 |
| COV-FM-05 | `sortBy=sortReceivedDate` (cột nội bộ) → không gọi thẳng được | TC-042 | PLAN-FM2 |
| COV-FM-06 | Truy vấn danh sách dùng chỉ mục, không quét toàn bảng | TC-043 | PLAN-FM3 |
| COV-FM-07 | Không ghi được vào cột sinh | TC-044 | PLAN-FM4 |
| COV-FM-08 | Sắp + lọc trạng thái cùng lúc → cả hai đều đúng | TC-045 | PLAN-FM5 |
| COV-FM-09 | Sắp + tìm kiếm cùng lúc → cả hai đều đúng | TC-046 | PLAN-FM5 |

### I. Nhất quán xuất file (PLAN-AC11)

| cov_id | Hạng mục | TC | rule_ref |
|---|---|---|---|
| COV-EXP-01 | Thứ tự xuất Excel Đơn thư khớp màn hình | TC-047 | PLAN-AC11 |
| COV-EXP-02 | Thứ tự xuất Vụ án khớp màn hình | TC-048 | PLAN-AC11 |
| COV-EXP-03 | Thứ tự xuất Vụ việc khớp màn hình | TC-049 | PLAN-AC11 |

### J. Hành trình người dùng đầu-cuối (E2E — BẮT BUỘC)

| cov_id | Hành trình × Vai | TC | rule_ref |
|---|---|---|---|
| COV-E2E-01 | Cán bộ mở Đơn thư → thấy hồ sơ mới nhất đầu tiên | TC-050 | PLAN-AC1 |
| COV-E2E-02 | Cán bộ bấm cột đổi thứ tự → danh sách đổi thật | TC-051 | PLAN-AC7 |
| COV-E2E-03 | Cán bộ tải lại trang → thứ tự giữ nguyên | TC-052 | PLAN-AC8 |
| COV-E2E-04 | Cán bộ mở Vụ việc và Vụ án → cùng hành vi | TC-053 | PLAN-AC1 |

### K. Trải nghiệm & tiếp cận (UX / A11Y)

| cov_id | Hạng mục | TC | rule_ref |
|---|---|---|---|
| COV-UX-01 | Cột bấm được có dấu hiệu nhìn thấy (mũi tên mờ) — Nielsen #6 nhận ra thay vì nhớ | TC-054 | Nielsen 10 |
| COV-UX-02 | Cột đang sắp hiện rõ chiều (mũi tên lên/xuống) — Nielsen #1 hiện trạng hệ thống | TC-055 | Nielsen 10 |
| COV-UX-03 | Cột "Ngày tạo" có chú giải vì sao mọi dòng cùng ngày — Nielsen #10 trợ giúp | TC-056 | Nielsen 10 |
| COV-UX-04 | Ngày phi lý có chú thích nói rõ phải làm gì | TC-057 | Nielsen #9 giúp nhận ra & khắc phục lỗi |
| COV-UX-05 | Vùng bấm tiêu đề đủ lớn (WCAG 2.2 target size 24px) | TC-058 | WCAG 2.2 AA 2.5.8 |
| COV-UX-06 | Điều hướng bằng bàn phím tới được nút sắp, có viền focus | TC-059 | WCAG 2.2 A 2.1.1 + 2.4.7 |

### L. Nền tảng di động

| cov_id | Hạng mục | TC | Trạng thái |
|---|---|---|---|
| COV-MOB-01 | Danh sách đơn thư trên điện thoại theo thứ tự mới | — | **GAP — NOT_EXECUTED (blocked)**: quy trình dựng Flutter hỏng sẵn (action bị ghim SHA không tồn tại, đỏ từ 2026-08-14 trên mọi nhánh). Đã ghi trong `_platform.json` kèm cách khắc phục. Rủi ro thấp: cùng endpoint, cùng dữ liệu, không gửi tham số sắp riêng. |

### GAP có lý do (không phủ, giải trình)

| Hạng mục | Vì sao không phủ |
|---|---|
| Sửa 3 hồ sơ ngày tương lai gần | Anh chọn "đẩy xuống cuối + đánh dấu", KHÔNG chọn "sửa dữ liệu". Sửa đúng cần đối chiếu hồ sơ gốc — ngoài khả năng của máy. |
| Sắp xếp cho Đối tượng / Luật sư / Tài liệu | Ngoài phạm vi yêu cầu; các danh sách này không dùng `ListPageShell.Table`. |
| Đo hiệu năng dưới tải đồng thời | Thay đổi làm truy vấn NHANH HƠN (chuyển từ cột không chỉ mục sang cột có chỉ mục). Đo tải không tăng khả năng bắt lỗi. |
| Tương thích đa trình duyệt | Không dùng API trình duyệt mới nào; `aria-sort` và `<button>` là chuẩn phổ quát. |

## Tổng kết độ phủ

| Nhóm | Hạng mục | Đã phủ | % |
|---|---|---|---|
| A Thứ tự mặc định | 5 | 5 | 100% |
| B Rỗng & phi lý | 7 | 7 | 100% |
| C Biên | 5 | 5 | 100% |
| D Bấm cột | 7 | 7 | 100% |
| E Địa chỉ trang | 5 | 5 | 100% |
| F Phân trang | 4 | 4 | 100% |
| G Cột hiển thị | 4 | 4 | 100% |
| H Chế độ hỏng | 9 | 9 | 100% |
| I Xuất file | 3 | 3 | 100% |
| J E2E | 4 | 4 | 100% |
| K UX/A11Y | 6 | 6 | 100% |
| L Di động | 1 | 0 | **0% — GAP có lý do** |
| **TỔNG** | **60** | **59** | **98,3%** |

**Số ca kiểm: 59** ≥ `TC_min` **55** ✅ — đạt bằng độ phủ thật, không chèn ca cho đủ số.

## Đặc tính ISO 25010 áp dụng

| Đặc tính | Phủ | Ghi chú |
|---|---|---|
| Functional correctness | ✅ nhóm A–G | thứ tự đúng theo quy tắc |
| Reliability | ✅ nhóm F | phân trang ổn định, không lặp/mất |
| Performance efficiency | ✅ COV-FM-06 | dùng chỉ mục, không quét bảng |
| Security | ✅ COV-FM-03..05 | không lộ cột nội bộ, không tiêm |
| Usability | ✅ nhóm K | Nielsen + hiện trạng hệ thống |
| Compatibility | N/A | không dùng API trình duyệt mới |
| Maintainability | N/A | không phải đặc tính quan sát được ở tầng UAT |
| Portability | N/A | không đổi hạ tầng triển khai |
| Safety | N/A | không có chức năng gây hại vật lý |
