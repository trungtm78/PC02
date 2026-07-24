import { suyTrangThaiVuAn } from './enrich-status';
import { CaseStatus } from '@prisma/client';

describe('suyTrangThaiVuAn — suy trạng thái từ kết quả xử lý', () => {
  it('KLĐT → đã kết luận', () => {
    expect(suyTrangThaiVuAn('KLĐT ngày 02/8/2017', false)).toBe(CaseStatus.DA_KET_LUAN);
    expect(suyTrangThaiVuAn('Kết luận điều tra số 108', false)).toBe(CaseStatus.DA_KET_LUAN);
  });
  it('KTVA/khởi tố → đang điều tra', () => {
    expect(suyTrangThaiVuAn('KTVA số 159 ngày 03/6/2025', false)).toBe(CaseStatus.DANG_DIEU_TRA);
    expect(suyTrangThaiVuAn('Khởi tố vụ án - QĐ số G424', false)).toBe(CaseStatus.DANG_DIEU_TRA);
  });
  it('có ngayKhoiTo (không có kết quả) → đang điều tra', () => {
    expect(suyTrangThaiVuAn(null, true)).toBe(CaseStatus.DANG_DIEU_TRA);
  });
  it('tạm đình chỉ ưu tiên trước đình chỉ', () => {
    expect(suyTrangThaiVuAn('Tạm đình chỉ điều tra', false)).toBe(CaseStatus.TAM_DINH_CHI);
    expect(suyTrangThaiVuAn('Đình chỉ vụ án', false)).toBe(CaseStatus.DINH_CHI);
  });
  it('truy tố / xét xử', () => {
    expect(suyTrangThaiVuAn('Chuyển VKS truy tố', false)).toBe(CaseStatus.DANG_TRUY_TO);
    expect(suyTrangThaiVuAn('Đưa ra xét xử sơ thẩm', false)).toBe(CaseStatus.DANG_XET_XU);
  });
  it('KLĐT ưu tiên hơn khởi tố (giai đoạn muộn hơn)', () => {
    expect(suyTrangThaiVuAn('Khởi tố ... sau đó KLĐT số 5', false)).toBe(CaseStatus.DA_KET_LUAN);
  });
  it('không tín hiệu → null (giữ nguyên)', () => {
    expect(suyTrangThaiVuAn('', false)).toBeNull();
    expect(suyTrangThaiVuAn('đang xác minh nguồn tin', false)).toBeNull();
  });
});
