import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

const _labels = {
  // CaseStatus
  'TIEP_NHAN': 'Tiếp nhận',
  'DANG_XAC_MINH': 'Đang xác minh',
  'DA_XAC_MINH': 'Đã xác minh',
  'DANG_DIEU_TRA': 'Đang điều tra',
  'TAM_DINH_CHI': 'Tạm đình chỉ',
  'DINH_CHI': 'Đình chỉ',
  'DA_KET_LUAN': 'Đã kết luận',
  'DANG_TRUY_TO': 'Đang truy tố',
  'DANG_XET_XU': 'Đang xét xử',
  'DA_LUU_TRU': 'Đã lưu trữ',
  // IncidentStatus
  'DA_PHAN_CONG': 'Đã phân công',
  'DA_GIAI_QUYET': 'Đã giải quyết',
  'QUA_HAN': 'Quá hạn',
  'DA_CHUYEN_VU_AN': 'Đã chuyển vụ án',
  'KHONG_KHOI_TO': 'Không khởi tố',
  'CHUYEN_XPHC': 'Chuyển XPHC',
  'TDC_HET_THOI_HIEU': 'TĐC hết thời hiệu',
  'TDC_HTH_KHONG_KT': 'TĐC hết thời hạn',
  'PHUC_HOI_NGUON_TIN': 'Phục hồi nguồn tin',
  'DA_CHUYEN_DON_VI': 'Đã chuyển đơn vị',
  'DA_NHAP_VU_KHAC': 'Đã nhập vụ khác',
  'PHAN_LOAI_DAN_SU': 'Dân sự',
};

Color _colorFor(String status) {
  if (status.startsWith('DA_') || status == 'DANG_XET_XU') return AppColors.green;
  if (status.contains('DINH_CHI') || status == 'KHONG_KHOI_TO') return AppColors.yellow;
  if (status == 'QUA_HAN') return AppColors.red;
  if (status.startsWith('DANG_')) return AppColors.navy;
  return AppColors.slate;
}

class StatusChip extends StatelessWidget {
  final String status;

  const StatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final label = _labels[status] ?? status;
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
