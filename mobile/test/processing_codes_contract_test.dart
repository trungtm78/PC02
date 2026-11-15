import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/core/constants/processing_codes.dart';
import 'package:pc02_mobile/core/fcm/notification_router.dart';
import 'package:pc02_mobile/features/processing/processing_labels.dart';

/// The Dart constants of the processing flow against the contract the backend
/// generates (`assets/contract/processing-codes.json`). A code renamed on the
/// server turns this red instead of silently greying out a chip.
void main() {
  late Map<String, dynamic> contract;

  setUpAll(() {
    final file = File('assets/contract/processing-codes.json');
    contract = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
  });

  List<String> listOf(String key) =>
      (contract[key] as List).map((e) => e as String).toList();

  test('the contract file is the one the app ships', () {
    // The anchor: an empty or moved file must not pass as "all equal".
    expect(listOf('bands'), isNotEmpty);
    expect(listOf('errorCodes').length, greaterThan(20));
  });

  test('record kinds', () {
    expect(ProcRecordKind.all, listOf('recordKinds'));
  });

  test('bands, and the four counted ones are bands', () {
    expect(ProcBand.all, listOf('bands'));
    expect(listOf('bands'), containsAll(ProcBand.counted));
    expect(ProcBand.counted, isNot(contains(ProcBand.none)));
  });

  test('alert sources', () {
    expect(ProcAlertSource.all, listOf('alertSources'));
  });

  test('step statuses', () {
    expect(ProcStepStatus.all, listOf('stepStatuses'));
  });

  test('party roles', () {
    expect(ProcPartyRole.all, listOf('partyRoles'));
  });

  test('report kinds', () {
    expect(ProcReportKind.all, listOf('reportKinds'));
  });

  test('every error code the app words exists on the server', () {
    final codes = listOf('errorCodes');
    for (final code in ProcError.named) {
      expect(codes, contains(code), reason: code);
    }
  });

  test('every code has a Vietnamese label of its own', () {
    for (final band in ProcBand.all) {
      expect(bandLabel(band), isNot(band));
    }
    for (final status in ProcStepStatus.all) {
      expect(stepStatusLabel(status), isNot(status));
    }
    for (final kind in ProcRecordKind.all) {
      expect(recordKindLabel(kind), isNot(kind));
      expect(recordStepsRoute(kind, 'x'), isNotNull);
    }
  });

  test('the steps tab is one word for the router and the screens', () {
    expect(processingStepsTab, NotificationRouter.stepsTab);
  });
}
