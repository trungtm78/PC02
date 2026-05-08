class Petition {
  final String id;
  final String senderName;
  final String status;
  final DateTime? deadline;
  final String? assignedToId;
  final String? assignedToName;

  const Petition({
    required this.id,
    required this.senderName,
    required this.status,
    this.deadline,
    this.assignedToId,
    this.assignedToName,
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

  factory Petition.fromJson(Map<String, dynamic> json) => Petition(
        id: json['id'] as String,
        senderName: json['senderName'] as String,
        status: json['status'] as String,
        deadline: json['deadline'] != null
            ? DateTime.parse(json['deadline'] as String)
            : null,
        assignedToId: json['assignedToId'] as String?,
        assignedToName: json['assignedTo']?['fullName'] as String?,
      );
}
