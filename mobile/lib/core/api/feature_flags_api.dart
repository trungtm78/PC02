import 'package:dio/dio.dart';

/// Một cờ tính năng, đúng hình dạng `GET /feature-flags` trả về.
class FeatureFlag {
  const FeatureFlag({
    required this.key,
    required this.label,
    required this.enabled,
  });

  final String key;
  final String label;
  final bool enabled;

  factory FeatureFlag.fromJson(Map<String, dynamic> json) => FeatureFlag(
        key: json['key'] as String? ?? '',
        label: json['label'] as String? ?? '',
        enabled: json['enabled'] as bool? ?? false,
      );
}

/// PR-M1 — cờ tính năng cho ứng dụng di động.
///
/// Nạp một lần lúc khởi động rồi giữ trong bộ nhớ. Ứng dụng đã cài KHÔNG sửa
/// được bằng một lần deploy, nên nó phải tự biết phân hệ nào đang tắt thay vì
/// dẫn người dùng tới một màn hình sẽ trả 404.
///
/// **Mặc định khi chưa nạp được là BẬT, không phải tắt.** Mạng hỏng lúc khởi
/// động mà lại ẩn hết menu thì trông y như hệ thống đã bị gỡ mất chức năng —
/// một lỗi mạng tạm thời không được giả dạng thành một quyết định của quản trị.
class FeatureFlagsApi {
  FeatureFlagsApi(this._dio);

  final Dio _dio;

  Map<String, bool> _cache = const {};
  bool _loaded = false;

  bool get loaded => _loaded;

  /// Nạp cờ. Không ném: gọi lúc khởi động, hỏng thì app vẫn phải mở được.
  Future<void> load() async {
    try {
      final res = await _dio.get<dynamic>('/feature-flags');
      final body = res.data;
      final list = body is Map<String, dynamic> ? body['data'] : body;
      if (list is! List) return;

      _cache = {
        for (final item in list)
          if (item is Map<String, dynamic>)
            FeatureFlag.fromJson(item).key: FeatureFlag.fromJson(item).enabled,
      };
      _loaded = true;
    } on DioException {
      // Giữ nguyên bộ nhớ đệm cũ (nếu có). Xem ghi chú trên lớp về việc vì sao
      // không rơi về "tắt hết".
    }
  }

  /// Phân hệ này có bật không. Chưa nạp được ⇒ coi như bật.
  bool isEnabled(String key) => _cache[key] ?? true;

  /// Đánh dấu bộ nhớ đệm là cũ — gọi khi một request trả `FEATURE_DISABLED`.
  void invalidate() {
    _loaded = false;
  }
}
