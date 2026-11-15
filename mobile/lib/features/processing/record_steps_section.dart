import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/providers.dart';
import '../../core/constants/processing_codes.dart';
import '../../core/models/processing.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/band_chip.dart';
import 'processing_labels.dart';
import 'step_action_screen.dart';

typedef RecordRef = ({String kind, String id});

/// The flow of a record; `null` when the feature is off, not permitted, or
/// the record has no flow (the section then shows nothing).
final recordFlowProvider =
    FutureProvider.family.autoDispose<RecordFlow?, RecordRef>(
  (ref, record) =>
      ref.read(processingApiProvider).getRecordFlow(record.kind, record.id),
);

/// The steps of a record inside its detail screen: colour from the server,
/// days left, the unit working the step, the deadline in Vietnam time.
class RecordStepsSection extends ConsumerWidget {
  final String kind;
  final String recordId;

  const RecordStepsSection({
    super.key,
    required this.kind,
    required this.recordId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final record = (kind: kind, id: recordId);
    final flow = ref.watch(recordFlowProvider(record));
    return flow.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: LinearProgressIndicator(),
      ),
      // The record itself is still readable: a failed side panel stays small.
      error: (_, __) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            const Expanded(
                child: Text('Không tải được các bước xử lý',
                    style: TextStyle(color: AppColors.slate))),
            TextButton(
              onPressed: () => ref.invalidate(recordFlowProvider(record)),
              child: const Text('Thử lại'),
            ),
          ],
        ),
      ),
      data: (f) {
        if (f == null) return const SizedBox.shrink();
        return Column(
          key: const Key('record-steps-section'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Phân công xử lý',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text(
              f.confirmed ? f.flowName : '${f.flowName} (quy trình đề xuất)',
              style: const TextStyle(color: AppColors.slate, fontSize: 13),
            ),
            if (f.suspended)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text('Hồ sơ đang tạm đình chỉ: thời hạn tạm dừng',
                    style: TextStyle(color: AppColors.slate, fontSize: 13)),
              ),
            const SizedBox(height: 8),
            for (final step in f.steps)
              _StepCard(
                step: step,
                onAct: step.isBeingWorked
                    ? () async {
                        final changed = await Navigator.of(context).push<bool>(
                          MaterialPageRoute(
                            builder: (_) => StepActionScreen(
                              api: ref.read(processingApiProvider),
                              kind: kind,
                              recordId: recordId,
                              revision: f.revision,
                              step: step,
                            ),
                          ),
                        );
                        if (changed == true) {
                          ref.invalidate(recordFlowProvider(record));
                        }
                      }
                    : null,
              ),
            const SizedBox(height: 8),
          ],
        );
      },
    );
  }
}

class _StepCard extends StatelessWidget {
  final RecordStep step;
  final VoidCallback? onAct;
  const _StepCard({required this.step, this.onAct});

  @override
  Widget build(BuildContext context) {
    final due = step.dueAt;
    final team = step.mainTeamName;
    final summary = step.latestReportSummary;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text('${step.order}. ${step.name}',
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
                if (step.band != ProcBand.none) ...[
                  const SizedBox(width: 8),
                  BandChip(band: step.band, remainingDays: step.remainingDays),
                ],
              ],
            ),
            const SizedBox(height: 4),
            Text(stepStatusLabel(step.status),
                style: const TextStyle(color: AppColors.slate, fontSize: 13)),
            Text('Đơn vị: ${team ?? 'Đơn vị giữ hồ sơ'}',
                style: const TextStyle(fontSize: 13)),
            if (due != null)
              Text('Hạn: ${formatVnDeadline(due)}',
                  style: const TextStyle(fontSize: 13)),
            if (summary != null && summary.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('Báo cáo gần nhất: $summary',
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style:
                        const TextStyle(color: AppColors.slate, fontSize: 13)),
              ),
            if (onAct != null)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: onAct,
                  icon: const Icon(Icons.edit_note),
                  label: const Text('Báo cáo / Hoàn thành'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
