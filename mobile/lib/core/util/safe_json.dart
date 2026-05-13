/// Walks `path` through `root` and returns the leaf as a String, or null if
/// ANY of the steps fail: null intermediates, missing keys, wrong types.
///
/// Why a helper:
///   Pre-BUG-6, detail screens did `(c['investigator'] as Map)['fullName']`.
///   That cast crashes with TypeError whenever the API returns
///   `investigator: null` (no investigator assigned). This helper makes the
///   null-safety explicit and reusable — 3 detail screens + future API
///   surfaces all read nested optional fields the same way.
String? readNestedString(dynamic root, List<String> path) {
  if (path.isEmpty) return null;
  dynamic cursor = root;
  for (var i = 0; i < path.length - 1; i++) {
    if (cursor is! Map) return null;
    cursor = cursor[path[i]];
    if (cursor == null) return null;
  }
  if (cursor is! Map) return null;
  final leaf = cursor[path.last];
  return leaf is String ? leaf : null;
}
