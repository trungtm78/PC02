import 'package:flutter/material.dart';
import '../../core/api/processing_api.dart';
import '../../core/constants/processing_codes.dart';
import '../../core/models/processing.dart';
import '../../core/util/idempotency.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/band_chip.dart';
import 'processing_labels.dart';

/// One write as it was sent: its key and everything in its body. A write
/// whose outcome is unknown is sent again EXACTLY like this.
typedef _Write = ({
  bool isReport,
  String key,
  int revision,
  String reportKind,
  String doneWork,
  String findings,
  String difficulties,
});

/// Report on a step and mark it done: the first business write of the app.
///
/// Rules the screen keeps:
///  - what the person typed stays in the fields on EVERY failure, and the
///    fields are read-only while a write is on its way;
///  - a write whose answer never came (no connection, 5xx) may have reached
///    the server. It stays pending, with its key and its whole body, until
///    the server gives a definite answer: the only thing the screen offers
///    meanwhile is sending that same request again. No other write may go
///    around it, and neither a reload nor a new revision gives it a new key
///    (a new key would write it a second time);
///  - 409 `REVISION_CONFLICT`: the text stays, the person reloads the flow and
///    sends again against the new revision (a new action, a new key);
///  - a reload that finds the feature gone (404 / 403) takes the actions away
///    quietly and leaves the draft on screen.
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

  late int _revision = widget.revision;
  late RecordStep _step = widget.step;
  String _reportKind = ProcReportKind.progress;
  bool _busy = false;
  bool _conflict = false;

  /// The feature is no longer there for this person (switch off, access
  /// revoked): nothing can be sent from here any more.
  bool _unavailable = false;

  /// The write whose outcome is not known yet.
  _Write? _pending;
  String? _message;
  String? _doneWorkError;

  @override
  void dispose() {
    _doneWork.dispose();
    _findings.dispose();
    _difficulties.dispose();
    super.dispose();
  }

  /// Sends [write], which becomes the pending one until the server answers.
  Future<void> _send(_Write write) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _pending = write;
      _message = null;
      _doneWorkError = null;
    });
    try {
      if (write.isReport) {
        await widget.api.submitReport(
          kind: widget.kind,
          recordId: widget.recordId,
          stepKey: _step.stepKey,
          expectedRevision: write.revision,
          idempotencyKey: write.key,
          reportKind: write.reportKind,
          doneWork: write.doneWork,
          findings: write.findings,
          difficulties: write.difficulties,
        );
      } else {
        await widget.api.completeStep(
          kind: widget.kind,
          recordId: widget.recordId,
          stepKey: _step.stepKey,
          expectedRevision: write.revision,
          idempotencyKey: write.key,
        );
      }
      _pending = null;
      if (mounted) Navigator.of(context).pop(true);
    } on ProcessingWriteFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        // A definite answer ends the attempt; an unknown outcome keeps it.
        if (!failure.isRetryable) _pending = null;
        _conflict = failure.isConflict;
        _message = writeFailureMessage(failure);
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// `true` while nothing new may be sent.
  bool get _held => _busy || _conflict || _pending != null || _unavailable;

  Future<void> _submitReport() async {
    if (_held) return;
    final doneWork = _doneWork.text.trim();
    if (doneWork.isEmpty) {
      setState(() => _doneWorkError = 'Phải nhập công việc đã thực hiện');
      return;
    }
    await _send((
      isReport: true,
      key: newIdempotencyKey(),
      revision: _revision,
      reportKind: _reportKind,
      doneWork: doneWork,
      findings: _findings.text.trim(),
      difficulties: _difficulties.text.trim(),
    ));
  }

  Future<void> _complete() async {
    if (_held) return;
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
    if (confirmed != true || !mounted || _held) return;
    await _send((
      isReport: false,
      key: newIdempotencyKey(),
      revision: _revision,
      reportKind: '',
      doneWork: '',
      findings: '',
      difficulties: '',
    ));
  }

  Future<void> _retryPending() async {
    final pending = _pending;
    if (pending != null) await _send(pending);
  }

  /// After a conflict: take the new revision and the new state of the step.
  /// The typed text is not touched.
  Future<void> _reload() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final flow =
          await widget.api.getRecordFlow(widget.kind, widget.recordId);
      if (!mounted) return;
      setState(() {
        if (flow == null) {
          // 404 / 403: switched off or no longer permitted. Not an error to
          // retry: the actions go, the draft stays readable.
          _unavailable = true;
          _conflict = false;
          _message = null;
          return;
        }
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
    final message = _message;
    // Nothing may be typed over a write on its way or one still pending: what
    // is on screen is what was sent.
    final frozen = _busy || _pending != null || _unavailable;
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
          if (_unavailable)
            const Padding(
              key: Key('step-action-unavailable'),
              padding: EdgeInsets.only(bottom: 12),
              child: Text(
                'Hiện không gửi được báo cáo cho bước này từ ứng dụng. '
                'Nội dung đã nhập vẫn hiển thị bên dưới.',
                style: TextStyle(color: AppColors.slate),
              ),
            ),
          if (message != null && !_unavailable)
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
                  Text(message),
                  if (_pending != null)
                    TextButton.icon(
                      key: const Key('step-action-retry'),
                      onPressed: _busy ? null : _retryPending,
                      icon: const Icon(Icons.send),
                      label: const Text('Gửi lại'),
                    ),
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
          if (!_unavailable) ...[
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                    value: ProcReportKind.progress,
                    label: Text('Báo cáo tiến độ')),
                ButtonSegment(
                    value: ProcReportKind.result,
                    label: Text('Báo cáo kết quả')),
              ],
              selected: {_reportKind},
              onSelectionChanged: frozen
                  ? null
                  : (value) => setState(() => _reportKind = value.first),
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            key: const Key('step-action-done-work'),
            controller: _doneWork,
            readOnly: frozen,
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
            readOnly: frozen,
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
            readOnly: frozen,
            minLines: 2,
            maxLines: 6,
            decoration: const InputDecoration(
              labelText: 'Khó khăn, vướng mắc',
              border: OutlineInputBorder(),
            ),
          ),
          if (!_unavailable) ...[
            const SizedBox(height: 16),
            FilledButton.icon(
              key: const Key('step-action-submit'),
              onPressed: _held ? null : _submitReport,
              icon: const Icon(Icons.send),
              label: const Text('Gửi báo cáo'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              key: const Key('step-action-complete'),
              onPressed: _held ? null : _complete,
              icon: const Icon(Icons.check_circle_outline),
              label: const Text('Hoàn thành bước'),
            ),
          ],
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
