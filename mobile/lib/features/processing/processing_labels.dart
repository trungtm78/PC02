import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/api/processing_api.dart';
import '../../core/constants/processing_codes.dart';
import '../../shared/theme/app_theme.dart';

/// The `tab` value the web uses for the steps of a record. A notification
/// link carries it; the detail screens then open on the steps.
const processingStepsTab = 'phan-cong-xu-ly';

/// The route of a record's detail, opened on its steps.
String? recordStepsRoute(String recordKind, String recordId) {
  final id = Uri.encodeComponent(recordId);
  switch (recordKind) {
    case ProcRecordKind.petition:
      return '/petitions/$id?tab=$processingStepsTab';
    case ProcRecordKind.incident:
      return '/incidents/$id?tab=$processingStepsTab';
    case ProcRecordKind.caseRecord:
      return '/cases/$id?tab=$processingStepsTab';
  }
  return null;
}

String recordKindLabel(String kind) {
  switch (kind) {
    case ProcRecordKind.petition:
      return 'Đơn thư';
    case ProcRecordKind.incident:
      return 'Vụ việc';
    case ProcRecordKind.caseRecord:
      return 'Vụ án';
  }
  return kind;
}

/// The colour of a band. The band itself always comes from the server: the
/// app never works out a colour from a date.
Color bandColor(String band) {
  switch (band) {
    case ProcBand.overdue:
      return const Color(0xFFB91C1C);
    case ProcBand.red:
      return AppColors.red;
    case ProcBand.yellow:
      return AppColors.yellow;
    case ProcBand.green:
      return AppColors.green;
  }
  return AppColors.slate;
}

String bandLabel(String band) {
  switch (band) {
    case ProcBand.overdue:
      return 'Quá hạn';
    case ProcBand.red:
      return 'Đỏ';
    case ProcBand.yellow:
      return 'Vàng';
    case ProcBand.green:
      return 'Xanh';
  }
  return 'Chưa tới ngưỡng';
}

/// "Quá hạn 2 ngày", "Còn 3 ngày": the wording of the days the server counted.
String remainingLabel(String band, int? remainingDays) {
  if (band == ProcBand.overdue) {
    return remainingDays != null && remainingDays < 0
        ? 'Quá hạn ${-remainingDays} ngày'
        : 'Quá hạn';
  }
  if (remainingDays == null) return bandLabel(band);
  if (remainingDays <= 0) return 'Hạn hôm nay';
  return 'Còn $remainingDays ngày';
}

String stepStatusLabel(String status) {
  switch (status) {
    case ProcStepStatus.waitingAnchor:
      return 'Chưa bắt đầu';
    case ProcStepStatus.open:
      return 'Đang thực hiện';
    case ProcStepStatus.reported:
      return 'Đã báo cáo kết quả';
    case ProcStepStatus.done:
      return 'Hoàn thành';
    case ProcStepStatus.skipped:
      return 'Bỏ qua';
  }
  return status;
}

/// A deadline in Vietnam time (UTC+7, no daylight saving), whatever the
/// time zone of the phone.
String formatVnDeadline(DateTime instant) {
  final vn = instant.toUtc().add(const Duration(hours: 7));
  return DateFormat('dd/MM/yyyy HH:mm').format(vn);
}

/// The sentence shown for a write that did not go through.
String writeFailureMessage(ProcessingWriteFailure failure) {
  switch (failure.kind) {
    case ProcessingWriteFailureKind.conflict:
      return 'Hồ sơ vừa được người khác thay đổi. Nội dung đã nhập vẫn được giữ. '
          'Bấm "Tải lại" để lấy bản mới rồi gửi lại.';
    case ProcessingWriteFailureKind.retryable:
      return 'Chưa gửi được (mất kết nối hoặc máy chủ đang lỗi). Nội dung đã nhập '
          'vẫn được giữ. Bấm gửi lại, hệ thống không ghi trùng.';
    case ProcessingWriteFailureKind.notAllowed:
      return 'Bạn không có quyền thực hiện thao tác này.';
    case ProcessingWriteFailureKind.refused:
      break;
  }
  switch (failure.code) {
    case ProcError.notAPartyOfStep:
      return 'Đơn vị của bạn không được giao bước này.';
    case ProcError.stepNotOpen:
      return 'Bước này không còn ở trạng thái đang thực hiện.';
    case ProcError.stepNotReported:
    case ProcError.noResultReport:
      return 'Bước này chưa có báo cáo kết quả nên chưa hoàn thành được.';
    case ProcError.stepNeedsApproval:
      return 'Bước này cần lãnh đạo duyệt kết quả trước khi hoàn thành.';
    case ProcError.stepTransitionInvalid:
      return 'Không thực hiện được thao tác này ở trạng thái hiện tại của bước.';
    case ProcError.reportTextRequired:
      return 'Phải nhập công việc đã thực hiện.';
    case ProcError.idempotencyKeyReused:
      return 'Yêu cầu này đã được gửi với nội dung khác. Tải lại rồi thử lại.';
    case ProcError.recordFlowNotFound:
      return 'Hồ sơ này chưa có quy trình xử lý.';
  }
  final code = failure.code;
  return code == null
      ? 'Không thực hiện được. Vui lòng thử lại.'
      : 'Không thực hiện được ($code).';
}
