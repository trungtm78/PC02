import 'package:dio/dio.dart';

/// WIRE FORMAT — phải khớp `FEATURE_DISABLED_ERROR` trong
/// `backend/src/feature-flags/guards/feature-flag.guard.ts`.
///
/// Bản đã cài trên máy người dùng mang theo bản sao của chuỗi này. Đổi tên ở
/// backend là mọi APK cũ lặng lẽ quay về hiện 404 thô — không có deploy nào cứu
/// được, vì lỗi nằm trong ứng dụng đã cài.
const String kFeatureDisabledError = 'FEATURE_DISABLED';

/// Một phân hệ bị tắt, đọc từ thân lỗi 404 của backend.
class FeatureDisabled {
  const FeatureDisabled({required this.feature, required this.message});

  final String feature;
  final String message;
}

/// Đọc `DioException` xem có phải "tính năng đang tắt" không.
///
/// Backend giữ mã 404 có chủ ý — mã riêng sẽ giúp người ngoài dò được phân hệ
/// nào đang tắt — nên chỉ có THÂN lỗi phân biệt được "tính năng tắt" với "không
/// tìm thấy bản ghi". Không đọc thân thì màn hình chi tiết hiện
/// `Lỗi: DioException ... 404` cho một cán bộ không làm gì sai.
///
/// Nhận BA hình dạng, và hình dạng thứ ba mới là hình dạng máy chủ THẬT trả về:
///
///  1. phẳng — `{ error: 'FEATURE_DISABLED', feature, message }`, đúng thứ
///     `FeatureFlagGuard` ném ra;
///  2. lồng dưới `message` — một dạng Nest có thể sinh;
///  3. **bọc bởi `GlobalExceptionFilter`** — `{ error: { code:
///     'FEATURE_DISABLED', message } }`. Filter bọc MỌI `HttpException`, nên mã
///     phẳng ở (1) trở thành `error.code`.
///
/// Trước đây chỉ nhận (1) và (2), nên app **chưa bao giờ** nhận diện được tính
/// năng bị tắt: nó luôn hiện lỗi chung. Không ai thấy vì gate cờ chưa bao giờ
/// chạy (ADR-0018) — sửa gate xong mới lộ ra hợp đồng hai đầu không khớp.
FeatureDisabled? readFeatureDisabled(DioException err) {
  if (err.response?.statusCode != 404) return null;
  final data = err.response?.data;
  if (data is! Map) return null;

  Map? holder;
  if (data['error'] == kFeatureDisabledError) {
    holder = data;
  } else {
    final nested = data['message'];
    if (nested is Map && nested['error'] == kFeatureDisabledError) {
      holder = nested;
    } else {
      // Dạng bọc bởi `GlobalExceptionFilter` — dạng thật trên dây.
      final wrapped = data['error'];
      if (wrapped is Map && wrapped['code'] == kFeatureDisabledError) {
        holder = wrapped;
      }
    }
  }
  if (holder == null) return null;

  return FeatureDisabled(
    feature: holder['feature'] as String? ?? '',
    message: holder['message'] as String? ?? 'Tính năng hiện đang tắt',
  );
}
