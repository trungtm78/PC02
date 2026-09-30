# Rà soát trùng khi tạo và sửa đơn thư

## Luồng sử dụng

- Biểu mẫu tạo và sửa hiển thị thao tác **Rà soát trùng** ở đầu form. Hệ thống so tên người gửi, CCCD và số điện thoại trong phạm vi hồ sơ người dùng được xem; loại trừ chính hồ sơ đang sửa.
- Kết quả hiển thị STT, tên, mức độ và lý do. Bấm STT mở popup có STT, tên, ngày tiếp nhận, tóm tắt và lý do; đóng popup quay lại form đang nhập.
- Danh sách kết quả có nút **Thu nhỏ** và **Mở lại**. Xác nhận đã rà soát tự thu nhỏ danh sách và hiện hướng dẫn tiếp tục nhập hoặc lưu.
- Khi bấm lưu, hệ thống rà soát lại. Ứng viên trùng mạnh cần được xác nhận; nếu có ứng viên mới, form ở lại để người dùng kiểm tra. Máy chủ áp dụng cùng quy tắc khi nhận yêu cầu tạo hoặc cập nhật và ghi nhận mã ứng viên đã xác nhận trong nhật ký.

## Điều kiện trùng và phạm vi

- Trùng mạnh khi CCCD khớp, hoặc số điện thoại và tên cùng khớp. Trùng tên hoặc số điện thoại đơn lẻ là gợi ý cần xem, không chặn lưu.
- API rà soát yêu cầu quyền xem Đơn thư, giới hạn tần suất, chỉ trả tối đa các ứng viên trong phạm vi dữ liệu hiện hành. Tìm ứng viên theo CCCD/số điện thoại và tên bằng hai truy vấn để hồ sơ cũ khớp định danh không bị che bởi nhiều hồ sơ trùng tên mới hơn.
- STT, tên, ngày tiếp nhận và tóm tắt chỉ hiển thị trong popup; không rời form nên dữ liệu chưa lưu được giữ nguyên.

## Kiểm thử

- API: quyền và phạm vi, loại trừ hồ sơ hiện tại, lý do và mức trùng, chặn tạo/sửa khi chưa xác nhận.
- UI: mở popup từ STT, đóng/thu nhỏ/mở lại, giữ dữ liệu form, chặn rồi cho lưu sau xác nhận, cả tạo mới và chỉnh sửa.
