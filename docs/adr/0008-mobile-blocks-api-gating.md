# ADR-0008: App mobile phải biết đọc cờ trước khi gate bất kỳ API nào

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-08-10
- **Liên quan**: PR-M1 chặn PR-E4..E6, `mobile/lib/core/api/api_client.dart:48-51`

## Bối cảnh

Yêu cầu "mọi tính năng phải có setting bật/tắt" tạo ra một nút mà admin bấm được. Ba sự thật đã kiểm chứng khiến nút đó nguy hiểm:

1. `mobile/lib` **không có một dòng nào** đọc feature flag.
2. Mobile gọi đúng những resource sắp bị gate: `/cases`, `/cases/:id`, `/incidents`, `/petitions`, `/notifications`, `/dashboard/stats`, `/settings`.
3. Interceptor `api_client.dart:48-51` chỉ xử lý 401. Guard trả 404 trần, nên lỗi rơi thẳng ra UI dưới dạng `Lỗi: DioException [bad response]... 404` (`case_detail_screen.dart:32`).
4. Không có forced-update: `pubspec.yaml` không có `package_info_plus`, không gọi `/health` để so phiên bản. **APK đã cài không có đường cứu.**

Gộp lại: admin bấm một nút trên web và làm hỏng ứng dụng đang chạy trên máy cán bộ, không rollback được từ xa.

## Quyết định

PR-M1 là điều kiện chặn cứng cho E4–E6. Nội dung:

- Guard trả mã lỗi **phân biệt được**: `{ statusCode: 404, error: 'FEATURE_DISABLED', feature: '<key>', message: '...' }` thay vì 404 trần.
- Mobile đọc `GET /feature-flags` lúc khởi động, cache lại, ẩn mục điều hướng theo cờ, và interceptor bắt `FEATURE_DISABLED` để hiện màn "Tính năng tạm tắt".
- Mobile có version gate để buộc cập nhật khi bản cài quá cũ.
- Web: `api.ts` thêm nhánh `FEATURE_DISABLED`; `FeatureFlagsContext` refetch khi tab hiện lại và sau mỗi PATCH — hiện nó chỉ fetch một lần lúc mount, nên phiên đang mở giữ cờ cũ đến khi F5.

E6 (`cases`/`incidents`/`petitions`) chỉ được merge sau khi PR-M1 lên production **và** tỷ lệ APK cũ đủ thấp.

## Hệ quả

- Việc gate API bị đẩy lùi lại sau một PR mobile. Đúng thứ tự: hạ tầng nhận cờ phải có trước công tắc.
- Cần một ngưỡng cụ thể cho "tỷ lệ APK cũ đủ thấp" — **chưa ấn định**, phải chốt trước E6.
- `FEATURE_DISABLED` trở thành một phần hợp đồng API, không chỉ là chi tiết nội bộ.

## Phương án đã cân nhắc và loại bỏ

**Gate API trước, sửa mobile sau.** Loại — thứ tự đó có một cửa sổ trong đó một cú bấm nút làm hỏng app đã cài.

**Chỉ gate những resource mobile không gọi.** Loại vì mobile gọi gần hết những cái đáng gate, và danh sách này sẽ trôi ngay khi mobile thêm màn hình.

## Điều kiện xem lại

Khi mobile đã có cơ chế đọc cờ và forced-update trên phần lớn thiết bị. Lúc đó ADR này chuyển từ "chặn" sang "đã hoàn thành điều kiện".
