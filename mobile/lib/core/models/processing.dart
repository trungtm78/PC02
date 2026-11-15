import '../constants/processing_codes.dart';

DateTime? _date(dynamic value) =>
    value is String ? DateTime.tryParse(value) : null;

int? _int(dynamic value) => value is num ? value.toInt() : null;

/// The alert of a record on a list row, as the server computed it.
class RecordAlert {
  final String source;
  final String band;
  final int? remainingDays;
  final String? stepName;
  final DateTime? dueAt;

  const RecordAlert({
    required this.source,
    required this.band,
    this.remainingDays,
    this.stepName,
    this.dueAt,
  });

  /// `null` for a row without an alert (the switch is off, or nothing counts down).
  static RecordAlert? tryParse(dynamic json) {
    if (json is! Map) return null;
    final band = json['band'];
    if (band is! String) return null;
    return RecordAlert(
      source: json['source'] as String? ?? ProcAlertSource.flow,
      band: band,
      remainingDays: _int(json['remainingDays']),
      stepName: json['stepName'] as String?,
      dueAt: _date(json['dueAt']),
    );
  }
}

class TrackingSummary {
  /// The clock the counts were taken at; sent back with every list request.
  final String asOf;
  final Map<String, int> counts;

  const TrackingSummary({required this.asOf, required this.counts});

  int countOf(String band) => counts[band] ?? 0;

  factory TrackingSummary.fromJson(Map<String, dynamic> json) {
    final raw = json['counts'];
    return TrackingSummary(
      asOf: json['asOf'] as String,
      counts: {
        for (final band in ProcBand.counted)
          band: raw is Map ? (_int(raw[band]) ?? 0) : 0,
      },
    );
  }
}

class TrackingItem {
  final String recordKind;
  final String recordId;
  final String? recordCode;
  final String? recordLabel;
  final String stepKey;
  final String stepName;
  final String? teamName;
  final String? responsibleName;
  final DateTime? dueAt;
  final String band;
  final int? remainingDays;

  const TrackingItem({
    required this.recordKind,
    required this.recordId,
    required this.stepKey,
    required this.stepName,
    required this.band,
    this.recordCode,
    this.recordLabel,
    this.teamName,
    this.responsibleName,
    this.dueAt,
    this.remainingDays,
  });

  factory TrackingItem.fromJson(Map<String, dynamic> json) => TrackingItem(
        recordKind: json['recordKind'] as String,
        recordId: json['recordId'] as String,
        recordCode: json['recordCode'] as String?,
        recordLabel: json['recordLabel'] as String?,
        stepKey: json['stepKey'] as String? ?? '',
        stepName: json['stepName'] as String? ?? '',
        teamName: json['teamName'] as String?,
        responsibleName: json['responsibleName'] as String?,
        dueAt: _date(json['dueAt']),
        band: json['band'] as String? ?? ProcBand.none,
        remainingDays: _int(json['remainingDays']),
      );
}

class TrackingPage {
  final String asOf;
  final int total;
  final int page;
  final int pageSize;
  final List<TrackingItem> items;

  const TrackingPage({
    required this.asOf,
    required this.total,
    required this.page,
    required this.pageSize,
    required this.items,
  });

  factory TrackingPage.fromJson(Map<String, dynamic> json) => TrackingPage(
        asOf: json['asOf'] as String? ?? '',
        total: _int(json['total']) ?? 0,
        page: _int(json['page']) ?? 1,
        pageSize: _int(json['pageSize']) ?? 20,
        items: [
          for (final item in (json['items'] as List? ?? const []))
            if (item is Map) TrackingItem.fromJson(Map<String, dynamic>.from(item)),
        ],
      );
}

class RecordStepParty {
  final String partyKind;
  final String? teamName;
  final String role;

  const RecordStepParty({
    required this.partyKind,
    required this.role,
    this.teamName,
  });

  factory RecordStepParty.fromJson(Map<String, dynamic> json) =>
      RecordStepParty(
        partyKind: json['partyKind'] as String? ?? '',
        teamName: json['teamName'] as String?,
        role: json['role'] as String? ?? '',
      );
}

class RecordStep {
  final String stepKey;
  final int order;
  final String name;
  final String status;
  final String band;
  final int? remainingDays;
  final DateTime? dueAt;
  final bool requiresApproval;
  final List<RecordStepParty> parties;
  final String? latestReportSummary;

  const RecordStep({
    required this.stepKey,
    required this.order,
    required this.name,
    required this.status,
    required this.band,
    this.remainingDays,
    this.dueAt,
    this.requiresApproval = false,
    this.parties = const [],
    this.latestReportSummary,
  });

  /// A step being worked: the only one a report or a completion makes sense for.
  bool get isBeingWorked =>
      status == ProcStepStatus.open || status == ProcStepStatus.reported;

  /// The unit that works the step; `null` when it is the unit holding the record.
  String? get mainTeamName {
    for (final party in parties) {
      if (party.role == ProcPartyRole.main) return party.teamName;
    }
    return null;
  }

  factory RecordStep.fromJson(Map<String, dynamic> json) {
    final report = json['latestReport'];
    return RecordStep(
      stepKey: json['stepKey'] as String,
      order: _int(json['order']) ?? 0,
      name: json['name'] as String? ?? '',
      status: json['status'] as String? ?? '',
      band: json['band'] as String? ?? ProcBand.none,
      remainingDays: _int(json['remainingDays']),
      dueAt: _date(json['dueAt']),
      requiresApproval: json['requiresApproval'] == true,
      parties: [
        for (final party in (json['parties'] as List? ?? const []))
          if (party is Map)
            RecordStepParty.fromJson(Map<String, dynamic>.from(party)),
      ],
      latestReportSummary: report is Map ? report['summary'] as String? : null,
    );
  }
}

class RecordFlow {
  final String recordKind;
  final String recordId;
  final String flowName;
  final bool confirmed;
  final bool suspended;

  /// The revision every write must carry back (`expectedRevision`).
  final int revision;
  final List<RecordStep> steps;

  const RecordFlow({
    required this.recordKind,
    required this.recordId,
    required this.flowName,
    required this.revision,
    required this.steps,
    this.confirmed = true,
    this.suspended = false,
  });

  RecordStep? stepOf(String stepKey) {
    for (final step in steps) {
      if (step.stepKey == stepKey) return step;
    }
    return null;
  }

  factory RecordFlow.fromJson(Map<String, dynamic> json) => RecordFlow(
        recordKind: json['recordKind'] as String? ?? '',
        recordId: json['recordId'] as String? ?? '',
        flowName: json['flowName'] as String? ?? '',
        confirmed: json['confirmed'] != false,
        suspended: json['suspended'] == true,
        revision: _int(json['revision']) ?? 0,
        steps: [
          for (final step in (json['steps'] as List? ?? const []))
            if (step is Map) RecordStep.fromJson(Map<String, dynamic>.from(step)),
        ],
      );
}
