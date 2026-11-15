import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/providers.dart';
import '../../core/constants/processing_codes.dart';
import '../../core/models/processing.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/band_chip.dart';
import '../../shared/widgets/empty_state.dart';
import 'processing_labels.dart';

/// The counts of my work. `null` = the feature is not there for this person
/// (the API turns 404 = switch off and 403 = no permission into `null`): the
/// home card and the drawer entry then do not show at all. Any other failure
/// (5xx, no network) stays an ERROR: the feature exists, it just did not
/// load, and the person gets a retry instead of a vanished entry.
final myWorkSummaryProvider = FutureProvider.autoDispose<TrackingSummary?>(
  (ref) => ref.read(processingApiProvider).getMySummary(),
);

/// "Việc của tôi": the four counts and the steps I work, worst first.
class MyWorkScreen extends ConsumerStatefulWidget {
  const MyWorkScreen({super.key});

  @override
  ConsumerState<MyWorkScreen> createState() => _MyWorkScreenState();
}

class _MyWorkScreenState extends ConsumerState<MyWorkScreen> {
  static const _pageSize = 20;

  TrackingSummary? _summary;
  final List<TrackingItem> _items = [];
  int _total = 0;
  int _page = 0;
  String? _band;
  bool _loading = true;
  bool _loadingMore = false;
  bool _unavailable = false;
  bool _failed = false;

  /// Counts the loads; see [_load].
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// The counts first, then the first page AT THE SAME CLOCK (`asOf`), so the
  /// rows are the ones the counts counted.
  ///
  /// Every load is a new generation. An answer that belongs to an older one
  /// (a filter picked before, a page that was still on its way) is dropped:
  /// it would put rows of another filter, or of another clock, into the list.
  Future<void> _load() async {
    final generation = ++_generation;
    final band = _band;
    setState(() {
      _loading = true;
      _failed = false;
      // A page still on its way belongs to the list being replaced.
      _loadingMore = false;
    });
    final api = ref.read(processingApiProvider);
    try {
      final summary = await api.getMySummary();
      final page = summary == null
          ? null
          : await api.getMyItems(
              asOf: summary.asOf, band: band, page: 1, pageSize: _pageSize);
      if (!mounted || generation != _generation) return;
      setState(() {
        _unavailable = summary == null || page == null;
        _summary = summary;
        _items
          ..clear()
          ..addAll(page?.items ?? const []);
        _total = page?.total ?? 0;
        _page = 1;
      });
    } catch (_) {
      if (mounted && generation == _generation) {
        setState(() => _failed = true);
      }
    } finally {
      if (mounted && generation == _generation) {
        setState(() => _loading = false);
      }
    }
  }

  /// The next page of the list ON SCREEN: same clock, same filter. It does
  /// not start a generation; a refresh or a filter change that happens while
  /// it is on its way makes its answer obsolete.
  Future<void> _loadMore() async {
    final summary = _summary;
    if (summary == null || _loadingMore || _loading) return;
    final generation = _generation;
    final nextPage = _page + 1;
    setState(() => _loadingMore = true);
    try {
      final page = await ref.read(processingApiProvider).getMyItems(
          asOf: summary.asOf,
          band: _band,
          page: nextPage,
          pageSize: _pageSize);
      if (!mounted || generation != _generation || page == null) return;
      setState(() {
        _items.addAll(page.items);
        _total = page.total;
        _page = nextPage;
      });
    } catch (_) {
      if (mounted && generation == _generation) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Không tải thêm được, hãy thử lại')));
      }
    } finally {
      if (mounted && generation == _generation) {
        setState(() => _loadingMore = false);
      }
    }
  }

  void _selectBand(String band) {
    _band = _band == band ? null : band;
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Việc của tôi')),
      body: _body(),
    );
  }

  Widget _body() {
    final summary = _summary;
    if (_loading && summary == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_failed && summary == null) {
      return EmptyState(
        message: 'Không thể tải dữ liệu',
        icon: Icons.error_outline,
        onRetry: _load,
      );
    }
    if (_unavailable || summary == null) {
      return const EmptyState(
        message: 'Chức năng này chưa được bật cho tài khoản của bạn',
        icon: Icons.assignment_outlined,
      );
    }
    final band = _band;
    final counted = band == null ? null : summary.countOf(band);
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Row(
            children: [
              for (final b in ProcBand.counted)
                Expanded(
                  child: _CountCard(
                    band: b,
                    count: summary.countOf(b),
                    selected: _band == b,
                    onTap: () => _selectBand(b),
                  ),
                ),
            ],
          ),
          if (counted != null && counted != _total)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('Số liệu vừa thay đổi, kéo xuống để tải lại',
                  style: TextStyle(color: AppColors.slate, fontSize: 12)),
            ),
          const SizedBox(height: 12),
          if (_loading)
            const LinearProgressIndicator()
          else if (_items.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(
                child: Text('Không có việc nào',
                    style: TextStyle(color: Colors.grey)),
              ),
            ),
          for (final item in _items) _WorkCard(item: item),
          if (_items.length < _total)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Center(
                child: _loadingMore
                    ? const CircularProgressIndicator()
                    : OutlinedButton(
                        key: const Key('my-work-load-more'),
                        onPressed: _loadMore,
                        child: Text(
                            'Tải thêm (${_items.length}/$_total)'),
                      ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CountCard extends StatelessWidget {
  final String band;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  const _CountCard({
    required this.band,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = bandColor(band);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: InkWell(
        key: Key('my-work-count-$band'),
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
          decoration: BoxDecoration(
            color: color.withOpacity(selected ? 0.22 : 0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color, width: selected ? 2 : 1),
          ),
          child: Column(
            children: [
              Text('$count',
                  style: TextStyle(
                      color: color, fontSize: 22, fontWeight: FontWeight.bold)),
              Text(bandLabel(band),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: color, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}

class _WorkCard extends StatelessWidget {
  final TrackingItem item;
  const _WorkCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final route = recordStepsRoute(item.recordKind, item.recordId);
    final due = item.dueAt;
    final code = item.recordCode;
    final label = item.recordLabel;
    final title = [
      if (code != null && code.isNotEmpty) code,
      if (label != null && label.isNotEmpty) label,
    ].join(' · ');
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: route == null ? null : () => context.push(route),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title.isEmpty ? recordKindLabel(item.recordKind) : title,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  BandChip(
                      band: item.band, remainingDays: item.remainingDays),
                ],
              ),
              const SizedBox(height: 4),
              Text('${recordKindLabel(item.recordKind)} · ${item.stepName}',
                  style: const TextStyle(fontSize: 13)),
              if (item.teamName != null)
                Text('Đơn vị: ${item.teamName}',
                    style:
                        const TextStyle(color: AppColors.slate, fontSize: 13)),
              if (due != null)
                Text('Hạn: ${formatVnDeadline(due)}',
                    style:
                        const TextStyle(color: AppColors.slate, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }
}

/// The entry in the drawer. Absent while the summary loads and when the
/// feature is off (404 / 403); present once the summary answered, and also
/// when it FAILED: the screen behind it has its own error and retry.
class MyWorkDrawerEntry extends ConsumerWidget {
  const MyWorkDrawerEntry({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(myWorkSummaryProvider);
    if (!summary.hasError && summary.valueOrNull == null) {
      return const SizedBox.shrink();
    }
    return ListTile(
      key: const Key('drawer-my-work'),
      leading: const Icon(Icons.assignment_outlined),
      title: const Text('Việc của tôi'),
      onTap: () {
        Navigator.of(context).pop();
        context.push('/my-work');
      },
    );
  }
}

/// The card on the home screen. Not there at all while the summary is
/// loading or the feature is off (404 / 403). A summary that failed for any
/// other reason shows a small error with a retry: it is not "feature off".
class MyWorkHomeCard extends ConsumerWidget {
  const MyWorkHomeCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myWorkSummaryProvider);
    if (async.hasError) {
      return Card(
        key: const Key('my-work-home-error'),
        margin: const EdgeInsets.only(bottom: 16),
        child: ListTile(
          leading: const Icon(Icons.error_outline, color: AppColors.slate),
          title: const Text('Việc của tôi'),
          subtitle: const Text('Không tải được số liệu'),
          trailing: TextButton(
            onPressed: async.isLoading
                ? null
                : () => ref.invalidate(myWorkSummaryProvider),
            child: const Text('Thử lại'),
          ),
        ),
      );
    }
    final summary = async.valueOrNull;
    if (summary == null) return const SizedBox.shrink();
    return Card(
      key: const Key('my-work-home-card'),
      margin: const EdgeInsets.only(bottom: 16),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push('/my-work'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Expanded(
                    child: Text('Việc của tôi',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                  Icon(Icons.chevron_right),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  for (final band in ProcBand.counted)
                    Text('${bandLabel(band)}: ${summary.countOf(band)}',
                        style: TextStyle(
                            color: bandColor(band),
                            fontWeight: FontWeight.w600)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
