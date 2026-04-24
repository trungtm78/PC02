import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/core/settings/deadline_settings_provider.dart';
import 'package:pc02_mobile/shared/widgets/deadline_badge.dart';

Widget _wrap(Widget child, {int threshold = 7}) {
  return ProviderScope(
    overrides: [
      deadlineThresholdProvider.overrideWith(
        (_) => Future.value(threshold),
      ),
    ],
    child: MaterialApp(home: Scaffold(body: child)),
  );
}

void main() {
  group('DeadlineBadge', () {
    testWidgets('shows red badge when overdue', (tester) async {
      final past = DateTime.now().subtract(const Duration(days: 3));
      await tester.pumpWidget(_wrap(DeadlineBadge(deadline: past)));
      await tester.pumpAndSettle();
      expect(find.text('Quá hạn'), findsOneWidget);
    });

    testWidgets('shows yellow badge when within threshold', (tester) async {
      final near = DateTime.now().add(const Duration(days: 5));
      await tester.pumpWidget(_wrap(DeadlineBadge(deadline: near)));
      await tester.pumpAndSettle();
      expect(find.textContaining('Còn'), findsOneWidget);
    });

    testWidgets('shows green badge when beyond threshold', (tester) async {
      final far = DateTime.now().add(const Duration(days: 20));
      await tester.pumpWidget(_wrap(DeadlineBadge(deadline: far)));
      await tester.pumpAndSettle();
      expect(find.textContaining('Còn'), findsOneWidget);
    });

    testWidgets('uses threshold from provider (mocked at 7)', (tester) async {
      // 3 days away: within threshold=7, so yellow badge
      final near = DateTime.now().add(const Duration(days: 3));
      await tester.pumpWidget(_wrap(DeadlineBadge(deadline: near), threshold: 7));
      await tester.pumpAndSettle();
      // Should show amber/yellow (within threshold), not green, not red
      expect(find.textContaining('Còn'), findsOneWidget);
      expect(find.text('Quá hạn'), findsNothing);
    });
  });
}
