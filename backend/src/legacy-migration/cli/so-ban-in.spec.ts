import PizZip from 'pizzip';
import { dinhDangDoan, manhChuTrongDocx, soKieuChu, chuTrongDocx, soDong, mauChoLoai, thucTheChoMau, ganCanBoNhap } from './so-ban-in';

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

  /**
   * Đoạn TRỐNG được GIỮ, không bị bỏ như bản trước.
   *
   * Đoạn trống là thứ làm bản in dãn ra hay dồn lại; bỏ nó đi thì một bản in thưa và một bản
   * in dày cho ra đúng một mảng. Ca kiểm này trước đây chốt đúng quy ước mù ấy.
   */
  it('mỗi đoạn Word là một mục, GIỮ cả đoạn trống', () => {
    expect(chuTrongDocx(docxGia(['một', '', '  ', 'hai']))).toEqual(['một', '', '', 'hai']);
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

/**
 * CHỖ MÙ ĐÃ ĐỂ LỌT KẾT LUẬN "0 CHỖ LỆCH" NGÀY 28/08.
 *
 * Hệ cũ (`xuatfile.php`) đổi mỗi lần xuống dòng trong ô nhiều dòng thành MỘT ĐOẠN Word mới,
 * có thụt đầu dòng và căn đều. Hệ mới dùng ngắt dòng mềm `<w:br/>` — cùng chữ, khác hẳn cách
 * trình bày. Ảnh hưởng 15.338 hồ sơ có `tom_tat_noi_dung` nhiều dòng.
 *
 * Bản trước của bộ bóc chữ đổi CẢ `</w:p>` LẪN `<w:br/>` thành `\n`, nên hai bản in ấy cho ra
 * đúng một danh sách dòng và công cụ báo "khớp". Báo cáo cũ xếp khác biệt này là "trình bày,
 * không phải dữ liệu" rồi bỏ qua — nhưng mở hai tệp đặt cạnh nhau thì đó là thứ đập vào mắt.
 */
function docxNgatDongMem(dong: string[]): Buffer {
  const than = `<w:p><w:r>${dong.map((d) => `<w:t>${d}</w:t>`).join('<w:br/>')}</w:r></w:p>`;
  const zip = new PizZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document><w:body>${than}</w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

describe('Bóc chữ — phân biệt ĐOẠN thật với ngắt dòng mềm', () => {
  it('ba đoạn Word KHÁC một đoạn có hai ngắt dòng mềm', () => {
    const heCu = chuTrongDocx(docxGia(['dòng một', 'dòng hai', 'dòng ba']));
    const heMoi = chuTrongDocx(docxNgatDongMem(['dòng một', 'dòng hai', 'dòng ba']));

    // Cùng chữ, khác cấu trúc. Bằng nhau nghĩa là công cụ vẫn mù.
    expect(heMoi).not.toEqual(heCu);
    expect(soDong(heCu, heMoi).length).toBeGreaterThan(0);
  });

  it('cùng cấu trúc thì vẫn khớp — không sinh báo động giả', () => {
    const a = chuTrongDocx(docxGia(['dòng một', 'dòng hai']));
    const b = chuTrongDocx(docxGia(['dòng một', 'dòng hai']));

    expect(soDong(a, b)).toEqual([]);
  });

  it('đoạn RỖNG cũng phải đếm — hệ cũ chèn đoạn trống thì bản in dãn ra', () => {
    // `.filter(Boolean)` của bản trước nuốt hẳn đoạn trống, nên một bản in thưa và một bản in
    // dày trông y hệt nhau.
    const co = chuTrongDocx(docxGia(['trên', '', 'dưới']));
    const khong = chuTrongDocx(docxGia(['trên', 'dưới']));

    expect(co).not.toEqual(khong);
  });
});

/**
 * Định dạng đoạn trả RIÊNG khỏi chữ.
 *
 * Gộp định dạng vào chính chuỗi chữ thì mọi dòng đều lệch khi hai hệ dùng kiểu chữ khác nhau,
 * và khác biệt DỮ LIỆU chìm nghỉm trong đó. Đây là lý do có hai hàm chứ không một.
 */
function docxCoDinhDang(doanVan: { chu: string; canLe?: string; thut?: number }[]): Buffer {
  const than = doanVan
    .map((d) => {
      const pPr =
        d.canLe || d.thut
          ? `<w:pPr>${d.canLe ? `<w:jc w:val="${d.canLe}"/>` : ''}${
              d.thut ? `<w:ind w:firstLine="${d.thut}"/>` : ''
            }</w:pPr>`
          : '';
      return `<w:p>${pPr}<w:r><w:t>${d.chu}</w:t></w:r></w:p>`;
    })
    .join('');
  const zip = new PizZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document><w:body>${than}</w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

describe('dinhDangDoan', () => {
  it('đọc căn lề và thụt đầu dòng của từng đoạn', () => {
    const dd = dinhDangDoan(
      docxCoDinhDang([{ chu: 'a', canLe: 'both', thut: 720 }, { chu: 'b' }]),
    );

    expect(dd).toEqual([
      { canLe: 'both', thutDauDong: 720 },
      { canLe: '', thutDauDong: 0 },
    ]);
  });

  it('số đoạn định dạng KHỚP số đoạn chữ — hai bảng phải căn được với nhau', () => {
    const b = docxCoDinhDang([{ chu: 'a' }, { chu: '' }, { chu: 'c', canLe: 'center' }]);

    expect(dinhDangDoan(b)).toHaveLength(chuTrongDocx(b).length);
  });

  it('cùng chữ nhưng KHÁC căn lề vẫn phân biệt được — đây là thứ phép so cũ không thấy', () => {
    const cu = docxCoDinhDang([{ chu: 'Nội dung', canLe: 'both', thut: 720 }]);
    const moi = docxCoDinhDang([{ chu: 'Nội dung' }]);

    expect(chuTrongDocx(cu)).toEqual(chuTrongDocx(moi));
    expect(dinhDangDoan(cu)).not.toEqual(dinhDangDoan(moi));
  });
});

/**
 * KIỂU CHỮ — tầng thứ ba của phép so, và là tầng anh bắt được lỗi.
 *
 * Đặt hai bản in cạnh nhau ngày 09/09/2026: hệ cũ không đậm, hệ mới đậm. Phép so CHỮ không
 * thấy (chữ giống hệt); phép so ĐOẠN cũng không thấy (đậm là thuộc tính của run). Ba tầng phải
 * có đủ ba phép so, nếu không mỗi lần vá một tầng lại lộ ra tầng kế bên.
 */
function docxKieuChu(manh: { chu: string; dam?: boolean; ngh?: boolean; gach?: boolean; co?: string }[]): Buffer {
  const runs = manh
    .map((m) => {
      const rPr =
        m.dam || m.ngh || m.gach || m.co
          ? `<w:rPr>${m.dam ? '<w:b/>' : ''}${m.ngh ? '<w:i/>' : ''}${
              m.gach ? '<w:u w:val="single"/>' : ''
            }${m.co ? `<w:sz w:val="${m.co}"/>` : ''}</w:rPr>`
          : '';
      return `<w:r>${rPr}<w:t>${m.chu}</w:t></w:r>`;
    })
    .join('');
  const zip = new PizZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document><w:body><w:p>${runs}</w:p></w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

describe('manhChuTrongDocx', () => {
  it('gộp các run liền nhau CÙNG kiểu — nếu không thì mọi đoạn đều báo lệch giả', () => {
    // Hệ cũ cắt một câu thành nhiều run cùng kiểu; hệ mới gộp thành một. Nhìn y hệt nhau.
    const nhieu = manhChuTrongDocx(
      docxKieuChu([{ chu: 'Giao' }, { chu: 'Công an' }, { chu: 'phường' }]),
    );
    const mot = manhChuTrongDocx(docxKieuChu([{ chu: 'Giao Công an phường' }]));

    expect(nhieu[0]).toHaveLength(1);
    expect(nhieu).toEqual(mot);
  });

  it('đọc đủ đậm · nghiêng · gạch chân · cỡ chữ', () => {
    const m = manhChuTrongDocx(
      docxKieuChu([{ chu: 'A', dam: true, gach: true, co: '28' }, { chu: 'B' }]),
    )[0];

    expect(m[0]).toEqual({ chu: 'A', dam: true, nghieng: false, gachChan: true, co: '28' });
    expect(m[1].dam).toBe(false);
  });
});

describe('soKieuChu', () => {
  /** Chính đoạn "Đề xuất" của mẫu `HE_CU_VU_AN`, hồ sơ 69971 — dựng lại từ bản in thật. */
  const HE_CU = docxKieuChu([
    { chu: 'Đề xuất', dam: true, gach: true },
    { chu: ':' , dam: true },
    { chu: 'Giao' },
    { chu: 'Công an phường Hòa Hưng', dam: true },
    { chu: 'tiếp nhận thụ lý' },
  ]);

  it('nhãn đậm trùm lên cả câu → BÁO lệch, kèm chữ để đọc được là chỗ nào', () => {
    const heMoi = docxKieuChu([
      { chu: 'Đề xuất', dam: true, gach: true },
      { chu: ':', dam: true, gach: true },
      { chu: 'Giao', dam: true, gach: true },
      { chu: 'Công an phường Hòa Hưng', dam: true, gach: true },
      { chu: 'tiếp nhận thụ lý', dam: true, gach: true },
    ]);

    const lech = soKieuChu(manhChuTrongDocx(HE_CU), manhChuTrongDocx(heMoi));

    // Nhãn "Đề xuất" hai bên giống nhau (đậm + gạch chân), nên chỗ lệch ĐẦU là dấu hai chấm.
    expect(lech.length).toBeGreaterThan(0);
    expect(lech[0]).toMatchObject({ chu: ':', heCu: 'đậm', heMoi: 'đậm + gạch chân' });
    // Và chỗ đáng kể nhất: phần chữ thường của hệ cũ bị hệ mới in đậm.
    expect(lech.some((l) => l.chu.includes('Giao') && l.heCu === 'thường')).toBe(true);
  });

  it('hai bản giống nhau → không lệch', () => {
    expect(soKieuChu(manhChuTrongDocx(HE_CU), manhChuTrongDocx(HE_CU))).toEqual([]);
  });

  it('khác CHỮ thì im lặng — đó là việc của phép so chữ, báo hai lần là đếm đôi', () => {
    const khac = docxKieuChu([{ chu: 'Chuyện khác hẳn' }]);

    expect(soKieuChu(manhChuTrongDocx(HE_CU), manhChuTrongDocx(khac))).toEqual([]);
  });
});
