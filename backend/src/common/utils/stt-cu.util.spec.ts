import { dieuKienSttCu } from './stt-cu.util';

/**
 * Ô lọc "STT cũ" phải nhận đúng thứ cán bộ quen gõ ở hệ cũ.
 *
 * Hệ cũ (`_PC02/Modules/doi_1/act/list.php:140-151`) tách chuỗi tìm theo dấu `-`: gõ `2016-208`
 * thì nó lấy **vế sau** rồi `intval`, gõ `208` thì dùng thẳng. Nghĩa là cả hai cách gõ đều ra
 * cùng một hồ sơ.
 *
 * Hệ mới đang khớp chuỗi thô, nên cán bộ gõ theo thói quen cũ `2016-208` sẽ KHÔNG ra gì — và
 * không có gì báo là do cách gõ, họ sẽ kết luận hồ sơ không tồn tại.
 */
describe('dieuKienSttCu', () => {
  it('gõ số trần thì khớp số ấy', () => {
    expect(dieuKienSttCu('208')).toEqual({ contains: '208', mode: 'insensitive' });
  });

  it('gõ dạng năm-số như hệ cũ thì lấy VẾ SAU', () => {
    expect(dieuKienSttCu('2016-208')).toEqual({ contains: '208', mode: 'insensitive' });
  });

  it('bỏ số 0 đệm ở đầu — hệ cũ dùng intval nên `008` và `8` là một', () => {
    expect(dieuKienSttCu('2016-008')).toEqual({ contains: '8', mode: 'insensitive' });
    expect(dieuKienSttCu('008')).toEqual({ contains: '8', mode: 'insensitive' });
  });

  it('cắt khoảng trắng thừa', () => {
    expect(dieuKienSttCu('  208  ')).toEqual({ contains: '208', mode: 'insensitive' });
  });

  it('ô để trống trả undefined — KHÔNG thêm điều kiện nào', () => {
    // Thêm `contains: ''` là khớp mọi bản ghi mà trông như đang lọc.
    expect(dieuKienSttCu('')).toBeUndefined();
    expect(dieuKienSttCu('   ')).toBeUndefined();
    expect(dieuKienSttCu(undefined)).toBeUndefined();
  });

  it('vế sau rỗng (gõ mỗi "2016-") thì rơi về nguyên chuỗi, không thành lọc rỗng', () => {
    // `'2016-'.split('-')[1]` là chuỗi rỗng; lấy thẳng nó là biến bộ lọc thành khớp-tất-cả.
    expect(dieuKienSttCu('2016-')).toEqual({ contains: '2016-', mode: 'insensitive' });
  });

  it('chuỗi không phải số giữ nguyên — không đoán thay cán bộ', () => {
    expect(dieuKienSttCu('abc')).toEqual({ contains: 'abc', mode: 'insensitive' });
  });
});
