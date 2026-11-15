import 'package:flutter/material.dart';
import '../../core/constants/processing_codes.dart';
import '../../core/models/processing.dart';
import '../../features/processing/processing_labels.dart';

/// The alert colour of a step or a record, with its wording. The band comes
/// from the server; nothing here reads a clock.
class BandChip extends StatelessWidget {
  final String band;
  final int? remainingDays;

  /// Shown after the wording, e.g. the name of the step.
  final String? suffix;

  const BandChip({
    super.key,
    required this.band,
    this.remainingDays,
    this.suffix,
  });

  /// The chip of a list row; nothing for a row without an alert.
  static Widget forAlert(RecordAlert? alert) {
    if (alert == null || alert.band == ProcBand.none) {
      return const SizedBox.shrink();
    }
    return BandChip(
      band: alert.band,
      remainingDays: alert.remainingDays,
      suffix: alert.stepName,
    );
  }

  @override
  Widget build(BuildContext context) {
    final color = bandColor(band);
    final extra = suffix;
    final label = extra == null || extra.isEmpty
        ? remainingLabel(band, remainingDays)
        : '${remainingLabel(band, remainingDays)} · $extra';
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
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
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
