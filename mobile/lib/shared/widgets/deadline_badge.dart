import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/settings/deadline_settings_provider.dart';
import '../theme/app_theme.dart';

class DeadlineBadge extends ConsumerWidget {
  final DateTime? deadline;

  const DeadlineBadge({super.key, required this.deadline});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = deadline;
    if (d == null) return const SizedBox.shrink();

    final threshold = ref.watch(deadlineThresholdProvider).valueOrNull ?? 7;
    final now = DateTime.now();
    final daysLeft = d.difference(now).inDays;
    final isOverdue = d.isBefore(now);

    Color color;
    String label;

    if (isOverdue) {
      color = AppColors.red;
      label = 'Quá hạn';
    } else if (daysLeft <= threshold) {
      color = AppColors.yellow;
      label = 'Còn $daysLeft ngày';
    } else {
      color = AppColors.green;
      label = 'Còn $daysLeft ngày';
    }

    return Semantics(
      label: label,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color, width: 1),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
