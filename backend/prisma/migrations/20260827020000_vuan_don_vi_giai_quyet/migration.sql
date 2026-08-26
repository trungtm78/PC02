-- Vụ án: cột chữ "Đơn vị giải quyết" y như cán bộ nhìn thấy bên hệ cũ.
--
-- Đo trên máy chạy 27/08/2026: 3.286 vụ án có chữ ấy trong dữ liệu cũ, trong khi bảng `cases`
-- không có cột nào nhận — Đơn thư và Vụ việc thì đã có cột này từ trước. `assignedTeamId` giữ
-- id tổ do bộ nạp phân giải từ chính chuỗi ấy, nhưng phân giải là suy đoán còn chữ gốc là
-- chứng cứ, và 144 vụ án không phân giải ra tổ nào.
--
-- Additive, nullable, không chỉ mục: không khoá bảng, không đổi hành vi bản ghi đang có.
ALTER TABLE "cases" ADD COLUMN "donViGiaiQuyet" TEXT;
