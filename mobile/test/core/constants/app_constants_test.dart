import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/core/constants/app_constants.dart';

void main() {
  group('kStatusLabels', () {
    test('contains all CaseStatus values', () {
      expect(kStatusLabels[AppStatus.tiepNhan], 'Tiếp nhận');
      expect(kStatusLabels[AppStatus.dangXacMinh], 'Đang xác minh');
      expect(kStatusLabels[AppStatus.daXacMinh], 'Đã xác minh');
      expect(kStatusLabels[AppStatus.dangDieuTra], 'Đang điều tra');
      expect(kStatusLabels[AppStatus.tamDinhChi], 'Tạm đình chỉ');
      expect(kStatusLabels[AppStatus.dinhChi], 'Đình chỉ');
      expect(kStatusLabels[AppStatus.daKetLuan], 'Đã kết luận');
      expect(kStatusLabels[AppStatus.dangTruyTo], 'Đang truy tố');
      expect(kStatusLabels[AppStatus.dangXetXu], 'Đang xét xử');
      expect(kStatusLabels[AppStatus.daLuuTru], 'Đã lưu trữ');
    });

    test('contains all IncidentStatus values', () {
      expect(kStatusLabels[AppStatus.daPhanCong], 'Đã phân công');
      expect(kStatusLabels[AppStatus.daGiaiQuyet], 'Đã giải quyết');
      expect(kStatusLabels[AppStatus.quaHan], 'Quá hạn');
      expect(kStatusLabels[AppStatus.dachuyenVuAn], 'Đã chuyển vụ án');
      expect(kStatusLabels[AppStatus.khongKhoiTo], 'Không khởi tố');
      expect(kStatusLabels[AppStatus.chuyenXphc], 'Chuyển XPHC');
      expect(kStatusLabels[AppStatus.tdcHetThoiHieu], 'TĐC hết thời hiệu');
      expect(kStatusLabels[AppStatus.tdcHthKhongKt], 'TĐC hết thời hạn');
      expect(kStatusLabels[AppStatus.phucHoiNguonTin], 'Phục hồi nguồn tin');
      expect(kStatusLabels[AppStatus.dachuyenDonVi], 'Đã chuyển đơn vị');
      expect(kStatusLabels[AppStatus.daNhapVuKhac], 'Đã nhập vụ khác');
      expect(kStatusLabels[AppStatus.phanLoaiDanSu], 'Dân sự');
    });

    test('contains all PetitionStatus values (bug fix — was missing before)', () {
      expect(kStatusLabels[AppStatus.moiTiepNhan], 'Mới tiếp nhận');
      expect(kStatusLabels[AppStatus.dangXuLy], 'Đang xử lý');
      expect(kStatusLabels[AppStatus.choPheduyet], 'Chờ phê duyệt');
      expect(kStatusLabels[AppStatus.daLuuDon], 'Đã lưu đơn');
      expect(kStatusLabels[AppStatus.dachuyenVuViec], 'Đã chuyển vụ việc');
    });

    test('unknown status returns null (StatusChip shows raw string as fallback)', () {
      expect(kStatusLabels['UNKNOWN_STATUS'], isNull);
      expect(kStatusLabels[''], isNull);
    });
  });

  group('kGreenStatuses', () {
    test('DA_* terminal states are green', () {
      expect(kGreenStatuses.contains(AppStatus.daKetLuan), isTrue);
      expect(kGreenStatuses.contains(AppStatus.daLuuTru), isTrue);
      expect(kGreenStatuses.contains(AppStatus.dachuyenVuAn), isTrue);
      expect(kGreenStatuses.contains(AppStatus.daXacMinh), isTrue);
      expect(kGreenStatuses.contains(AppStatus.daPhanCong), isTrue);
      expect(kGreenStatuses.contains(AppStatus.daGiaiQuyet), isTrue);
    });

    test('dangXetXu is green (original explicit exception preserved)', () {
      expect(kGreenStatuses.contains(AppStatus.dangXetXu), isTrue);
    });

    // Regression: KHONG_KHOI_TO was in both green and yellow during eng review
    test('KHONG_KHOI_TO is NOT green (belongs in yellow)', () {
      expect(kGreenStatuses.contains(AppStatus.khongKhoiTo), isFalse);
    });

    // Regression: DANG_TRUY_TO was in both green and navy during eng review
    test('DANG_TRUY_TO is NOT green (belongs in navy)', () {
      expect(kGreenStatuses.contains(AppStatus.dangTruyTo), isFalse);
    });

    test('QUA_HAN is NOT green (it is red)', () {
      expect(kGreenStatuses.contains(AppStatus.quaHan), isFalse);
    });
  });

  group('kYellowStatuses', () {
    test('suspended states are yellow', () {
      expect(kYellowStatuses.contains(AppStatus.tamDinhChi), isTrue);
      expect(kYellowStatuses.contains(AppStatus.dinhChi), isTrue);
      expect(kYellowStatuses.contains(AppStatus.khongKhoiTo), isTrue);
      expect(kYellowStatuses.contains(AppStatus.tdcHetThoiHieu), isTrue);
      expect(kYellowStatuses.contains(AppStatus.tdcHthKhongKt), isTrue);
      expect(kYellowStatuses.contains(AppStatus.choPheduyet), isTrue);
    });

    test('DANG_TRUY_TO is NOT yellow (belongs in navy)', () {
      expect(kYellowStatuses.contains(AppStatus.dangTruyTo), isFalse);
    });
  });

  group('kNavyStatuses', () {
    test('in-progress states are navy', () {
      expect(kNavyStatuses.contains(AppStatus.dangXacMinh), isTrue);
      expect(kNavyStatuses.contains(AppStatus.dangDieuTra), isTrue);
      expect(kNavyStatuses.contains(AppStatus.dangTruyTo), isTrue);
      expect(kNavyStatuses.contains(AppStatus.dangXuLy), isTrue);
      expect(kNavyStatuses.contains(AppStatus.phucHoiNguonTin), isTrue);
      expect(kNavyStatuses.contains(AppStatus.moiTiepNhan), isTrue);
    });

    test('QUA_HAN is NOT navy (it is red)', () {
      expect(kNavyStatuses.contains(AppStatus.quaHan), isFalse);
    });
  });

  group('QUA_HAN — explicit red', () {
    test('QUA_HAN is not in any set (handled as explicit red check)', () {
      expect(kGreenStatuses.contains(AppStatus.quaHan), isFalse);
      expect(kYellowStatuses.contains(AppStatus.quaHan), isFalse);
      expect(kNavyStatuses.contains(AppStatus.quaHan), isFalse);
    });
  });

  group('AppAuthResult', () {
    test('pending2fa wire value is stable', () {
      expect(AppAuthResult.pending2fa, 'pending_2fa');
    });

    test('success wire value is stable', () {
      expect(AppAuthResult.success, 'success');
    });
  });

  group('No status in multiple color groups', () {
    final allSets = [kGreenStatuses, kYellowStatuses, kNavyStatuses];
    final allStatuses = [
      ...kGreenStatuses,
      ...kYellowStatuses,
      ...kNavyStatuses,
    ];

    test('each status appears in exactly one color group', () {
      for (final status in allStatuses) {
        final count = allSets.where((s) => s.contains(status)).length;
        expect(count, 1,
            reason: "'$status' should be in exactly 1 color group, found $count");
      }
    });
  });
}
