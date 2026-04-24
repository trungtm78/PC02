import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/models/incident.dart';
import '../../shared/widgets/deadline_badge.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/offline_banner.dart';
import '../../shared/widgets/status_chip.dart';
import '../dashboard/dashboard_screen.dart';

enum _IncidentTab { all, overdue }

final _incidentsProvider =
    FutureProvider.family.autoDispose<List<Incident>, _IncidentTab>(
        (ref, tab) async {
  final api = ref.read(incidentsApiProvider);
  return api.getIncidents(overdue: tab == _IncidentTab.overdue);
});

class IncidentsScreen extends ConsumerStatefulWidget {
  const IncidentsScreen({super.key});

  @override
  ConsumerState<IncidentsScreen> createState() => _IncidentsScreenState();
}

class _IncidentsScreenState extends ConsumerState<IncidentsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Vụ việc'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'Tất cả'), Tab(text: 'Quá hạn')],
        ),
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                _IncidentList(tab: _IncidentTab.all),
                _IncidentList(tab: _IncidentTab.overdue),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _IncidentList extends ConsumerWidget {
  final _IncidentTab tab;
  const _IncidentList({required this.tab});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_incidentsProvider(tab));
    return data.when(
      loading: () => Shimmer.fromColors(
        baseColor: Colors.grey[300]!,
        highlightColor: Colors.grey[100]!,
        child: ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: 5,
          itemBuilder: (_, __) => Container(
            height: 72,
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ),
      error: (e, _) => EmptyState(
        message: 'Không thể tải dữ liệu',
        icon: Icons.error_outline,
        onRetry: () => ref.invalidate(_incidentsProvider(tab)),
      ),
      data: (incidents) {
        if (incidents.isEmpty) {
          return EmptyState(
            message: tab == _IncidentTab.overdue
                ? 'Không có vụ việc quá hạn'
                : 'Không có vụ việc',
            icon: Icons.report_outlined,
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(_incidentsProvider(tab)),
          child: ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: incidents.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (ctx, i) {
              final inc = incidents[i];
              return Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => context.push('/incidents/${inc.id}'),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(inc.name,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis),
                            ),
                            const SizedBox(width: 8),
                            StatusChip(status: inc.status),
                          ],
                        ),
                        if (inc.deadline != null) ...[
                          const SizedBox(height: 8),
                          DeadlineBadge(deadline: inc.deadline),
                        ],
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
