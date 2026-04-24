class DashboardStats {
  final int totalCases;
  final int newCases;
  final int overdueCases;
  final int resolvedCases;

  const DashboardStats({
    required this.totalCases,
    required this.newCases,
    required this.overdueCases,
    required this.resolvedCases,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) => DashboardStats(
        totalCases: json['totalCases'] as int? ?? 0,
        newCases: json['newCases'] as int? ?? 0,
        overdueCases: json['overdueCases'] as int? ?? 0,
        resolvedCases: json['resolvedCases'] as int? ?? 0,
      );
}
