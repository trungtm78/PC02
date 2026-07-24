import { deXuatChoVuAn } from './enrich-totung';

const trongRong = {
  ngayKhoiTo: null,
  soQuyetDinhKhoiTo: null,
  chuyenVuAnChoCQK: null,
  metadata: null,
};

describe('deXuatChoVuAn — bóc mốc tố tụng từ tóm tắt hệ cũ', () => {
  it('bóc ngày khởi tố từ văn bản thật (27/10/2016)', () => {
    const dx = deXuatChoVuAn({
      ...trongRong,
      legacyRaw: {
        tom_tat_noi_dung:
          'Ngày 27/10/2016, Công an quận Tân Bình ra quyết định khởi tố vụ án hình sự về tội "Trộm cắp tài sản".',
      },
    });
    const kt = dx.find((d) => d.o === 'ngayKhoiTo');
    expect(kt).toBeDefined();
    expect((kt!.giaTri as Date).toISOString().slice(0, 10)).toBe('2016-10-27');
    expect(kt!.dauVet).toContain('27/10/2016');
  });

  it('bóc số QĐ khởi tố', () => {
    const dx = deXuatChoVuAn({
      ...trongRong,
      legacyRaw: { tom_tat_noi_dung: 'Quyết định khởi tố vụ án số 123/QĐ-CSĐT ngày 05/12/2016.' },
    });
    expect(dx.find((d) => d.o === 'soQuyetDinhKhoiTo')?.giaTri).toBe('123/QĐ-CSĐT');
  });

  it('bóc chuyển vụ án cho cơ quan khác', () => {
    const dx = deXuatChoVuAn({
      ...trongRong,
      legacyRaw: { tom_tat_noi_dung: 'Đã chuyển vụ án cho Cơ quan CSĐT Công an tỉnh An Giang thụ lý.' },
    });
    expect(dx.find((d) => d.o === 'chuyenVuAnChoCQK')).toBeDefined();
  });

  it('KHÔNG đè ô đã có giá trị (ô trống hơn ô sai — không ghi chồng người dùng)', () => {
    const dx = deXuatChoVuAn({
      ...trongRong,
      ngayKhoiTo: new Date('2020-01-01'),
      legacyRaw: { tom_tat_noi_dung: 'Ngày 27/10/2016 khởi tố vụ án.' },
    });
    expect(dx.find((d) => d.o === 'ngayKhoiTo')).toBeUndefined();
  });

  it('IDEMPOTENT: đã có dấu trích tự động lần trước → không đề xuất lại', () => {
    const dx = deXuatChoVuAn({
      ...trongRong,
      metadata: { trichTuDong: { ngayKhoiTo: { giaTri: '2016-10-27', dauVet: '...' } } },
      legacyRaw: { tom_tat_noi_dung: 'Ngày 27/10/2016 khởi tố vụ án.' },
    });
    expect(dx.find((d) => d.o === 'ngayKhoiTo')).toBeUndefined();
  });

  it('văn bản không có mốc tố tụng → không đề xuất gì', () => {
    expect(
      deXuatChoVuAn({ ...trongRong, legacyRaw: { tom_tat_noi_dung: 'Vụ trộm xảy ra tại quận 1.' } }),
    ).toEqual([]);
  });

  it('nguồn quá ngắn → mảng rỗng', () => {
    expect(deXuatChoVuAn({ ...trongRong, legacyRaw: { tom_tat_noi_dung: 'x' } })).toEqual([]);
  });
});
