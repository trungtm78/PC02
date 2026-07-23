import { inferClass, needsInference } from './infer-class';

describe('needsInference — chỉ suy đoán khi thật sự không có trường phân loại', () => {
  it('có phan_loai_nguon_tin_ban_dau → không suy đoán', () => {
    expect(needsInference({ phan_loai_nguon_tin_ban_dau: 'vu-an-ban-dau' })).toBe(false);
  });

  it('chỉ có `loai` → vẫn không suy đoán (bộ ánh xạ tự dùng được)', () => {
    expect(needsInference({ loai: 'vu-viec-ban-dau' })).toBe(false);
  });

  it('cả hai đều rỗng → cần suy đoán (đúng 4 hồ sơ của bảng ho_so, năm 2026)', () => {
    expect(needsInference({ phan_loai_nguon_tin_ban_dau: '', loai: '' })).toBe(true);
    expect(needsInference({})).toBe(true);
  });
});

describe('inferClass — suy từ dấu hiệu nghiệp vụ, luôn kèm căn cứ', () => {
  it('có quyết định khởi tố → vụ án, độ tin cậy cao', () => {
    const r = inferClass({ quyet_dinh_khoi_to_vu_an: '01/QĐ-CSĐT' });
    expect(r).toMatchObject({ phanLoai: 'vu-an-ban-dau', confidence: 'cao' });
  });

  it('có quyết định phân công giải quyết nguồn tin → vụ việc, độ tin cậy cao', () => {
    const r = inferClass({ quyet_dinh_phan_cong_giai_quyet_nguon_tin: '12/QĐ' });
    expect(r).toMatchObject({ phanLoai: 'vu-viec-ban-dau', confidence: 'cao' });
  });

  it('có quyết định tạm đình chỉ nguồn tin → vụ việc', () => {
    expect(inferClass({ quyet_dinh_tam_dinh_chi_nguon_tin: '5/QĐ' }).phanLoai).toBe('vu-viec-ban-dau');
  });

  it('nội dung nói về tố giác → vụ việc, độ tin cậy vừa', () => {
    const r = inferClass({ tom_tat_noi_dung: 'Bà Phạm Thị Thu đến Công an phường tố giác việc nhiều đối tượng đánh con bà' });
    expect(r).toMatchObject({ phanLoai: 'vu-viec-ban-dau', confidence: 'vừa' });
  });

  it('kết quả xử lý ghi "phân công giải quyết nguồn tin" → vụ việc', () => {
    const r = inferClass({ ket_qua_xu_ly_giai_quyet_khac: 'Ra phân công giải quyết nguồn tin để tiếp tục xác minh' });
    expect(r.phanLoai).toBe('vu-viec-ban-dau');
  });

  it('nội dung hướng dẫn khởi kiện → hướng dẫn nghiệp vụ', () => {
    expect(inferClass({ tom_tat_noi_dung: 'Hướng dẫn công dân khởi kiện tại TAND' }).phanLoai).toBe('huong-dan-ban-dau');
  });

  it('quyết định khởi tố THẮNG mọi dấu hiệu khác trong nội dung', () => {
    const r = inferClass({ quyet_dinh_khoi_to_vu_an: '01/QĐ', tom_tat_noi_dung: 'tố giác của công dân' });
    expect(r.phanLoai).toBe('vu-an-ban-dau');
  });

  it('không có dấu hiệu nào → mặc định vụ việc nhưng ĐÁNH DẤU cần kiểm tay', () => {
    const r = inferClass({ tom_tat_noi_dung: 'abc' });
    expect(r.confidence).toBe('thấp');
    expect(r.reason).toContain('KIỂM TAY');
  });

  it('mọi kết quả đều có căn cứ để người duyệt lật lại được', () => {
    for (const rec of [{ quyet_dinh_khoi_to_vu_an: 'x' }, { tom_tat_noi_dung: 'tố giác' }, {}]) {
      expect(inferClass(rec).reason.length).toBeGreaterThan(5);
    }
  });
});
