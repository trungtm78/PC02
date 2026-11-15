import 'package:flutter/material.dart';
import '../../core/api/processing_api.dart';
import '../../core/constants/processing_codes.dart';
import '../../core/models/processing.dart';
import '../../core/util/idempotency.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/band_chip.dart';
import 'processing_labels.dart';

/// Report on a step and mark it done: the first business write of the app.
///
/// Rules the screen keeps:
///  - what the person typed stays in the fields on EVERY failure;
///  - a write whose answer never came (no connection, 5xx) is sent again with
///    the same idempotency key, so it cannot be written twice; a new action
///    gets a new key;
///  - 409 `REVISION_CONFLICT`: the text stays, the person reloads the flow and
///    sends again against the new revision.
///
/// Pops `true` once a write went through.
class StepActionScreen extends StatefulWidget {
  final ProcessingApi api;
  final String kind;
  final String recordId;
  final int revision;
  final RecordStep step;

  const StepActionScreen({
    super.key,
    required this.api,
    required this.kind,
    required this.recordId,
    required this.revision,
    required this.step,
  });

  @override
  State<StepActionScreen> createState() => _StepActionScreenState();
}

class _StepActionScreenState extends State<StepActionScreen> {
  final _doneWork = TextEditingController();
  final _findings = TextEditingController();
  final _difficulties = TextEditingController();
  final _reportKeys = IdempotencyKeys();
  final _completeKeys = IdempotencyKeys();

  late int _revision = widget.revision;
  late RecordStep _step = widget.step;
  String _reportKind = ProcReportKind.progress;
  bool _busy = false;
  bool _conflict = false;
  String? _message;
  String? _doneWorkError;

  @override
  void dispose() {
    _doneWork.dispose();
    _findings.dispose();
    _difficulties.dispose();
    super.dispose();
  }

  void _failed(ProcessingWriteFailure failure, IdempotencyKeys keys) {
    // A definite answer ends the attempt; an unknown outcome keeps its key.
    if (!failure.isRetryable) keys.settle();
    setState(() {
      _conflict = failure.isConflict;
      _message = writeFailureMessage(failure);
    });
  }

  Future<void> _submitReport() async {
    final doneWork = _doneWork.text.trim();
    if (doneWork.isEmpty) {
      setState(() => _doneWorkError = 'Phải nhập công việc đã thực hiện');
      return;
    }
    final findings = _findings.text.trim();
    final difficulties = _difficulties.text.trim();
    final key = _reportKeys.keyFor(
        [_revision, _reportKind, doneWork, findings, difficulties].join('\u0001'));
    setState(() {
      _busy = true;
      _message = null;
      _doneWorkError = null;
    });
    try {
      await widget.api.submitReport(
        kind: widget.kind,
        recordId: widget.recordId,
        stepKey: _step.stepKey,
        expectedRevision: _revision,
        idempotencyKey: key,
        reportKind: _reportKind,
        doneWork: doneWork,
        findings: findings,
        difficulties: difficulties,
      );
      _reportKeys.settle();
      if (mounted) Navigator.of(context).pop(true);
    } on ProcessingWriteFailure catch (failure) {
      if (mounted) _failed(failure, _reportKeys);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _complete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hoàn thành bước'),
        content: Text('Xác nhận hoàn thành bước "${_step.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Huỷ'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Hoàn thành'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final key = _completeKeys.keyFor('$_revision');
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await widget.api.completeStep(
        kind: widget.kind,
        recordId: widget.recordId,
        stepKey: _step.stepKey,
        expectedRevision: _revision,
        idempotencyKey: key,
      );
      _completeKeys.settle();
      if (mounted) Navigator.of(context).pop(true);
    } on ProcessingWriteFailure catch (failure) {
      if (mounted) _failed(failure, _completeKeys);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// After a conflict: take the new revision and the new state of the step.
  /// The typed text is not touched.
  Future<void> _reload() async {
    setState(() => _busy = true);
    try {
      final flow =
          await widget.api.getRecordFlow(widget.kind, widget.recordId);
      if (!mounted) return;
      if (flow == null) {
        setState(() => _message = 'Không tải lại được quy trình của hồ sơ.');
        return;
      }
      setState(() {
        _revision = flow.revision;
        _step = flow.stepOf(_step.stepKey) ?? _step;
        _conflict = false;
        _message = 'Đã tải bản mới. Kiểm tra lại rồi gửi.';
      });
    } catch (_) {
      if (mounted) {
        setState(() => _message =
            'Không tải lại được. Nội dung đã nhập vẫn được giữ, hãy thử lại.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final due = _step.dueAt;
    return Scaffold(
      appBar: AppBar(title: const Text('Báo cáo kết quả bước')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(_step.name,
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(stepStatusLabel(_step.status),
                  style: const TextStyle(color: AppColors.slate)),
              if (_step.band != ProcBand.none)
                BandChip(
                    band: _step.band, remainingDays: _step.remainingDays),
              if (due != null)
                Text('Hạn: ${formatVnDeadline(due)}',
                    style: const TextStyle(color: AppColors.slate)),
            ],
          ),
          const SizedBox(height: 16),
          if (_message != null)
            Container(
              key: const Key('step-action-message'),
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.yellow.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.yellow),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_message!),
                  if (_conflict)
                    TextButton.icon(
                      key: const Key('step-action-reload'),
                      onPressed: _busy ? null : _reload,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Tải lại'),
                    ),
                ],
              ),
            ),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(
                  value: ProcReportKind.progress,
                  label: Text('Báo cáo tiến độ')),
              ButtonSegment(
                  value: ProcReportKind.result, label: Text('Báo cáo kết quả')),
            ],
            selected: {_reportKind},
            onSelectionChanged: _busy
                ? null
                : (value) => setState(() => _reportKind = value.first),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('step-action-done-work'),
            controller: _doneWork,
            minLines: 3,
            maxLines: 8,
            decoration: InputDecoration(
              labelText: 'Công việc đã thực hiện *',
              errorText: _doneWorkError,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('step-action-findings'),
            controller: _findings,
            minLines: 2,
            maxLines: 6,
            decoration: const InputDecoration(
              labelText: 'Kết quả, nhận định',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('step-action-difficulties'),
            controller: _difficulties,
            minLines: 2,
            maxLines: 6,
            decoration: const InputDecoration(
              labelText: 'Khó khăn, vướng mắc',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            key: const Key('step-action-submit'),
            onPressed: _busy || _conflict ? null : _submitReport,
            icon: const Icon(Icons.send),
            label: const Text('Gửi báo cáo'),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            key: const Key('step-action-complete'),
            onPressed: _busy || _conflict ? null : _complete,
            icon: const Icon(Icons.check_circle_outline),
            label: const Text('Hoàn thành bước'),
          ),
          if (_busy)
            const Padding(
              padding: EdgeInsets.only(top: 16),
              child: Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    );
  }
}
