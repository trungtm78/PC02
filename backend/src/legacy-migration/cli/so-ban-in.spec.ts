import PizZip from 'pizzip';
import { chuTrongDocx, soDong, mauChoLoai, thucTheChoMau, ganCanBoNhap } from './so-ban-in';

/**
 * Công cụ đối chiếu phải TỰ ĐÚNG trước đã.
 *
 * Bản đầu của nó báo 9 dòng lệch cho một hồ sơ mà thật ra chỉ có 1, vì hai lỗi của chính công
 * cụ: không giải mã `&quot;` (nên mọi câu có ngoặc kép thành "lệch"), và so theo vị trí (nên
 * một dòng thừa làm mọi dòng sau lệch theo). Báo động giả kiểu ấy chôn vùi những chỗ lệch thật
 * — nguy hiểm hơn là không có công cụ.
 */

function docxGia(doanVan: string[]): Buffer {
  const than = doanVan
    .map((d) => `<w:p><w:r><w:t>${d}</w:t></w:r></w:p>`)
    .join('');
  const zip = new PizZip();
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document><w:body>${than}</w:body></w:document>`);
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

describe('Bóc chữ khỏi tệp Word', () => {
  /**
   * PhpWord nhét thẳng dấu `"` vào XML, docxtemplater mã hoá thành `&quot;`. Hai cách viết
   * KHÁC nhau của CÙNG một ký tự — Word hiện y như nhau. Không giải mã là công cụ tự bịa ra
   * hàng nghìn chỗ lệch.
   */
  it('giải mã đủ thực thể XML, không báo lệch giả', () => {
    const a = chuTrongDocx(docxGia(['bút phê: "K/c TP PC02" &amp; xong']));
    const b = chuTrongDocx(docxGia(['bút phê: &quot;K/c TP PC02&quot; &amp; xong']));
    expect(a).toEqual(b);
    expect(a[0]).toBe('bút phê: "K/c TP PC02" & xong');
  });

  it('`&amp;` giải mã SAU cùng, không tạo thực thể ma', () => {
    // `&amp;quot;` là chuỗi chữ `&quot;`, KHÔNG phải dấu ngoặc kép. Giải mã `&amp;` trước là
    // biến nó thành `&quot;` rồi thành `"` — sai hẳn nội dung.
    expect(chuTrongDocx(docxGia(['&amp;quot; là cách viết']))[0]).toBe('&quot; là cách viết');
  });

  it('mỗi đoạn Word là một dòng, bỏ dòng trống', () => {
    expect(chuTrongDocx(docxGia(['một', '', '  ', 'hai']))).toEqual(['một', 'hai']);
  });
});

describe('So hai bản in', () => {
  it('giống nhau thì không lệch', () => {
    expect(soDong(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([]);
  });

  /**
   * ĐIỀU QUAN TRỌNG NHẤT. Hệ cũ in nguyên `${yeu_cau_bo_sung}` khi hồ sơ thiếu khoá, hệ mới để
   * trống — chênh nhau ĐÚNG một dòng. So theo vị trí thì mọi dòng sau đó lệch theo và báo cáo
   * ra 9 chỗ sai trong khi chỉ có 1.
   */
  it('một dòng thừa KHÔNG làm các dòng sau lệch theo', () => {
    const lech = soDong(['a', '${x}', 'b', 'c', 'd'], ['a', 'b', 'c', 'd']);
    expect(lech).toEqual([{ kieu: 'thieu', heCu: '${x}', heMoi: '' }]);
  });

  it('dòng bị sửa hiện thành một cặp, không thành hai chỗ rời', () => {
    expect(soDong(['a', 'cũ', 'c'], ['a', 'mới', 'c'])).toEqual([
      { kieu: 'sua', heCu: 'cũ', heMoi: 'mới' },
    ]);
  });

  it('dòng chỉ có ở hệ mới thì báo là thừa', () => {
    expect(soDong(['a', 'b'], ['a', 'x', 'b'])).toEqual([
      { kieu: 'thua', heCu: '', heMoi: 'x' },
    ]);
  });

  it('hai bên rỗng thì không lệch', () => {
    expect(soDong([], [])).toEqual([]);
  });
});

/**
 * Bảng `loai → mẫu` chép từ `xuatfile.php`. Điểm dễ bỏ sót: `loai` THẬT trong dữ liệu rộng hơn
 * bảng ấy, nên năm giá trị hay gặp nhất của Vụ việc/Vụ án đều rơi về mẫu mặc định.
 */
describe('Chọn mẫu theo loại hồ sơ', () => {
  it.each([
    ['don_thu', 'don_thu_mau.docx'],
    ['tra_ho_so', 'tra_ho_so_mau.docx'],
    ['luat_su', 'dang_ky_bao_chua_mau.docx'],
    ['huong_dan', 'huong_dan_mau.docx'],
  ])('`%s` dùng `%s`', (loai, mau) => {
    expect(mauChoLoai(loai)).toBe(mau);
  });

  /**
   * Đo 28/08/2026 trên 55.067 hồ sơ: năm giá trị dưới đây KHÔNG có trong bảng ánh xạ của hệ cũ
   * nên chúng rơi về `vu_an_mau.docx`. Hệ quả: `vu_viec_mau.docx` chưa từng được hệ cũ dùng lần
   * nào — hồ sơ Vụ việc của hệ cũ in bằng mẫu Vụ án.
   */
  it.each([
    'vu_viec_da_phan_loai',
    'vu_viec_phuong_xa',
    'vu_an_da_phan_loai',
    'vu_an_phuong_xa',
    'kien_nghi_vks',
  ])('`%s` rơi về mẫu mặc định vu_an_mau.docx', (loai) => {
    expect(mauChoLoai(loai)).toBe('vu_an_mau.docx');
  });

  it('loại rỗng hay lạ vẫn ra mẫu mặc định, không ném', () => {
    expect(mauChoLoai('')).toBe('vu_an_mau.docx');
    expect(mauChoLoai(undefined)).toBe('vu_an_mau.docx');
  });

  it('mẫu nào tra khoá theo thực thể nấy', () => {
    expect(thucTheChoMau('vu_an_mau.docx')).toBe('VU_AN');
    expect(thucTheChoMau('vu_viec_mau.docx')).toBe('VU_VIEC');
    expect(thucTheChoMau('don_thu_mau.docx')).toBe('DON_THU');
  });
});

/**
 * `${nguoi_nhan}` và `${ten_ngan}` không nằm trong hồ sơ — hệ cũ tra bảng cán bộ rồi điền
 * riêng. Giàn thử không gắn cán bộ thì công cụ báo dòng "Lưu:" là lệch, trong khi máy thật in
 * đúng (đo 28/08/2026: cả 47.169 đơn thư trên máy thật đều đã gắn cán bộ nhập).
 */
describe('Gắn cán bộ nhập cho giàn thử', () => {
  it('tách họ tên theo quy ước hệ mới: chữ cuối là tên gọi', () => {
    const bg: Record<string, unknown> = {};
    ganCanBoNhap(bg, 'Phạm Trường Thanh');
    expect(bg['enteredBy']).toEqual({ firstName: 'Thanh', lastName: 'Phạm Trường' });
  });

  it('tên rỗng thì không gắn gì, không dựng bản ghi hỏng', () => {
    const bg: Record<string, unknown> = {};
    ganCanBoNhap(bg, '   ');
    expect(bg['enteredBy']).toBeUndefined();
  });
});
