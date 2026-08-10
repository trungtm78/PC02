import 'package:dio/dio.dart';

/// Kết quả kiểm phiên bản tối thiểu.
class VersionGateResult {
  const VersionGateResult({
    required this.mustUpdate,
    required this.minVersion,
    required this.currentVersion,
  });

  final bool mustUpdate;
  final String? minVersion;
  final String currentVersion;
}

/// So sánh phiên bản dạng `1.2.3`, thiếu phần thì coi là 0.
///
/// Trả <0 nếu a < b. So từng đoạn theo SỐ, không theo chuỗi: `"0.10.0"` phải
/// lớn hơn `"0.9.0"`, mà so chuỗi thì ngược lại — và bản vá sẽ không bao giờ
/// được nhắc cập nhật.
int compareVersions(String a, String b) {
  final pa = a.split('.');
  final pb = b.split('.');
  final len = pa.length > pb.length ? pa.length : pb.length;
  for (var i = 0; i < len; i++) {
    final na = i < pa.length ? int.tryParse(pa[i]) ?? 0 : 0;
    final nb = i < pb.length ? int.tryParse(pb[i]) ?? 0 : 0;
    if (na != nb) return na - nb;
  }
  return 0;
}

/// PR-M1 — chốt chặn phiên bản tối thiểu.
///
/// **Đây là thứ duy nhất cứu được APK đã cài.** Khi gate API bật, một bản cũ
/// không hiểu `FEATURE_DISABLED` sẽ hiện lỗi thô cho người dùng, và không có
/// deploy nào sửa được ứng dụng đã nằm trên máy họ. Chốt chặn này biến tình
/// huống đó thành một màn hình nói rõ "hãy cập nhật", tức là còn một đường ra.
///
/// Không nạp được thì **cho đi tiếp**: máy chủ không trả lời không phải lý do
/// khoá người dùng ra khỏi ứng dụng.
class VersionGate {
  VersionGate(this._dio, {required this.currentVersion});

  final Dio _dio;
  final String currentVersion;

  Future<VersionGateResult> check() async {
    try {
      final res = await _dio.get<dynamic>('/health');
      final body = res.data;
      final map = body is Map<String, dynamic> ? body : const {};
      final min = (map['minMobileVersion'] ?? map['minAppVersion']) as String?;
      if (min == null || min.isEmpty) {
        return VersionGateResult(
          mustUpdate: false,
          minVersion: null,
          currentVersion: currentVersion,
        );
      }
      return VersionGateResult(
        mustUpdate: compareVersions(currentVersion, min) < 0,
        minVersion: min,
        currentVersion: currentVersion,
      );
    } on DioException {
      return VersionGateResult(
        mustUpdate: false,
        minVersion: null,
        currentVersion: currentVersion,
      );
    }
  }
}
