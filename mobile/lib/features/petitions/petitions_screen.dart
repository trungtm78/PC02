import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/models/petition.dart';
import '../../shared/widgets/deadline_badge.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/offline_banner.dart';
import '../../shared/widgets/status_chip.dart';
import '../dashboard/dashboard_screen.dart';

enum _PetitionTab { active, overdue }

final _petitionsProvider =
    FutureProvider.family.autoDispose<List<Petition>, _PetitionTab>(
        (ref, tab) async {
  final api = ref.read(petitionsApiProvider);
  if (tab == _PetitionTab.overdue) return api.getPetitions();
  return api.getPetitions(status: 'DANG_XU_LY');
});

class PetitionsScreen extends ConsumerStatefulWidget {
  const PetitionsScreen({super.key});

  @override
  ConsumerState<PetitionsScreen> createState() => _PetitionsScreenState();
}

class _PetitionsScreenState extends ConsumerState<PetitionsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  String _searchQuery = '';

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
        title: const Text('Đơn thư'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'Đang xử lý'), Tab(text: 'Quá hạn')],
        ),
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Tìm kiếm theo tên người gửi...',
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
                _PetitionList(tab: _PetitionTab.active, searchQuery: _searchQuery),
                _PetitionList(tab: _PetitionTab.overdue, searchQuery: _searchQuery),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PetitionList extends ConsumerWidget {
  final _PetitionTab tab;
  final String searchQuery;
  const _PetitionList({required this.tab, required this.searchQuery});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_petitionsProvider(tab));
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
            color: Colors.white,
          ),
        ),
      ),
      error: (e, _) => EmptyState(
        message: 'Không thể tải dữ liệu',
        icon: Icons.error_outline,
        onRetry: () => ref.invalidate(_petitionsProvider(tab)),
      ),
      data: (petitions) {
        final filtered = searchQuery.isEmpty
            ? petitions
            : petitions
                .where((p) => p.senderName
                    .toLowerCase()
                    .contains(searchQuery.toLowerCase()))
                .toList();

        if (filtered.isEmpty) {
          return EmptyState(
            message: searchQuery.isNotEmpty
                ? 'Không tìm thấy đơn thư phù hợp'
                : tab == _PetitionTab.overdue
                    ? 'Không có đơn thư quá hạn'
                    : 'Không có đơn thư đang xử lý',
            icon: Icons.mail_outlined,
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(_petitionsProvider(tab)),
          child: ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: filtered.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (ctx, i) {
              final p = filtered[i];
              return Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => context.push('/petitions/${p.id}'),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(p.senderName,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis),
                            ),
                            const SizedBox(width: 8),
                            StatusChip(status: p.status),
                          ],
                        ),
                        if (p.deadline != null) ...[
                          const SizedBox(height: 8),
                          DeadlineBadge(deadline: p.deadline),
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
