import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/models/case.dart';
import '../../shared/widgets/deadline_badge.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/offline_banner.dart';
import '../../shared/widgets/status_chip.dart';
import '../dashboard/dashboard_screen.dart';

enum _CaseTab { all, overdue, near }

final _casesProvider =
    FutureProvider.family.autoDispose<List<Case>, _CaseTab>((ref, tab) async {
  final api = ref.read(casesApiProvider);
  switch (tab) {
    case _CaseTab.overdue:
      return api.getCases(overdue: true);
    case _CaseTab.near:
      return api.getCases(sortBy: 'deadline', sortOrder: 'asc');
    case _CaseTab.all:
      return api.getCases();
  }
});

class CasesScreen extends ConsumerStatefulWidget {
  const CasesScreen({super.key});

  @override
  ConsumerState<CasesScreen> createState() => _CasesScreenState();
}

class _CasesScreenState extends ConsumerState<CasesScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
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
        title: const Text('Hồ sơ vụ án'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Tất cả'),
            Tab(text: 'Quá hạn'),
            Tab(text: 'Sắp đến hạn'),
          ],
        ),
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Tìm kiếm hồ sơ...',
                prefixIcon: const Icon(Icons.search, size: 20),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8)),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                isDense: true,
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () => setState(() => _searchQuery = ''),
                      )
                    : null,
              ),
              onChanged: (v) => setState(() => _searchQuery = v),
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                _CaseList(tab: _CaseTab.all, searchQuery: _searchQuery),
                _CaseList(tab: _CaseTab.overdue, searchQuery: _searchQuery),
                _CaseList(tab: _CaseTab.near, searchQuery: _searchQuery),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CaseList extends ConsumerWidget {
  final _CaseTab tab;
  final String searchQuery;
  const _CaseList({required this.tab, required this.searchQuery});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_casesProvider(tab));

    return data.when(
      loading: () => _Shimmer(),
      error: (e, _) => EmptyState(
        message: 'Không thể tải dữ liệu',
        icon: Icons.error_outline,
        onRetry: () => ref.invalidate(_casesProvider(tab)),
      ),
      data: (cases) {
        final filtered = searchQuery.isEmpty
            ? cases
            : cases
                .where((c) =>
                    c.name.toLowerCase().contains(searchQuery.toLowerCase()))
                .toList();

        if (filtered.isEmpty) {
          return EmptyState(
            message: searchQuery.isNotEmpty
                ? 'Không tìm thấy hồ sơ phù hợp'
                : tab == _CaseTab.overdue
                    ? 'Không có hồ sơ quá hạn'
                    : 'Không có hồ sơ',
            icon: Icons.folder_open_outlined,
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(_casesProvider(tab)),
          child: ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: filtered.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (ctx, i) => _CaseCard(c: filtered[i]),
          ),
        );
      },
    );
  }
}

class _CaseCard extends StatelessWidget {
  final Case c;
  const _CaseCard({required this.c});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push('/cases/${c.id}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      c.name,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  StatusChip(status: c.status),
                ],
              ),
              if (c.deadline != null) ...[
                const SizedBox(height: 8),
                DeadlineBadge(deadline: c.deadline),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Shimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: 5,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, __) => Container(
          height: 80,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}
