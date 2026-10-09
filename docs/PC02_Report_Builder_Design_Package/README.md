# Bộ thiết kế chức năng báo cáo động PC02 — v1.0

Ngày: 09/10/2026. Phạm vi: A Thiết lập; B Nhập và tổng hợp; C Tình trạng nhập liệu.

## Thứ tự đọc
1. BRD_PC02.docx: mục tiêu, phạm vi, vai trò, quy tắc và quyết định D01–D10.
2. FRD_PC02.docx: chức năng, trạng thái UI, phân quyền và 42 tiêu chí nghiệm thu.
3. Mockup_PC02.html: mở trong trình duyệt, chọn một trong 32 màn hình; phóng to hoặc in. Các điều khiển nghiệp vụ trong hình là minh họa, không kết nối hệ thống.
4. Basic_Design_PC02.docx: kiến trúc đề xuất, mô hình dữ liệu, API và phân rã triển khai.
5. Detail_Design_PC02.docx: schema, thuật toán, giao dịch, lỗi và chiến lược kiểm thử.
6. SCREEN_SPEC.md: tương tác theo màn hình; mockups/: ảnh PNG và SVG có thể chỉnh sửa.
7. WBS.md, TRACEABILITY.csv, UAT_CASES.md và EXECUTION_CONTRACT.yaml: giao việc, truy vết và nghiệm thu.

## Trạng thái bàn giao
Thiết kế đề xuất đã hoàn thành. Đã khảo sát giao diện hệ thống theo quyền đăng nhập; chưa khảo sát mã nguồn, DB hoặc Excel mẫu thực tế. Cần đối chiếu repository, 2–3 Excel thật và chốt D01–D10 trước khi đóng thiết kế triển khai. Tên APPROVED_PLAN.md theo quy ước gói SDLC, nội dung chưa được người dùng phê duyệt. Không có kết quả UAT sản phẩm được tuyên bố đã chạy.

32 màn hình gồm setup, bốn kiểu lịch, phân công, nhập liệu, tổng hợp, mở/khóa lại, nguồn số liệu, trạng thái quản trị, lịch sử, phiên bản, xuất file, responsive và tình huống lỗi. Dữ liệu trong mockup hoàn toàn minh họa.

## Kiểm tra gói
Đã render và kiểm tra bố cục 4 Word; kiểm tra 32 mockup; validator contract báo VALID CONTRACT. Đây là kiểm tra tài liệu, không thay thế test phần mềm. Ước lượng WBS là sơ bộ, chưa ràng buộc lịch triển khai.
