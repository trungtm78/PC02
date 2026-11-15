import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/core/fcm/notification_router.dart';

void main() {
  group('NotificationRouter.resolve()', () {
    test('a petition link opens the petition on its steps', () {
      expect(
        NotificationRouter.resolve('/petitions/p1?tab=phan-cong-xu-ly'),
        '/petitions/p1?tab=phan-cong-xu-ly',
      );
    });

    test('an incident link opens the incident on its steps', () {
      expect(
        NotificationRouter.resolve('/incidents/i-2?tab=phan-cong-xu-ly'),
        '/incidents/i-2?tab=phan-cong-xu-ly',
      );
    });

    test('a case link drops the /edit of the web and keeps the steps', () {
      expect(
        NotificationRouter.resolve('/cases/c3/edit?tab=phan-cong-xu-ly'),
        '/cases/c3?tab=phan-cong-xu-ly',
      );
    });

    test('a link without the steps tab still opens the record', () {
      expect(NotificationRouter.resolve('/cases/c3'), '/cases/c3');
      expect(NotificationRouter.resolve('/cases/c3/edit'), '/cases/c3');
      expect(NotificationRouter.resolve('/petitions/p1?tab=khac'),
          '/petitions/p1');
      expect(NotificationRouter.resolve('/notifications'), '/notifications');
    });

    test('a malformed link opens nothing', () {
      for (final link in <Object?>[
        null,
        42,
        '',
        '   ',
        'petitions/p1',
        '/petitions/',
        '/petitions//edit',
        '/petitions/p1/steps/s1/unknown',
        '/cases/c3/delete?tab=phan-cong-xu-ly',
        '/settings/processing-flows',
        '//evil.example/petitions/p1',
        'https://evil.example/petitions/p1?tab=phan-cong-xu-ly',
        'javascript:alert(1)',
      ]) {
        expect(NotificationRouter.resolve(link), isNull, reason: '$link');
      }
    });

    test('an id is passed on encoded, never as a second path', () {
      expect(NotificationRouter.resolve('/petitions/a%2Fb'),
          '/petitions/a%2Fb');
    });
  });
}
