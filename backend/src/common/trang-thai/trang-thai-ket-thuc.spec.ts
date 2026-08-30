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

describe('mocGiaiQuyetMoi', () => {
  it('vào trạng thái kết thúc lần đầu → đặt mốc', () => {
    expect(mocGiaiQuyetMoi('case', CaseStatus.DA_KET_LUAN, null, LUC)).toEqual(LUC);
  });

  /**
   * Sửa từ "đã kết luận" sang "đã lưu trữ" không phải là giải quyết LẠI. Dời mốc là làm hồ sơ
   * nhảy sang kỳ báo cáo khác — số liệu của một kỳ đã chốt tự nhiên đổi.
   */
  it('đã có mốc rồi thì KHÔNG dời, dù đổi sang trạng thái kết thúc khác', () => {
    const cu = new Date(2025, 2, 1);
    expect(mocGiaiQuyetMoi('case', CaseStatus.DA_LUU_TRU, cu, LUC)).toBeUndefined();
  });

  /**
   * Hồ sơ phục hồi mà giữ mốc cũ thì nó vừa đang mở vừa đã xong, và có mặt trong báo cáo của
   * một kỳ nó không còn thuộc về.
   */
  it('ra khỏi trạng thái kết thúc → XOÁ mốc', () => {
    const cu = new Date(2025, 2, 1);
    expect(mocGiaiQuyetMoi('incident', IncidentStatus.DANG_XAC_MINH, cu, LUC)).toBeNull();
  });

  it('vẫn đang làm và vốn không có mốc → không đụng tới cột', () => {
    expect(mocGiaiQuyetMoi('incident', IncidentStatus.TIEP_NHAN, null, LUC)).toBeUndefined();
  });

  it('phân biệt "không đụng" với "xoá" — undefined khác null', () => {
    expect(mocGiaiQuyetMoi('petition', PetitionStatus.MOI_TIEP_NHAN, null, LUC)).toBeUndefined();
    expect(mocGiaiQuyetMoi('petition', PetitionStatus.MOI_TIEP_NHAN, LUC, LUC)).toBeNull();
  });
});
