import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../theme/app_theme.dart';

Color _colorFor(String status) {
  if (kGreenStatuses.contains(status)) return AppColors.green;
  if (kYellowStatuses.contains(status)) return AppColors.yellow;
  if (status == AppStatus.quaHan) return AppColors.red;
  if (kNavyStatuses.contains(status)) return AppColors.navy;
  return AppColors.slate;
}

class StatusChip extends StatelessWidget {
  final String status;

  const StatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final label = kStatusLabels[status] ?? status;
    final color = _colorFor(status);
    return Semantics(
      label: 'Trạng thái: $label',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}
