# Đặc tả đồng bộ Vụ việc và thanh thao tác hồ sơ

Ngày chốt: 2026-09-29
Phạm vi phát hành: Web
Môi trường đích: `https://new.pc02hcm.com/`

## Mục tiêu

Đồng bộ cách dùng và UI/UX của Vụ việc với Đơn thư, đồng thời chuẩn hóa thanh thao tác trên Đơn thư, Vụ việc, Vụ án và Ủy thác điều tra. Giữ nguyên quy tắc pháp lý riêng và hợp đồng dữ liệu của từng loại hồ sơ.

## Form và thanh thao tác

- Dùng `FormActionBar` chung, thứ tự Hủy → Tạo mới từ hồ sơ này → In chứng từ → Lưu ở đầu và cuối form khi có thanh cuối.
- Chế độ xem Vụ việc dùng chính `IncidentFormPage` với trường nhập bị khóa; vẫn cho đổi tab, mở nhóm, in và tạo hồ sơ mới nếu có quyền tạo.
- `Nguồn đơn/Đơn vị giao` của Vụ việc dùng `NGUON_DON`, tìm kiếm máy chủ và tạo nhanh.
- `Đơn vị giải quyết` dùng `DON_VI`, tìm kiếm máy chủ, tạo nhanh và giữ được tên lịch sử.
- Nhóm định danh người cung cấp tin gồm sinh năm, CCCD, ngày cấp, nơi cấp; tự mở với nguồn Trực tiếp, dữ liệu cũ hoặc lỗi. Số điện thoại ở ngoài nhóm.
- Gợi ý người cung cấp tin dùng `benVu`. Rà soát trùng dùng tên vụ việc, người cung cấp, CCCD, điện thoại, nội dung, ngày và địa điểm.

## Sao chép và lưu

- Sao chép mọi dữ liệu người dùng nhập, kể cả chuỗi rỗng, Nhận xét, Ngày viết đơn, kết quả, metadata nghiệp vụ và trường hệ cũ.
- Không sao chép ID, mã hồ sơ, trạng thái, audit, optimistic lock, xác nhận trùng, tệp, phân công, quyền sở hữu hoặc metadata hệ thống.
- Giá trị sao chép thắng giá trị mặc định; hồ sơ mới bắt đầu ở `TIEP_NHAN` và cảnh báo rà lại dữ liệu kết quả.
- POST tạo Vụ việc dùng idempotency key ổn định. Upload lỗi được thử lại trên cùng hồ sơ qua `effectiveId`.
- Cập nhật chung không được đổi phân công. Thay đổi phân công phải đi qua command và kiểm quyền điều phối.

## Danh sách và API

- Danh sách Vụ việc dùng cùng mô hình toolbar, tìm kiếm thẻ, URL filter, thống kê, cột, loading/error/empty và thao tác hàng loạt với Đơn thư.
- Bỏ tab giai đoạn trùng với thẻ thống kê.
- Mỗi dòng nhận capability `quyenGhi`; sửa nhanh kết quả dùng endpoint hẹp và optimistic lock.
- Command nghiệp vụ chịu trách nhiệm chuyển trạng thái có side effect; không dùng status PATCH chung cho khởi tố, nhập vụ khác hoặc chuyển đơn vị.
- Danh sách, thống kê và xuất file dùng cùng bộ dựng điều kiện, data scope và loại hồ sơ.

## Cổng nghiệm thu

- Full frontend/backend unit và integration suite, type-check, lint không rewrite, build và web E2E đều sạch, không warning mới.
- Patch coverage tối thiểu 90% line.
- Astra review source, API, quyền, bảo mật, migration và UI; xử lý hết finding rồi review lại.
- UAT phủ I-F01–I-F15 và I-L01–I-L15, tạo/sửa/sao chép/tìm kiếm/xuất/tải lại và các ca idempotency/upload lỗi.
- Chỉ tạo MR sau bằng chứng kiểm thử mới. Chỉ deploy web production sau CI và mọi gate xanh; smoke test production và canary trước khi xác nhận.

## Nguồn điều hành

- Protocol đầy đủ: `docs/protocols/AUTONOMOUS-EXECUTION-PROTOCOL-2026-09-29.md`
- Nhật ký thực thi: `PROGRESS.md`
