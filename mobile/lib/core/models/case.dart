class Case {
  final String id;
  final String name;
  final String status;
  final DateTime? deadline;
  final String? investigatorId;
  final String? investigatorName;

  const Case({
    required this.id,
    required this.name,
    required this.status,
    this.deadline,
    this.investigatorId,
    this.investigatorName,
  });

  bool get isOverdue {
    final d = deadline;
    return d != null && d.isBefore(DateTime.now());
  }

  int? get daysUntilDeadline {
    final d = deadline;
    if (d == null) return null;
    return d.difference(DateTime.now()).inDays;
  }

  factory Case.fromJson(Map<String, dynamic> json) => Case(
        id: json['id'] as String,
        name: json['name'] as String,
        status: json['status'] as String,
        deadline: json['deadline'] != null
            ? DateTime.parse(json['deadline'] as String)
            : null,
        investigatorId: json['investigatorId'] as String?,
        investigatorName: json['investigator']?['fullName'] as String?,
      );
}
