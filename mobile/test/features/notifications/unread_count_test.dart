import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/core/models/notification.dart';
import 'package:pc02_mobile/features/notifications/unread_count.dart';

AppNotification _n({required String id, required bool isRead}) =>
    AppNotification(
      id: id,
      title: 't',
      isRead: isRead,
      createdAt: DateTime(2026, 1, 1),
    );

void main() {
  group('unreadCount', () {
    test('empty list returns 0', () {
      expect(unreadCount(const []), 0);
    });

    test('all-read list returns 0', () {
      final list = [
        _n(id: '1', isRead: true),
        _n(id: '2', isRead: true),
      ];
      expect(unreadCount(list), 0);
    });

    test('mixed list returns count of unread only', () {
      final list = [
        _n(id: '1', isRead: false),
        _n(id: '2', isRead: true),
        _n(id: '3', isRead: false),
        _n(id: '4', isRead: false),
      ];
      expect(unreadCount(list), 3);
    });

    test('all-unread returns list length', () {
      final list = List.generate(5, (i) => _n(id: '$i', isRead: false));
      expect(unreadCount(list), 5);
    });
  });
}
