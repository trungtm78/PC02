# Ma trận vai trò — gate UAT-901

Đóng mục "role matrix được chốt" của gate M01/UAT-901 (EXECUTION_CONTRACT.yaml, UAT_CASES.md). Tự chốt theo `AUTH-0910`.

## Quyền hệ thống (role.constants.ts `ROLE_NAMES`) × quyền mới

| Role hệ thống | `read:DynamicReport` | `manage:DynamicReport` | `admin:DynamicReport` |
|---|---|---|---|
| SUPER_ADMIN | seed mặc định | seed mặc định | seed mặc định |
| ADMIN | seed mặc định | seed mặc định | seed mặc định |
| SYSTEM | seed mặc định | không | không |
| HEAD_UNIT (TRUONG_DON_VI) | seed mặc định | không mặc định (không phải người thiết lập) | không |
| INVESTIGATOR | seed mặc định | không | không |
| OFFICER | seed mặc định | không | không |
| DEADLINE_APPROVER | seed mặc định | không | không |

`read:DynamicReport` chỉ mở **menu** "Báo cáo động"; không tự cấp xem báo cáo cụ thể nào. Việc xem/nhập/quản lý một báo cáo cụ thể do `DynReportRole` (MANAGER/VIEWER) và `DynReportTargetEditor` (người nhập của tổ) quyết định, độc lập với role hệ thống (D10). `admin:DynamicReport` cho xem toàn bộ báo cáo ở chế độ chỉ đọc, huỷ chốt kỳ, miễn nộp — **không được sửa số liệu hộ** dù có quyền này.

## Vai trò trong một báo cáo (`DynReportRole` + `DynReportTargetEditor`)

| Vai trò | Cấp bởi | Có thể |
|---|---|---|
| Người thiết lập (configurer) | `manage:DynamicReport` tại thời điểm tạo/sửa báo cáo | Tạo/sửa nháp, upload, đánh dấu ô, cấu hình kỳ, phân công, xuất bản, tạo phiên bản, ngừng phát sinh |
| MANAGER | Người thiết lập gán ở bước 4 wizard (≥1) | Xem tổng hợp + từng tổ, duyệt/trả lại/huỷ duyệt, mở khoá/thu hồi, chốt kỳ, xuất Excel trong phạm vi báo cáo |
| VIEWER | Người thiết lập gán, có `teamScopeId?` tuỳ chọn | Chỉ xem tổng hợp/từng tổ trong phạm vi (hoặc toàn báo cáo nếu không giới hạn), không duyệt/mở khoá/sửa |
| Người nhập (editor của tổ) | Người thiết lập gán ở bước 4, mặc định tổ trưởng | Nhập/sửa/nộp dữ liệu của đúng tổ mình, trong hạn hoặc khi có grant |

## Tài khoản hai vai trò

Một user vừa là MANAGER của báo cáo X vừa là editor của tổ Y trong báo cáo X (hoặc báo cáo khác): có công tắc "Báo cáo tôi nhập / Báo cáo tôi quản lý" (S16). Chế độ quản lý luôn chỉ đọc; quyền ghi backend luôn tính theo `DynReportTargetEditor` thật, không theo `mode` query param gửi từ trình duyệt (AC-035).
