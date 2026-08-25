import { personName, rankName, abbrevName } from './field-catalog';

/**
 * Thứ tự họ tên trên CHỨNG TỪ CHÍNH THỨC — họ trước, tên sau.
 *
 * Anh báo 25/08/2026 qua ô "Điều tra viên chính": tên hiện "Đông Phường An Hội" thay vì
 * "Phường An Hội Đông". Gốc bệnh là ghép `[firstName, lastName]` theo quy ước tiếng Anh,
 * trong khi cơ sở dữ liệu lưu `lastName` = họ và tên đệm, `firstName` = tên gọi.
 *
 * Ở tệp này hậu quả nặng hơn màn hình: đây là nguồn dữ liệu cho MẪU WORD, nên tên cán bộ in
 * ra văn bản gửi đi cũng sai. Dữ liệu trong ca kiểm lấy nguyên văn từ bản chạy thật.
 */
describe('personName — họ trước, tên sau', () => {
  it('ghép đúng thứ tự tiếng Việt', () => {
    expect(personName({ firstName: 'Đông', lastName: 'Phường An Hội' })).toBe('Phường An Hội Đông');
    expect(personName({ firstName: 'Trung', lastName: 'Hà Minh' })).toBe('Hà Minh Trung');
  });

  it('KHÔNG ra thứ tự cũ — ca kiểm chặn việc lật ngược lại', () => {
    expect(personName({ firstName: 'Đông', lastName: 'Phường An Hội' })).not.toBe(
      'Đông Phường An Hội',
    );
  });

  it('thiếu một trường thì không để lại khoảng trắng thừa', () => {
    expect(personName({ firstName: 'An', lastName: null })).toBe('An');
    expect(personName({ firstName: null, lastName: 'Nguyễn Văn' })).toBe('Nguyễn Văn');
  });

  it('không có người → chuỗi rỗng', () => {
    expect(personName(null)).toBe('');
  });
});

describe('rankName — cấp bậc đứng trước họ tên', () => {
  it('cấp bậc rồi mới tới họ tên', () => {
    expect(rankName({ rank: 'Thiếu tá', firstName: 'Tây', lastName: 'Phường An Hội' })).toBe(
      'Thiếu tá Phường An Hội Tây',
    );
  });
});

/**
 * `abbrevName` dựng dòng "Lưu:" của văn bản bằng cách lấy HAI TỪ CUỐI của họ tên.
 *
 * Chú thích sẵn trong mã ghi ví dụ "Phạm Văn Huy" → "V.Huy" — tức tác giả biết thứ tự đúng là
 * họ trước. Nhưng `personName` trả ngược nên nó nhận "Huy Phạm Văn" và cho ra "P.Văn": sai cả
 * chữ cái viết tắt lẫn tên gọi, ngay trên văn bản gửi đi.
 */
describe('abbrevName — hệ quả kéo theo của thứ tự họ tên', () => {
  it('"Phạm Văn Huy" → "V.Huy" đúng như chú thích trong mã', () => {
    expect(abbrevName({ firstName: 'Huy', lastName: 'Phạm Văn' })).toBe('V.Huy');
  });

  it('KHÔNG ra "P.Văn" — kết quả của thứ tự ngược', () => {
    expect(abbrevName({ firstName: 'Huy', lastName: 'Phạm Văn' })).not.toBe('P.Văn');
  });

  it('tên chỉ có một từ thì trả nguyên từ ấy', () => {
    expect(abbrevName({ firstName: 'Huy', lastName: null })).toBe('Huy');
  });
});
