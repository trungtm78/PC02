import { CaseStatus, IncidentStatus, PetitionStatus } from '@prisma/client';
import { TRANG_THAI_KET_THUC, laKetThuc, mocGiaiQuyetMoi } from './trang-thai-ket-thuc';

const LUC = new Date(2026, 7, 30, 10, 0);

describe('Trạng thái kết thúc — ranh giới nghiệp vụ', () => {
  it('TẠM đình chỉ KHÔNG phải đã giải quyết — hồ sơ còn phục hồi được', () => {
    expect(laKetThuc('case', CaseStatus.TAM_DINH_CHI)).toBe(false);
    expect(laKetThuc('incident', IncidentStatus.TAM_DINH_CHI)).toBe(false);
  });

  it('không khởi tố / chuyển đơn vị VẪN là xong việc, dù không phải thành tích', () => {
    expect(laKetThuc('incident', IncidentStatus.KHONG_KHOI_TO)).toBe(true);
    expect(laKetThuc('incident', IncidentStatus.DA_CHUYEN_DON_VI)).toBe(true);
  });

  /**
   * Đơn thư chuyển thành vụ việc/vụ án là BẮT ĐẦU một vòng đời mới ở bảng khác, không phải
   * giải quyết xong. Đếm nó là đếm hai lần cùng một việc.
   */
  it('đơn thư chuyển lên vụ việc/vụ án KHÔNG tính là đã giải quyết', () => {
    expect(laKetThuc('petition', PetitionStatus.DA_CHUYEN_VU_VIEC)).toBe(false);
    expect(laKetThuc('petition', PetitionStatus.DA_CHUYEN_VU_AN)).toBe(false);
  });

  it('trạng thái đang làm việc thì chưa xong', () => {
    expect(laKetThuc('case', CaseStatus.DANG_DIEU_TRA)).toBe(false);
    expect(laKetThuc('incident', IncidentStatus.TIEP_NHAN)).toBe(false);
    expect(laKetThuc('petition', PetitionStatus.MOI_TIEP_NHAN)).toBe(false);
  });

  it('trạng thái lạ thì KHÔNG coi là xong — không đoán', () => {
    expect(laKetThuc('case', 'MOT_TRANG_THAI_KHONG_TON_TAI')).toBe(false);
  });

  it('mỗi thực thể khai ít nhất một trạng thái kết thúc', () => {
    for (const [k, v] of Object.entries(TRANG_THAI_KET_THUC)) {
      expect({ k, so: v.length > 0 }).toEqual({ k, so: true });
    }
  });
});

describe('mocGiaiQuyetMoi — quyết theo CHUYỂN TIẾP, không theo trạng thái đích', () => {
  it('đang làm → đã xong: đặt mốc', () => {
    expect(
      mocGiaiQuyetMoi('case', CaseStatus.DANG_DIEU_TRA, CaseStatus.DA_KET_LUAN, null, LUC),
    ).toEqual(LUC);
  });

  /**
   * Ca quan trọng nhất tệp này. Một vụ án đóng từ 2019, di trú sang chưa có mốc — chỉ cần cán
   * bộ sửa MỘT Ô bất kỳ mà biểu mẫu gửi kèm nguyên trạng thái cũ, bản vá trước sẽ đóng cho nó
   * mốc HÔM NAY, và vụ án 2019 nhảy vào báo cáo tháng 8/2026.
   *
   * Đó đúng là việc bịa ngày mà cả đợt này đi sửa, chỉ khác chỗ đứng.
   */
  it('ĐÃ xong từ trước, sửa ô khác mà giữ nguyên trạng thái → KHÔNG bịa mốc hôm nay', () => {
    expect(
      mocGiaiQuyetMoi('case', CaseStatus.DA_KET_LUAN, CaseStatus.DA_KET_LUAN, null, LUC),
    ).toBeUndefined();
  });

  it('đổi giữa hai trạng thái kết thúc → không dời mốc, cũng không tạo mốc', () => {
    const cu = new Date(2025, 2, 1);
    expect(
      mocGiaiQuyetMoi('case', CaseStatus.DA_KET_LUAN, CaseStatus.DA_LUU_TRU, cu, LUC),
    ).toBeUndefined();
    expect(
      mocGiaiQuyetMoi('case', CaseStatus.DA_KET_LUAN, CaseStatus.DA_LUU_TRU, null, LUC),
    ).toBeUndefined();
  });

  /**
   * Hồ sơ phục hồi mà giữ mốc cũ thì nó vừa đang mở vừa đã xong, và có mặt trong báo cáo của
   * một kỳ nó không còn thuộc về.
   */
  it('đã xong → mở lại: XOÁ mốc', () => {
    const cu = new Date(2025, 2, 1);
    expect(
      mocGiaiQuyetMoi('incident', 'DA_GIAI_QUYET', 'DANG_XAC_MINH', cu, LUC),
    ).toBeNull();
  });

  it('mở lại mà vốn không có mốc → không đụng tới cột', () => {
    expect(
      mocGiaiQuyetMoi('incident', 'DA_GIAI_QUYET', 'DANG_XAC_MINH', null, LUC),
    ).toBeUndefined();
  });

  it('vẫn đang làm, đổi giữa hai trạng thái mở → không đụng tới cột', () => {
    expect(
      mocGiaiQuyetMoi('incident', 'TIEP_NHAN', 'DANG_XAC_MINH', null, LUC),
    ).toBeUndefined();
  });

  it('phân biệt "không đụng" với "xoá" — undefined khác null', () => {
    expect(mocGiaiQuyetMoi('petition', 'MOI_TIEP_NHAN', 'MOI_TIEP_NHAN', null, LUC)).toBeUndefined();
    expect(mocGiaiQuyetMoi('petition', 'DA_GIAI_QUYET', 'MOI_TIEP_NHAN', LUC, LUC)).toBeNull();
  });
});
