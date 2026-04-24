import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/cases_api.dart';
import '../../core/api/dashboard_api.dart';
import '../../core/api/incidents_api.dart';
import '../../core/api/petitions_api.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/models/case.dart';
import '../../core/models/dashboard_stats.dart';
import '../../core/models/incident.dart';
import '../../core/models/petition.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/app_drawer.dart';
import '../../shared/widgets/offline_banner.dart';

final _dashboardDataProvider =
    FutureProvider.autoDispose<_DashboardData>((ref) async {
  final dashApi = ref.read(dashboardApiProvider);
  final casesApi = ref.read(casesApiProvider);
  final incidentsApi = ref.read(incidentsApiProvider);
  final petitionsApi = ref.read(petitionsApiProvider);

  final results = await Future.wait([
    dashApi.getStats(),
    casesApi.getCases(overdue: true, take: 5),
    incidentsApi.getIncidents(overdue: true, take: 5),
    petitionsApi.getPetitions(overdue: true, take: 5),
  ]);

  return _DashboardData(
    stats: results[0] as DashboardStats,
    overdueCases: results[1] as List<Case>,
    overdueIncidents: results[2] as List<Incident>,
    overduePetitions: results[3] as List<Petition>,
  );
});

final dashboardApiProvider =
    Provider((ref) => DashboardApi(ref.read(apiClientProvider)));
final casesApiProvider =
    Provider((ref) => CasesApi(ref.read(apiClientProvider)));
final incidentsApiProvider =
    Provider((ref) => IncidentsApi(ref.read(apiClientProvider)));
final petitionsApiProvider =
    Provider((ref) => PetitionsApi(ref.read(apiClientProvider)));

class _DashboardData {
  final DashboardStats stats;
  final List<Case> overdueCases;
  final List<Incident> overdueIncidents;
  final List<Petition> overduePetitions;

  _DashboardData({
    required this.stats,
    required this.overdueCases,
    required this.overdueIncidents,
    required this.overduePetitions,
  });
}

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_dashboardDataProvider);
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tổng quan'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_dashboardDataProvider),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: data.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        size: 48, color: Colors.red),
                    const SizedBox(height: 8),
                    Text('Lỗi tải dữ liệu: $e'),
                    TextButton.icon(
                      onPressed: () => ref.invalidate(_dashboardDataProvider),
                      icon: const Icon(Icons.refresh),
                      label: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
              data: (d) => RefreshIndicator(
                onRefresh: () async => ref.invalidate(_dashboardDataProvider),
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(
                      'Xin chào, ${user?['fullName'] ?? ''}',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 16),
                    _StatsGrid(stats: d.stats),
                    const SizedBox(height: 24),
                    if (d.overdueCases.isNotEmpty ||
                        d.overdueIncidents.isNotEmpty ||
                        d.overduePetitions.isNotEmpty) ...[
                      const Text(
                        'Cần xử lý ngay',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      ...d.overdueCases.map((c) => _OverdueItem(
                          label: c.name, subtitle: 'Vụ án', route: '/cases/${c.id}')),
                      ...d.overdueIncidents.map((i) => _OverdueItem(
                          label: i.name, subtitle: 'Vụ việc', route: '/incidents/${i.id}')),
                      ...d.overduePetitions.map((p) => _OverdueItem(
                          label: p.senderName, subtitle: 'Đơn thư', route: '/petitions/${p.id}')),
                    ] else
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(32),
                          child: Text('Không có mục quá hạn',
                              style: TextStyle(color: Colors.grey)),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  final DashboardStats stats;
  const _StatsGrid({required this.stats});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.5,
      children: [
        _StatCard(label: 'Tổng hồ sơ', value: stats.totalCases, color: AppColors.navy),
        _StatCard(label: 'Hồ sơ mới', value: stats.newCases, color: AppColors.green),
        _StatCard(label: 'Quá hạn', value: stats.overdueCases, color: AppColors.red),
        _StatCard(label: 'Đã xử lý', value: stats.resolvedCases, color: AppColors.gold),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _StatCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w500)),
          Text(
            '$value',
            style: TextStyle(
                color: color, fontSize: 28, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}

class _OverdueItem extends StatelessWidget {
  final String label;
  final String subtitle;
  final String route;

  const _OverdueItem({required this.label, required this.subtitle, required this.route});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const Icon(Icons.warning_amber_rounded, color: AppColors.red),
        title: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.go(route),
      ),
    );
  }
}
