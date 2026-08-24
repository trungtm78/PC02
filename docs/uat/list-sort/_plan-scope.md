# Nguồn chân lý (oracle) — UAT v0.72.0.0 sắp xếp danh sách

> ⚠️ **Kết quả mong đợi ở đây lấy từ KẾ HOẠCH ĐÃ DUYỆT và CHANGELOG (lời hứa với người
> dùng), KHÔNG lấy từ mã nguồn.** Mã nguồn chỉ dùng để tìm điểm neo (endpoint, tên trường,
> testid). Nếu mã làm khác điều dưới đây thì **mã sai**, không phải oracle sai.

**Nguồn:**
- Kế hoạch: `~/.claude/plans/gleaming-pondering-thacker.md` (anh duyệt qua ExitPlanMode)
- Lời hứa người dùng: `CHANGELOG.md` §0.72.0.0
- Quyết định anh chốt qua AskUserQuestion (3 câu, ghi lại trong kế hoạch)

## Quy tắc oracle

| rule_id | Quy tắc (kết quả mong đợi) | oracle_type | Nguồn |
|---|---|---|---|
| **PLAN-AC1** | Danh sách **mặc định** hiện hồ sơ **mới nhất lên đầu** | Claim | CHANGELOG §0.72 "hiện hồ sơ mới nhất lên đầu" |
| **PLAN-AC2** | "Mới nhất" tính theo **ngày tiếp nhận thật của từng loại**: Đơn thư = ngày nhận · Vụ việc = ngày tiếp nhận · Vụ án = ngày tiếp nhận. **KHÔNG** dùng ngày tạo | Claim | Anh chốt: "Ngày nhận thật của từng loại" |
| **PLAN-AC3** | Hồ sơ **không có ngày** phải nằm **CUỐI**, không được nổi lên đầu | Purpose | Kế hoạch Bước 1 "NULLS LAST" |
| **PLAN-AC4** | Thứ tự **ổn định** giữa các trang — bấm sang trang rồi quay lại không lặp/mất hồ sơ | Purpose | Kế hoạch Bước 1 "khoá phụ ổn định" |
| **PLAN-AC5** | Hồ sơ **ngày phi lý** (ngoài 1900–2100) bị **đẩy xuống cuối**, không chiếm màn hình đầu | Claim | Anh chốt: "Đẩy xuống cuối + đánh dấu" |
| **PLAN-AC6** | Ngày phi lý được **đánh dấu cảnh báo** trên giao diện để cán bộ biết mà rà | Claim | Anh chốt (cùng câu trên) |
| **PLAN-AC7** | Bấm tiêu đề cột: lần 1 **mới→cũ**, lần 2 **cũ→mới**, lần 3 **về mặc định** | Claim | CHANGELOG §0.72 |
| **PLAN-AC8** | Thứ tự **lưu trong địa chỉ trang** — tải lại trang hoặc gửi đường dẫn đều giữ nguyên | Claim | CHANGELOG §0.72 |
| **PLAN-AC9** | Đổi thứ tự → quay về **trang 1** | Purpose | Kế hoạch Bước 4 |
| **PLAN-AC10** | Cột không có ý nghĩa sắp (vd "Thao tác") **không bấm được** | Purpose | Kế hoạch Bước 4 |
| **PLAN-AC11** | Thứ tự **xuất Excel khớp** thứ tự trên màn hình | Claim | CHANGELOG §0.72 "Thứ tự khi xuất Excel nay khớp" |
| **PLAN-AC12** | Trạng thái sắp **đọc được bằng trình đọc màn hình** (`aria-sort`) | Statute | WCAG 2.2 A/AA — 4.1.2 Name/Role/Value |
| **PLAN-AC13** | Cả ba màn hình đều có **đủ hai cột ngày** (ngày tiếp nhận + ngày tạo), đều sắp được | Claim | CHANGELOG §0.72 |

## Chế độ hỏng cần phủ (failure modes)

| rule_id | Chế độ hỏng | Vì sao quan trọng |
|---|---|---|
| **PLAN-FM1** | Chiều sắp rác (`sortOrder=xyz`) → **không được** thành lỗi 500 | Trước bản vá, Đơn thư/Vụ việc không có validator; chuỗi bất kỳ đi thẳng vào Prisma |
| **PLAN-FM2** | Tên cột tuỳ tiện (`sortBy=passwordHash`) → **không** đi vào truy vấn, rơi về mặc định | Chống lộ cột nội bộ / lỗi 500 |
| **PLAN-FM3** | Truy vấn danh sách phải **dùng được chỉ mục**, không quét toàn bảng | Đơn thư 45.459 hàng; đây là lý do tồn tại của phần chỉ mục |
| **PLAN-FM4** | **Không** ghi được vào cột sinh `sortReceivedDate` | CSDL từ chối cứng; một lượt di trú lỡ ghi là hỏng cả lượt |
| **PLAN-FM5** | Đổi thứ tự **không** làm hỏng bộ lọc/tìm kiếm đang áp | Sắp và lọc phải cộng hưởng, không loại trừ |

## Quy tắc nghiệp vụ (độc lập kế hoạch)

| rule_id | Quy tắc | oracle_type | Nguồn |
|---|---|---|---|
| **DOM-1** | **Ngày tiếp nhận không được là ngày tương lai** | Purpose | Quy tắc nghiệp vụ sẵn có của hệ thống — thông báo "Ngày tiếp nhận không được là ngày tương lai" ở cả đường tạo và sửa |

## NGOÀI phạm vi (kế hoạch nêu rõ — KHÔNG test)

- Sửa dữ liệu của 3 đơn thư có ngày tương lai gần (2029-03-19, 2026-09-29, 2026-08-25) —
  anh chọn "đẩy xuống cuối + đánh dấu", KHÔNG chọn "sửa dữ liệu". Cần đối chiếu hồ sơ gốc.
- Sắp xếp cho các danh sách khác (Đối tượng, Luật sư, Tài liệu) — không nằm trong yêu cầu.
- Đổi mặc định cho ứng dụng di động một cách chủ động — xem mục dưới.

## ⚠️ Hệ quả xuyên nền tảng chưa được tuyên bố trong kế hoạch

Ứng dụng **di động Flutter** (`mobile/lib/core/api/petitions_api.dart`) gọi `/petitions`
mà **không gửi tham số sắp xếp** → nó thừa hưởng mặc định của máy chủ. Nghĩa là thứ tự
danh sách đơn thư **trên điện thoại cũng đã đổi**, dù kế hoạch không nhắc tới.

Đây là một **phát hiện của UAT**, không phải hạng mục kế hoạch: cần xác nhận thay đổi này
là mong muốn (nhiều khả năng có, vì cùng lý do), và ghi nhận rằng nó **chưa được kiểm
chứng trên thiết bị** — quy trình dựng ứng dụng di động đang hỏng sẵn.
