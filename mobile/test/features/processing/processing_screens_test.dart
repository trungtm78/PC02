import 'dart:async';
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

typedef _CompleteCall = ({int expectedRevision, String idempotencyKey});

typedef _ItemsCall = ({String asOf, String? band, int page});

/// A hand-written double: every call is recorded, every answer is scripted.
class FakeProcessingApi implements ProcessingApi {
  TrackingSummary? summary;
  Object? summaryError;
  int summaryCalls = 0;
  final itemsCalls = <_ItemsCall>[];
  int total = 0;
  bool itemsUnavailable = false;

  /// `true`: every list call waits until the test completes its gate, so the
  /// test decides the order the answers arrive in.
  bool manualItems = false;
  final itemsGates = <Completer<void>>[];

  RecordFlow? flow;
  Object? flowError;
  int flowCalls = 0;

  /// One entry per write, in order: a failure to throw, or `null` = success.
  final reportOutcomes = <ProcessingWriteFailure?>[];
  final reportCalls = <_ReportCall>[];
  final completeOutcomes = <ProcessingWriteFailure?>[];
  final completeCalls = <_CompleteCall>[];

  /// When set, a report does not answer until the test completes it.
  Completer<void>? reportGate;

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
    if (manualItems) {
      final gate = Completer<void>();
      itemsGates.add(gate);
      await gate.future;
    }
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
          stepName: 'Xác minh trang $page ${band ?? 'ALL'}',
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
    final error = flowError;
    if (error != null) throw error;
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
    final gate = reportGate;
    if (gate != null) await gate.future;
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
    completeCalls.add(
        (expectedRevision: expectedRevision, idempotencyKey: idempotencyKey));
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

const _flowAt9 = RecordFlow(
  recordKind: 'PETITION',
  recordId: 'p1',
  flowName: 'Tố cáo',
  revision: 9,
  steps: [_step],
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
    home: Scaffold(body: _Host(api: api)),
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
final _difficulties = find.byKey(const Key('step-action-difficulties'));
final _submit = find.byKey(const Key('step-action-submit'));
final _complete = find.byKey(const Key('step-action-complete'));
final _reload = find.byKey(const Key('step-action-reload'));
final _retry = find.byKey(const Key('step-action-retry'));

String _textOf(WidgetTester tester, Finder field) =>
    tester.widget<TextField>(field).controller!.text;

bool _readOnly(WidgetTester tester, Finder field) =>
    tester.widget<TextField>(field).readOnly;

Future<void> _tap(WidgetTester tester, Finder target) async {
  await tester.tap(target, warnIfMissed: false);
  await tester.pumpAndSettle();
}

void main() {
  group('report on a step', () {
    testWidgets('work done is required: nothing is sent without it',
        (tester) async {
      final api = FakeProcessingApi();
      await _openStepForm(tester, api);

      await _tap(tester, _submit);

      expect(api.reportCalls, isEmpty);
      expect(find.text('Phải nhập công việc đã thực hiện'), findsOneWidget);
    });

    testWidgets(
        'a retry after a lost connection sends the same request with the same '
        'key; the text stays; success closes the form', (tester) async {
      final api = FakeProcessingApi()
        ..reportOutcomes.addAll([_lost, _lost, null]);
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Đã gặp người tố cáo');
      await tester.enterText(_findings, 'Có căn cứ');

      await _tap(tester, _submit);

      expect(api.reportCalls.length, 1);
      expect(_textOf(tester, _doneWork), 'Đã gặp người tố cáo');
      expect(_textOf(tester, _findings), 'Có căn cứ');
      expect(find.byKey(const Key('step-action-message')), findsOneWidget);
      expect(_reload, findsNothing);
      expect(_retry, findsOneWidget);

      await _tap(tester, _retry);
      await _tap(tester, _retry);

      expect(api.reportCalls.length, 3);
      expect(api.reportCalls[0].idempotencyKey, isNotEmpty);
      expect(api.reportCalls[1], api.reportCalls[0]);
      expect(api.reportCalls[2], api.reportCalls[0]);
      expect(api.reportCalls[2].doneWork, 'Đã gặp người tố cáo');
      expect(api.reportCalls[2].expectedRevision, 7);
      expect(find.text('result:true'), findsOneWidget);
    });

    testWidgets(
        'a write whose outcome is unknown cannot be bypassed or re-keyed: '
        'no other write goes out, the draft is frozen, the retry is the very '
        'same request', (tester) async {
      // The report reached the server but its answer was lost. Completing
      // the step now would move the revision; a re-keyed report after that
      // would be written a second time.
      final api = FakeProcessingApi()..reportOutcomes.addAll([_lost, null]);
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Đã xác minh');

      await _tap(tester, _submit);

      // Neither a second report nor Complete can go around the pending one.
      await _tap(tester, _submit);
      await _tap(tester, _complete);
      expect(find.widgetWithText(FilledButton, 'Hoàn thành'), findsNothing);
      expect(api.reportCalls.length, 1);
      expect(api.completeCalls, isEmpty);
      // The draft cannot drift away from what was sent.
      expect(_readOnly(tester, _doneWork), isTrue);
      expect(_readOnly(tester, _findings), isTrue);
      expect(_readOnly(tester, _difficulties), isTrue);

      await _tap(tester, _retry);

      expect(api.reportCalls.length, 2);
      expect(api.reportCalls[1], api.reportCalls[0]);
      expect(find.text('result:true'), findsOneWidget);
    });

    testWidgets(
        'a pending write keeps its key and revision across a conflict of '
        'ANOTHER kind of answer: only a definite answer releases it',
        (tester) async {
      // lost -> retry answers 409 (definite: the first one never landed) ->
      // reload -> the next send is a new request at the new revision.
      final api = FakeProcessingApi()
        ..reportOutcomes.addAll([_lost, _conflict, null])
        ..flow = _flowAt9;
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Đã xác minh');

      await _tap(tester, _submit);
      await _tap(tester, _retry);

      expect(api.reportCalls[1], api.reportCalls[0]);
      expect(_retry, findsNothing);
      expect(_reload, findsOneWidget);

      await _tap(tester, _reload);
      await _tap(tester, _submit);

      expect(api.reportCalls.length, 3);
      expect(api.reportCalls[2].expectedRevision, 9);
      expect(api.reportCalls[2].idempotencyKey,
          isNot(api.reportCalls[0].idempotencyKey));
      expect(api.reportCalls[2].doneWork, 'Đã xác minh');
      expect(find.text('result:true'), findsOneWidget);
    });

    testWidgets('a new action gets a new key', (tester) async {
      // lost -> the same key; refused -> the attempt is over and the draft is
      // editable again; the next send is a new action.
      final api = FakeProcessingApi()
        ..reportOutcomes.addAll([_lost, _refused, _lost]);
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Lần một');

      await _tap(tester, _submit);
      await _tap(tester, _retry);

      expect(_retry, findsNothing);
      expect(_readOnly(tester, _doneWork), isFalse);
      expect(_textOf(tester, _doneWork), 'Lần một');

      await tester.enterText(_doneWork, 'Lần hai, đã sửa');
      await _tap(tester, _submit);

      final keys = api.reportCalls.map((c) => c.idempotencyKey).toList();
      expect(keys.length, 3);
      expect(keys[1], keys[0], reason: 'retry after a lost answer');
      expect(keys[2], isNot(keys[0]), reason: 'after a definite refusal');
      expect(api.reportCalls[2].doneWork, 'Lần hai, đã sửa');
      expect(_textOf(tester, _doneWork), 'Lần hai, đã sửa');
    });

    testWidgets(
        'the fields are read-only while a submission runs: nothing typed '
        'meanwhile can be lost when success closes the form', (tester) async {
      final gate = Completer<void>();
      final api = FakeProcessingApi()
        ..reportOutcomes.add(null)
        ..reportGate = gate;
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Đã xác minh');
      expect(_readOnly(tester, _doneWork), isFalse);

      await tester.tap(_submit);
      await tester.pump();

      expect(api.reportCalls.length, 1);
      for (final field in [_doneWork, _findings, _difficulties]) {
        expect(_readOnly(tester, field), isTrue);
      }

      gate.complete();
      await tester.pumpAndSettle();
      expect(find.text('result:true'), findsOneWidget);
    });

    testWidgets(
        '409: the typed text stays, sending is held until a reload, then goes '
        'out against the new revision with a new key', (tester) async {
      final api = FakeProcessingApi()
        ..reportOutcomes.addAll([_conflict, null])
        ..flow = _flowAt9;
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Nội dung dài đã gõ');
      await tester.enterText(_findings, 'Nhận định');

      await _tap(tester, _submit);

      expect(_textOf(tester, _doneWork), 'Nội dung dài đã gõ');
      expect(_textOf(tester, _findings), 'Nhận định');
      expect(find.text(writeFailureMessage(_conflict)), findsOneWidget);
      expect(_reload, findsOneWidget);
      // Held: tapping send again does not hammer the stale revision.
      await _tap(tester, _submit);
      expect(api.reportCalls.length, 1);

      await _tap(tester, _reload);

      expect(api.flowCalls, 1);
      expect(_textOf(tester, _doneWork), 'Nội dung dài đã gõ');
      expect(_textOf(tester, _findings), 'Nhận định');

      await _tap(tester, _submit);

      expect(api.reportCalls.length, 2);
      expect(api.reportCalls[1].expectedRevision, 9);
      expect(api.reportCalls[1].doneWork, 'Nội dung dài đã gõ');
      expect(api.reportCalls[1].idempotencyKey,
          isNot(api.reportCalls[0].idempotencyKey));
      expect(find.text('result:true'), findsOneWidget);
    });

    testWidgets(
        'reload after a conflict answers "not available" (404/403): the '
        'actions go away quietly, the draft stays on screen', (tester) async {
      // `flow` stays null: that is what the API answers for 404 and 403.
      final api = FakeProcessingApi()..reportOutcomes.add(_conflict);
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Nội dung dài đã gõ');
      await tester.enterText(_difficulties, 'Thiếu tài liệu');

      await _tap(tester, _submit);
      await _tap(tester, _reload);

      expect(api.flowCalls, 1);
      expect(_reload, findsNothing, reason: 'no reload loop');
      expect(_submit, findsNothing);
      expect(_complete, findsNothing);
      expect(_retry, findsNothing);
      expect(find.byKey(const Key('step-action-message')), findsNothing);
      expect(find.textContaining('Không tải lại được'), findsNothing);
      expect(find.byKey(const Key('step-action-unavailable')), findsOneWidget);
      expect(_textOf(tester, _doneWork), 'Nội dung dài đã gõ');
      expect(_textOf(tester, _difficulties), 'Thiếu tài liệu');
    });

    testWidgets('reload after a conflict FAILS (5xx): reload stays, with the draft',
        (tester) async {
      final api = FakeProcessingApi()
        ..reportOutcomes.add(_conflict)
        ..flowError = StateError('500');
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Nội dung dài đã gõ');

      await _tap(tester, _submit);
      await _tap(tester, _reload);

      expect(_reload, findsOneWidget);
      expect(find.byKey(const Key('step-action-unavailable')), findsNothing);
      expect(_textOf(tester, _doneWork), 'Nội dung dài đã gõ');
    });

    testWidgets('complete: the retry is the same request, and the typed text stays',
        (tester) async {
      final api = FakeProcessingApi()..completeOutcomes.addAll([_lost, null]);
      await _openStepForm(tester, api);
      await tester.enterText(_doneWork, 'Chưa gửi');

      await _tap(tester, _complete);
      await _tap(tester, find.widgetWithText(FilledButton, 'Hoàn thành'));

      expect(_textOf(tester, _doneWork), 'Chưa gửi');
      // A report may not go around the pending completion either.
      await _tap(tester, _submit);
      expect(api.reportCalls, isEmpty);

      await _tap(tester, _retry);

      expect(api.completeCalls.length, 2);
      expect(api.completeCalls[1], api.completeCalls[0]);
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

    testWidgets(
        'a page that was loading when the filter changed is dropped, not '
        'appended to the new list', (tester) async {
      _tallScreen(tester);
      final api = FakeProcessingApi()
        ..summary = summary
        ..total = 3
        ..manualItems = true;
      await tester.pumpWidget(app(api, const MyWorkScreen()));
      await tester.pump();
      api.itemsGates[0].complete();
      await tester.pump();
      await tester.pump();
      expect(find.textContaining('Xác minh trang 1 ALL'), findsOneWidget);

      // Page 2 of "all" starts loading...
      await tester.tap(find.byKey(const Key('my-work-load-more')));
      await tester.pump();
      expect(api.itemsCalls.last.page, 2);
      // ...the person picks RED, and RED answers first.
      await tester.tap(find.byKey(const Key('my-work-count-RED')));
      await tester.pump();
      await tester.pump();
      expect(api.itemsCalls.last, (asOf: summary.asOf, band: 'RED', page: 1));
      api.itemsGates[2].complete();
      await tester.pump();
      await tester.pump();
      expect(find.textContaining('Xác minh trang 1 RED'), findsOneWidget);

      // The old page arrives late.
      api.itemsGates[1].complete();
      await tester.pump();
      await tester.pump();

      expect(find.textContaining('Xác minh trang 2 ALL'), findsNothing);
      expect(find.textContaining('Xác minh trang 1 RED'), findsOneWidget);
      // Paging goes on from the RED list, not from the dropped page.
      await tester.tap(find.byKey(const Key('my-work-load-more')));
      await tester.pump();
      expect(api.itemsCalls.last, (asOf: summary.asOf, band: 'RED', page: 2));
    });

    testWidgets('of two filters picked quickly, the LAST one wins whatever the order of the answers',
        (tester) async {
      _tallScreen(tester);
      final api = FakeProcessingApi()
        ..summary = summary
        ..total = 1
        ..manualItems = true;
      await tester.pumpWidget(app(api, const MyWorkScreen()));
      await tester.pump();
      api.itemsGates[0].complete();
      await tester.pump();
      await tester.pump();

      await tester.tap(find.byKey(const Key('my-work-count-RED')));
      await tester.pump();
      await tester.pump();
      await tester.tap(find.byKey(const Key('my-work-count-YELLOW')));
      await tester.pump();
      await tester.pump();
      expect(api.itemsCalls[1].band, 'RED');
      expect(api.itemsCalls[2].band, 'YELLOW');

      // The newest answers first, the older one after it.
      api.itemsGates[2].complete();
      await tester.pump();
      await tester.pump();
      api.itemsGates[1].complete();
      await tester.pump();
      await tester.pump();

      expect(find.textContaining('Xác minh trang 1 YELLOW'), findsOneWidget);
      expect(find.textContaining('Xác minh trang 1 RED'), findsNothing);
      expect(find.byType(LinearProgressIndicator), findsNothing);
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

    const card = Key('my-work-home-card');
    const cardError = Key('my-work-home-error');
    const entry = Key('drawer-my-work');
    const home = Scaffold(
      body: Column(children: [MyWorkHomeCard(), MyWorkDrawerEntry()]),
    );

    testWidgets('feature off (404/403 = null): no card, no drawer entry, no error',
        (tester) async {
      final off = FakeProcessingApi();
      await tester.pumpWidget(app(off, home));
      await tester.pumpAndSettle();

      expect(off.summaryCalls, 1);
      expect(find.byKey(card), findsNothing);
      expect(find.byKey(cardError), findsNothing);
      expect(find.byKey(entry), findsNothing);
    });

    testWidgets('the summary answered: the card and the drawer entry show',
        (tester) async {
      final on = FakeProcessingApi()..summary = summary;
      await tester.pumpWidget(app(on, home));
      await tester.pumpAndSettle();

      expect(find.byKey(card), findsOneWidget);
      expect(find.text('Quá hạn: 2'), findsOneWidget);
      expect(find.byKey(entry), findsOneWidget);
    });

    testWidgets(
        'a failed summary (5xx, no network) is NOT "feature off": an error '
        'with retry on the home screen, and the drawer entry stays',
        (tester) async {
      final api = FakeProcessingApi()..summaryError = StateError('500');
      await tester.pumpWidget(app(api, home));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byKey(card), findsNothing);
      expect(find.byKey(cardError), findsOneWidget);
      expect(find.byKey(entry), findsOneWidget);

      api
        ..summaryError = null
        ..summary = summary;
      await tester.tap(find.descendant(
          of: find.byKey(cardError), matching: find.text('Thử lại')));
      await tester.pumpAndSettle();

      expect(api.summaryCalls, 2);
      expect(find.byKey(cardError), findsNothing);
      expect(find.byKey(card), findsOneWidget);
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
