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
   * Ca này TRƯỚC ĐÂY khẳng định điều NGƯỢC LẠI: "đơn thư chuyển lên vụ việc/vụ án KHÔNG tính là
   * đã giải quyết", với lý lẽ "nó vừa bắt đầu vòng đời mới ở bảng khác, đếm là đếm hai lần".
   *
   * Lý lẽ ấy nghe xuôi nhưng trái với chính kho mã: `petitions.service.ts` và
   * `incidents.constants.ts` đã coi hai trạng thái ấy là kết thúc từ trước. Và trái cả nghiệp
   * vụ: với nguồn tin, khởi tố CHÍNH LÀ kết quả — TT28 lấy tỷ lệ khám phá làm chỉ tiêu. Hồ sơ
   * sinh ra ở bảng sau kết thúc vào một lúc khác, nên không phải đếm hai lần.
   *
   * Giữ lại lịch sử để lần sau ai định "sửa lại cho hợp lý" thì biết đã có người nghĩ vậy rồi.
   */
  it('chuyển lên thực thể sau VẪN là kết thúc — khởi tố là kết quả, không phải bỏ dở', () => {
    expect(laKetThuc('petition', PetitionStatus.DA_CHUYEN_VU_VIEC)).toBe(true);
    expect(laKetThuc('petition', PetitionStatus.DA_CHUYEN_VU_AN)).toBe(true);
    expect(laKetThuc('incident', IncidentStatus.DA_CHUYEN_VU_AN)).toBe(true);
  });

  /**
   * Chốt HỢP NHẤT: ba định nghĩa "kết thúc" từng nằm rải rác và lệch nhau. Nay chỉ còn một.
   */
  it('khớp đúng các định nghĩa vốn có trong kho, không lệch đi', () => {
    expect([...TRANG_THAI_KET_THUC.case]).toEqual([
      CaseStatus.DA_KET_LUAN,
      CaseStatus.DA_LUU_TRU,
      CaseStatus.DINH_CHI,
    ]);
    expect([...TRANG_THAI_KET_THUC.incident]).toContain(IncidentStatus.DA_CHUYEN_VU_AN);
    // `DA_LUU_DON` là phần THÊM có chủ đích: lưu đơn là một kết quả xử lý, danh sách cũ bỏ sót
    // nên đơn đã lưu vẫn bị bộ lọc quá hạn đếm là còn tồn.
    expect([...TRANG_THAI_KET_THUC.petition]).toContain(PetitionStatus.DA_LUU_DON);
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
