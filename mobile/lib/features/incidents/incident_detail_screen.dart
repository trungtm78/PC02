import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../shared/widgets/deadline_badge.dart';
import '../../shared/widgets/status_chip.dart';
import '../../core/api/providers.dart';
import '../../core/util/safe_json.dart';

final _incidentDetailProvider =
    FutureProvider.family.autoDispose<Map<String, dynamic>, String>(
  (ref, id) => ref.read(incidentsApiProvider).getIncidentById(id),
);

class IncidentDetailScreen extends ConsumerWidget {
  final String id;
  const IncidentDetailScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_incidentDetailProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết vụ việc')),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              Text('Lỗi: $e'),
              TextButton.icon(
                onPressed: () => ref.invalidate(_incidentDetailProvider(id)),
                icon: const Icon(Icons.refresh),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
        data: (inc) {
          final deadline = inc['deadline'] != null
              ? DateTime.parse(inc['deadline'] as String)
              : null;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(inc['name'] as String? ?? '',
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Row(
                children: [
                  StatusChip(status: inc['status'] as String? ?? ''),
                  const SizedBox(width: 8),
                  if (deadline != null) DeadlineBadge(deadline: deadline),
                ],
              ),
              const SizedBox(height: 16),
              if (deadline != null)
                _InfoRow(
                    label: 'Hạn xử lý',
                    value:
                        DateFormat('dd/MM/yyyy', 'vi_VN').format(deadline)),
              if (inc['investigator'] != null)
                _InfoRow(
                    label: 'Điều tra viên',
                    value:
                        readNestedString(inc, ['investigator', 'fullName']) ??
                            ''),
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
                  style:
                      TextStyle(color: Colors.grey[600], fontSize: 13))),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
