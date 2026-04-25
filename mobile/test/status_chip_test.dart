import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/shared/theme/app_theme.dart';
import 'package:pc02_mobile/shared/widgets/status_chip.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  group('StatusChip labels', () {
    test('known CaseStatus maps to Vietnamese label', () {
      // Use a testable approach — check _labels indirectly via widget text
    });

    testWidgets('TIEP_NHAN renders Tiếp nhận', (tester) async {
      await tester.pumpWidget(_wrap(const StatusChip(status: 'TIEP_NHAN')));
      expect(find.text('Tiếp nhận'), findsOneWidget);
    });

    testWidgets('QUA_HAN renders Quá hạn', (tester) async {
      await tester.pumpWidget(_wrap(const StatusChip(status: 'QUA_HAN')));
      expect(find.text('Quá hạn'), findsOneWidget);
    });

    testWidgets('KHONG_KHOI_TO renders Không khởi tố', (tester) async {
      await tester.pumpWidget(_wrap(const StatusChip(status: 'KHONG_KHOI_TO')));
      expect(find.text('Không khởi tố'), findsOneWidget);
    });

    testWidgets('DA_KET_LUAN renders Đã kết luận', (tester) async {
      await tester.pumpWidget(_wrap(const StatusChip(status: 'DA_KET_LUAN')));
      expect(find.text('Đã kết luận'), findsOneWidget);
    });

    testWidgets('unknown status falls back to raw enum key', (tester) async {
      await tester.pumpWidget(_wrap(const StatusChip(status: 'UNKNOWN_STATUS')));
      expect(find.text('UNKNOWN_STATUS'), findsOneWidget);
    });
  });

  group('StatusChip colors', () {
    testWidgets('DA_* status gets green color', (tester) async {
      await tester.pumpWidget(_wrap(const StatusChip(status: 'DA_KET_LUAN')));
      await tester.pump();
      final container = tester.widget<Container>(find.byType(Container).last);
      final decoration = container.decoration as BoxDecoration;
      expect(decoration.color, AppColors.green.withValues(alpha: 0.12));
    });

    testWidgets('QUA_HAN gets red color', (tester) async {
      await tester.pumpWidget(_wrap(const StatusChip(status: 'QUA_HAN')));
      await tester.pump();
      final container = tester.widget<Container>(find.byType(Container).last);
      final decoration = container.decoration as BoxDecoration;
      expect(decoration.color, AppColors.red.withValues(alpha: 0.12));
    });

    testWidgets('DINH_CHI gets yellow color', (tester) async {
      await tester.pumpWidget(_wrap(const StatusChip(status: 'DINH_CHI')));
      await tester.pump();
      final container = tester.widget<Container>(find.byType(Container).last);
      final decoration = container.decoration as BoxDecoration;
      expect(decoration.color, AppColors.yellow.withValues(alpha: 0.12));
    });

    testWidgets('DANG_DIEU_TRA gets navy color', (tester) async {
      await tester.pumpWidget(_wrap(const StatusChip(status: 'DANG_DIEU_TRA')));
      await tester.pump();
      final container = tester.widget<Container>(find.byType(Container).last);
      final decoration = container.decoration as BoxDecoration;
      expect(decoration.color, AppColors.navy.withValues(alpha: 0.12));
    });
  });

  group('StatusChip accessibility', () {
    testWidgets('semantics label contains localized label not enum key', (tester) async {
      await tester.pumpWidget(_wrap(const StatusChip(status: 'TIEP_NHAN')));
      await tester.pump();
      final semantics = tester.getSemantics(find.byType(StatusChip));
      expect(semantics.label, contains('Tiếp nhận'));
      expect(semantics.label, isNot(contains('TIEP_NHAN')));
    });
  });
}
