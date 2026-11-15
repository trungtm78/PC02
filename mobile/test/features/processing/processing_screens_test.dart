import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/core/api/processing_api.dart';
import 'package:pc02_mobile/core/api/providers.dart';
import 'package:pc02_mobile/core/models/processing.dart';
import 'package:pc02_mobile/features/processing/my_work_screen.dart';
import 'package:pc02_mobile/features/processing/processing_labels.dart';
import 'package:pc02_mobile/features/processing/record_steps_section.dart';
import 'package:pc02_mobile/features/processing/step_action_screen.dart';
import 'package:pc02_mobile/shared/widgets/band_chip.dart';

typedef _ReportCall = ({
  int expectedRevision,
  String idempotencyKey,
  String reportKind,
  String doneWork,
});

typedef _ItemsCall = ({String asOf, String? band, int page});

/// A hand-written double: every call is recorded, every answer is scripted.
class FakeProcessingApi implements ProcessingApi {
  TrackingSummary? summary;
  Object? summaryError;
  int summaryCalls = 0;
  final itemsCalls = <_ItemsCall>[];
  int total = 0;
  bool itemsUnavailable = false;

  RecordFlow? flow;
  int flowCalls = 0;

  /// One entry per write, in order: a failure to throw, or `null` = success.
  final reportOutcomes = <ProcessingWriteFailure?>[];
  final reportCalls = <_ReportCall>[];
  final completeOutcomes = <ProcessingWriteFailure?>[];
  final completeKeys = <String>[];

  @override
  Future<TrackingSummary?> getMySummary() async {
    summaryCalls++;
    final error = summaryError;
    if (error != null) throw error;
    return summary;
  }

  @override
  Future<TrackingPage?> getMyItems({
    required String asOf,
    String? band,
    int page = 1,
    int pageSize = 20,
  }) async {
    itemsCalls.add((asOf: asOf, band: band, page: page));
    if (itemsUnavailable) return null;
    return TrackingPage(
      asOf: asOf,
      total: total,
      page: page,
      pageSize: pageSize,
      items: [
        TrackingItem(
          recordKind: 'PETITION',
          recordId: 'p$page',
          recordCode: '2026-0000$page',
          stepKey: 's1',
          stepName: 'Xác minh trang $page',
          band: band ?? 'RED',
          remainingDays: 1,
          dueAt: DateTime.utc(2026, 11, 16, 18, 30),
        ),
      ],
    );
  }

  @override
  Future<RecordFlow?> getRecordFlow(String kind, String recordId) async {
    flowCalls++;
    return flow;
  }

  @override
  Future<RecordFlow?> submitReport({
    required String kind,
    required String recordId,
    required String stepKey,
    required int expectedRevision,
    required String idempotencyKey,
    required String reportKind,
    required String doneWork,
    String? findings,
    String? difficulties,
  }) async {
    reportCalls.add((
      expectedRevision: expectedRevision,
      idempotencyKey: idempotencyKey,
      reportKind: reportKind,
      doneWork: doneWork,
    ));
    final failure = reportOutcomes.removeAt(0);
    if (failure != null) throw failure;
    return null;
  }

  @override
  Future<RecordFlow?> completeStep({
    required String kind,
    required String recordId,
    required String stepKey,
    required int expectedRevision,
    required String idempotencyKey,
  }) async {
    completeKeys.add(idempotencyKey);
    final failure = completeOutcomes.removeAt(0);
    if (failure != null) throw failure;
    return null;
  }
}

const _lost = ProcessingWriteFailure(ProcessingWriteFailureKind.retryable);
const _conflict = ProcessingWriteFailure(ProcessingWriteFailureKind.conflict,
    code: 'REVISION_CONFLICT');
const _refused = ProcessingWriteFailure(ProcessingWriteFailureKind.refused,
    code: 'STEP_NOT_OPEN');

const _step = RecordStep(
  stepKey: 's1',
  order: 1,
  name: 'Xác minh',
  status: 'OPEN',
  band: 'YELLOW',
  remainingDays: 3,
);

void _tallScreen(WidgetTester tester) {
  // The form is a lazy list: on the default 800x600 surface the buttons at
  // the bottom would not be built.
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

/// A page with one button that opens the step form, and shows what it popped.
Future<void> _openStepForm(WidgetTester tester, FakeProcessingApi api) async {
  _tallScreen(tester);
  await tester.pumpWidget(MaterialApp(
    home: Builder(
      builder: (context) => Scaffold(
        body: _Host(api: api),
      ),
    ),
  ));
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

class _Host extends StatefulWidget {
  final FakeProcessingApi api;
  const _Host({required this.api});

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  String _result = 'none';

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('result:$_result'),
        TextButton(
          onPressed: () async {
            final changed = await Navigator.of(context).push<bool>(
              MaterialPageRoute(
                builder: (_) => StepActionScreen(
                  api: widget.api,
                  kind: 'PETITION',
                  recordId: 'p1',
                  revision: 7,
                  step: _step,
                ),
              ),
            );
            setState(() => _result = '$changed');
          },
          child: const Text('open'),
        ),
      ],
    );
  }
}

final _doneWork = find.byKey(const Key('step-action-done-work'));
final _findings = find.byKey(const Key('step-action-findings'));
final _submit = find.byKey(const Key('step-action-submit'));
final _complete = find.byKey(const Key('step-action-complete'));
final _reload = find.byKey(const Key('step-action-reload'));

String _textOf(WidgetTester tester, Finder field) =>
    tester.widget<TextField>(field).controller!.text;

void main() {
  group('report on a step', () {
    testWidgets('work done is required: nothing is sent without it',
        (tester) async {
      final api = FakeProcessingApi();
      await _openStepForm(tester, api);

      await tester.tap(_submit);
      await tester.pumpAndSettle();

      expect(api.reportCalls, isEmpty);
      expect(find.text('Phải nhập công việc đã thực hiện'), findsOneWidget);
    });

    testWidgets(
        'a retry after a lost connection reuses the key; the text stays; '
        'success closes the form', (tester) async {
      final api = FakeProcessingApi()..reportOutcomes.addAll([_lost, _lost, null]);
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Đã gặp người tố cáo');
      await tester.enterText(_findings, 'Có căn cứ');

      await tester.tap(_submit);
      await tester.pumpAndSettle();

      expect(api.reportCalls.length, 1);
      expect(_textOf(tester, _doneWork), 'Đã gặp người tố cáo');
      expect(_textOf(tester, _findings), 'Có căn cứ');
      expect(find.byKey(const Key('step-action-message')), findsOneWidget);
      expect(_reload, findsNothing);

      await tester.tap(_submit);
      await tester.pumpAndSettle();
      await tester.tap(_submit);
      await tester.pumpAndSettle();

      expect(api.reportCalls.length, 3);
      final first = api.reportCalls[0].idempotencyKey;
      expect(first, isNotEmpty);
      expect(api.reportCalls[1].idempotencyKey, first);
      expect(api.reportCalls[2].idempotencyKey, first);
      expect(api.reportCalls[2].doneWork, 'Đã gặp người tố cáo');
      expect(api.reportCalls[2].expectedRevision, 7);
      expect(find.text('result:true'), findsOneWidget);
    });

    testWidgets('a new action gets a new key', (tester) async {
      // lost -> the same key; refused -> the attempt is over; the next tap is
      // a new action; text changed after a lost answer is a new action too.
      final api = FakeProcessingApi()
        ..reportOutcomes.addAll([_lost, _refused, _lost, _lost]);
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Lần một');

      for (var i = 0; i < 3; i++) {
        await tester.tap(_submit);
        await tester.pumpAndSettle();
      }
      await tester.enterText(_doneWork, 'Lần hai, đã sửa');
      await tester.tap(_submit);
      await tester.pumpAndSettle();

      final keys = api.reportCalls.map((c) => c.idempotencyKey).toList();
      expect(keys[1], keys[0], reason: 'retry after a lost answer');
      expect(keys[2], isNot(keys[0]), reason: 'after a definite refusal');
      expect(keys[3], isNot(keys[2]), reason: 'the content changed');
      expect(_textOf(tester, _doneWork), 'Lần hai, đã sửa');
      expect(_submit, findsOneWidget, reason: 'the form is still open');
    });

    testWidgets(
        '409: the typed text stays, sending is held until a reload, then goes '
        'out against the new revision with a new key', (tester) async {
      final api = FakeProcessingApi()
        ..reportOutcomes.addAll([_conflict, null])
        ..flow = const RecordFlow(
          recordKind: 'PETITION',
          recordId: 'p1',
          flowName: 'Tố cáo',
          revision: 9,
          steps: [_step],
        );
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Nội dung dài đã gõ');
      await tester.enterText(_findings, 'Nhận định');

      await tester.tap(_submit);
      await tester.pumpAndSettle();

      expect(_textOf(tester, _doneWork), 'Nội dung dài đã gõ');
      expect(_textOf(tester, _findings), 'Nhận định');
      expect(find.text(writeFailureMessage(_conflict)), findsOneWidget);
      expect(_reload, findsOneWidget);
      // Held: tapping send again does not hammer the stale revision.
      await tester.tap(_submit, warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(api.reportCalls.length, 1);

      await tester.tap(_reload);
      await tester.pumpAndSettle();

      expect(api.flowCalls, 1);
      expect(_textOf(tester, _doneWork), 'Nội dung dài đã gõ');
      expect(_textOf(tester, _findings), 'Nhận định');

      await tester.tap(_submit);
      await tester.pumpAndSettle();

      expect(api.reportCalls.length, 2);
      expect(api.reportCalls[1].expectedRevision, 9);
      expect(api.reportCalls[1].doneWork, 'Nội dung dài đã gõ');
      expect(api.reportCalls[1].idempotencyKey,
          isNot(api.reportCalls[0].idempotencyKey));
      expect(find.text('result:true'), findsOneWidget);
    });

    testWidgets('complete: the retry reuses its key, and keeps the typed text',
        (tester) async {
      final api = FakeProcessingApi()..completeOutcomes.addAll([_lost, null]);
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Chưa gửi');

      for (var i = 0; i < 2; i++) {
        await tester.tap(_complete);
        await tester.pumpAndSettle();
        await tester.tap(find.widgetWithText(FilledButton, 'Hoàn thành'));
        await tester.pumpAndSettle();
        if (i == 0) expect(_textOf(tester, _doneWork), 'Chưa gửi');
      }

      expect(api.completeKeys.length, 2);
      expect(api.completeKeys[1], api.completeKeys[0]);
      expect(api.reportCalls, isEmpty);
      expect(find.text('result:true'), findsOneWidget);
    });
  });

  group('Việc của tôi', () {
    Widget app(FakeProcessingApi api, Widget home) => ProviderScope(
          // A new container per pump: each case starts from nothing.
          key: UniqueKey(),
          overrides: [processingApiProvider.overrideWithValue(api)],
          child: MaterialApp(home: home),
        );

    const summary = TrackingSummary(
      asOf: '2026-11-15T03:00:00.000Z',
      counts: {'OVERDUE': 2, 'RED': 3, 'YELLOW': 0, 'GREEN': 5},
    );

    testWidgets('the list is asked at the asOf the summary answered, on every page',
        (tester) async {
      _tallScreen(tester);
      final api = FakeProcessingApi()
        ..summary = summary
        ..total = 3;
      await tester.pumpWidget(app(api, const MyWorkScreen()));
      await tester.pumpAndSettle();

      expect(api.itemsCalls.single,
          (asOf: '2026-11-15T03:00:00.000Z', band: null, page: 1));
      expect(find.textContaining('Xác minh trang 1'), findsOneWidget);
      // 18:30 UTC is 01:30 the next day in Vietnam.
      expect(find.text('Hạn: 17/11/2026 01:30'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('5'), findsOneWidget);

      await tester.tap(find.byKey(const Key('my-work-load-more')));
      await tester.pumpAndSettle();

      expect(api.itemsCalls.last,
          (asOf: '2026-11-15T03:00:00.000Z', band: null, page: 2));
      expect(find.textContaining('Xác minh trang 2'), findsOneWidget);
    });

    testWidgets('a count card filters the list by its band, at a fresh asOf',
        (tester) async {
      _tallScreen(tester);
      final api = FakeProcessingApi()
        ..summary = summary
        ..total = 3;
      await tester.pumpWidget(app(api, const MyWorkScreen()));
      await tester.pumpAndSettle();
      api.summary = const TrackingSummary(
        asOf: '2026-11-15T03:05:00.000Z',
        counts: {'OVERDUE': 2, 'RED': 3, 'YELLOW': 0, 'GREEN': 5},
      );

      await tester.tap(find.byKey(const Key('my-work-count-RED')));
      await tester.pumpAndSettle();

      expect(api.itemsCalls.last,
          (asOf: '2026-11-15T03:05:00.000Z', band: 'RED', page: 1));
    });

    testWidgets('feature off (the API answers null): no list call, no error',
        (tester) async {
      final api = FakeProcessingApi();
      await tester.pumpWidget(app(api, const MyWorkScreen()));
      await tester.pumpAndSettle();

      expect(api.itemsCalls, isEmpty);
      expect(find.text('Không thể tải dữ liệu'), findsNothing);
      expect(find.text('Chức năng này chưa được bật cho tài khoản của bạn'),
          findsOneWidget);
    });

    testWidgets('the home card shows only when the summary call succeeded',
        (tester) async {
      const card = Key('my-work-home-card');
      const home = Scaffold(body: MyWorkHomeCard());

      final off = FakeProcessingApi();
      await tester.pumpWidget(app(off, home));
      await tester.pumpAndSettle();
      expect(off.summaryCalls, 1);
      expect(find.byKey(card), findsNothing);

      final broken = FakeProcessingApi()..summaryError = StateError('500');
      await tester.pumpWidget(app(broken, home));
      await tester.pumpAndSettle();
      expect(find.byKey(card), findsNothing);
      expect(tester.takeException(), isNull);

      final on = FakeProcessingApi()..summary = summary;
      await tester.pumpWidget(app(on, home));
      await tester.pumpAndSettle();
      expect(find.byKey(card), findsOneWidget);
      expect(find.text('Quá hạn: 2'), findsOneWidget);
    });

    testWidgets('the steps of a record: hidden when off, listed when on',
        (tester) async {
      _tallScreen(tester);
      const section = Scaffold(
        body: SingleChildScrollView(
          child: RecordStepsSection(kind: 'PETITION', recordId: 'p1'),
        ),
      );

      final off = FakeProcessingApi();
      await tester.pumpWidget(app(off, section));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('record-steps-section')), findsNothing);
      expect(find.text('Không tải được các bước xử lý'), findsNothing);

      final on = FakeProcessingApi()
        ..flow = RecordFlow(
          recordKind: 'PETITION',
          recordId: 'p1',
          flowName: 'Tố cáo',
          revision: 7,
          steps: [
            RecordStep(
              stepKey: 's1',
              order: 1,
              name: 'Xác minh',
              status: 'OPEN',
              band: 'OVERDUE',
              remainingDays: -2,
              dueAt: DateTime.utc(2026, 11, 13, 10),
              parties: const [
                RecordStepParty(partyKind: 'TEAM', role: 'MAIN', teamName: 'Tổ 2'),
              ],
            ),
            const RecordStep(
              stepKey: 's2',
              order: 2,
              name: 'Kết luận',
              status: 'WAITING_ANCHOR',
              band: 'NONE',
            ),
          ],
        );
      await tester.pumpWidget(app(on, section));
      await tester.pumpAndSettle();

      expect(find.text('1. Xác minh'), findsOneWidget);
      expect(find.text('Quá hạn 2 ngày'), findsOneWidget);
      expect(find.text('Đơn vị: Tổ 2'), findsOneWidget);
      expect(find.text('Hạn: 13/11/2026 17:00'), findsOneWidget);
      expect(find.text('2. Kết luận'), findsOneWidget);
      // Only the step being worked offers the write.
      expect(find.text('Báo cáo / Hoàn thành'), findsOneWidget);
    });
  });

  group('BandChip', () {
    Widget wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

    testWidgets('a list row with an alert shows its wording and step',
        (tester) async {
      await tester.pumpWidget(wrap(BandChip.forAlert(const RecordAlert(
          source: 'FLOW', band: 'RED', remainingDays: 1, stepName: 'Xác minh'))));
      expect(find.text('Còn 1 ngày · Xác minh'), findsOneWidget);
    });

    testWidgets('no alert, or band NONE: nothing', (tester) async {
      await tester.pumpWidget(wrap(Column(children: [
        BandChip.forAlert(null),
        BandChip.forAlert(const RecordAlert(source: 'FLOW', band: 'NONE')),
      ])));
      expect(find.byType(BandChip), findsNothing);
    });

    test('the colour follows the band of the server, not the days', () {
      // Days say "plenty", the band says overdue: the band wins.
      expect(remainingLabel('OVERDUE', 5), 'Quá hạn');
      expect(remainingLabel('OVERDUE', -3), 'Quá hạn 3 ngày');
      expect(remainingLabel('GREEN', 12), 'Còn 12 ngày');
      expect(remainingLabel('RED', 0), 'Hạn hôm nay');
      expect(bandColor('OVERDUE'), isNot(bandColor('RED')));
      expect(bandColor('YELLOW'), isNot(bandColor('GREEN')));
    });
  });
}
