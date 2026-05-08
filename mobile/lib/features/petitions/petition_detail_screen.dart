import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../shared/widgets/deadline_badge.dart';
import '../../shared/widgets/status_chip.dart';
import '../../core/api/providers.dart';

final _petitionDetailProvider =
    FutureProvider.family.autoDispose<Map<String, dynamic>, String>(
  (ref, id) => ref.read(petitionsApiProvider).getPetitionById(id),
);

class PetitionDetailScreen extends ConsumerWidget {
  final String id;
  const PetitionDetailScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_petitionDetailProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết đơn thư')),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              Text('Lỗi: $e'),
              TextButton.icon(
                onPressed: () => ref.invalidate(_petitionDetailProvider(id)),
                icon: const Icon(Icons.refresh),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
        data: (p) {
          final deadline = p['deadline'] != null
              ? DateTime.parse(p['deadline'] as String)
              : null;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(p['senderName'] as String? ?? '',
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Row(
                children: [
                  StatusChip(status: p['status'] as String? ?? ''),
                  const SizedBox(width: 8),
                  if (deadline != null) DeadlineBadge(deadline: deadline),
                ],
              ),
              const SizedBox(height: 16),
              if (deadline != null)
                _InfoRow(
                    label: 'Hạn xử lý',
                    value: DateFormat('dd/MM/yyyy', 'vi_VN').format(deadline)),
              if (p['assignedTo'] != null)
                _InfoRow(
                    label: 'Người xử lý',
                    value: (p['assignedTo'] as Map)['fullName'] as String? ?? ''),
              if (p['content'] != null && (p['content'] as String).isNotEmpty)
                _InfoRow(label: 'Nội dung', value: p['content'] as String),
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
                  style: TextStyle(color: Colors.grey[600], fontSize: 13))),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
