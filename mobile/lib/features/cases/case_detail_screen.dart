import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../shared/widgets/deadline_badge.dart';
import '../../shared/widgets/status_chip.dart';
import '../dashboard/dashboard_screen.dart';

final _caseDetailProvider =
    FutureProvider.family.autoDispose<Map<String, dynamic>, String>(
  (ref, id) => ref.read(casesApiProvider).getCaseById(id),
);

class CaseDetailScreen extends ConsumerWidget {
  final String id;
  const CaseDetailScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_caseDetailProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết hồ sơ')),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 8),
              Text('Lỗi: $e'),
              TextButton.icon(
                onPressed: () => ref.invalidate(_caseDetailProvider(id)),
                icon: const Icon(Icons.refresh),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
        data: (c) {
          final deadline = c['deadline'] != null
              ? DateTime.parse(c['deadline'] as String)
              : null;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                c['name'] as String? ?? '',
                style: const TextStyle(
                    fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  StatusChip(status: c['status'] as String? ?? ''),
                  const SizedBox(width: 8),
                  if (deadline != null) DeadlineBadge(deadline: deadline),
                ],
              ),
              const SizedBox(height: 16),
              if (deadline != null)
                _InfoRow(
                  label: 'Hạn giải quyết',
                  value: DateFormat('dd/MM/yyyy', 'vi_VN').format(deadline),
                ),
              if (c['investigator'] != null)
                _InfoRow(
                  label: 'Điều tra viên',
                  value: (c['investigator'] as Map)['fullName'] as String? ?? '',
                ),
              if (c['createdAt'] != null)
                _InfoRow(
                  label: 'Ngày tạo',
                  value: DateFormat('dd/MM/yyyy', 'vi_VN')
                      .format(DateTime.parse(c['createdAt'] as String)),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(label,
                style: TextStyle(color: Colors.grey[600], fontSize: 13)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
