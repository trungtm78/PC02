import 'feature_flags_api.dart';

/// Một mục trên thanh điều hướng: đường dẫn + cờ tính năng nó phụ thuộc.
class NavTab {
  const NavTab({required this.route, required this.featureKey});

  final String route;

  /// `null` = luôn hiện. Tổng quan và Thông báo nằm trên vỏ ứng dụng, không
  /// thuộc phân hệ nào tắt được.
  final String? featureKey;
}

/// PR-M1 — thanh điều hướng theo cờ tính năng.
///
/// Phân hệ đã tắt thì mục dẫn tới nó không được hiện: bấm vào chỉ nhận 404, và
/// trên bản đã cài thì đó là ngõ cụt — không deploy nào sửa được ứng dụng đang
/// nằm trên máy người dùng.
///
/// Lọc danh sách chứ không vô hiệu hoá từng nút: một nút xám thường trực khiến
/// người dùng nghĩ mình thiếu quyền, trong khi thật ra đơn vị chưa bật phân hệ.
const List<NavTab> kNavTabs = [
  NavTab(route: '/', featureKey: null),
  NavTab(route: '/cases', featureKey: 'cases'),
  NavTab(route: '/incidents', featureKey: 'incidents'),
  NavTab(route: '/petitions', featureKey: 'petitions'),
  NavTab(route: '/notifications', featureKey: null),
];

/// Chỉ số của các mục còn hiện, theo đúng thứ tự gốc.
///
/// Trả về CHỈ SỐ chứ không phải danh sách mới, để nơi gọi ánh xạ ngược được
/// sang mảng icon/nhãn tĩnh — một mảng song song bị lọc rời rạc là cách nhanh
/// nhất để bấm mục này lại mở màn hình kia.
List<int> visibleNavIndexes(FeatureFlagsApi flags, {List<NavTab> tabs = kNavTabs}) {
  final out = <int>[];
  for (var i = 0; i < tabs.length; i++) {
    final key = tabs[i].featureKey;
    if (key == null || flags.isEnabled(key)) out.add(i);
  }
  return out;
}
