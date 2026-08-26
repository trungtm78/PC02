import { plainToInstance } from 'class-transformer';
import { UpdatePetitionDto } from './update-petition.dto';
import { stripHtmlTags } from '../../common/utils/sanitize.util';

/**
 * `null` là tín hiệu "cán bộ đã XOÁ TRẮNG ô" — không được biến mất trên đường vào.
 *
 * Lớp dịch vụ chỉ ghi những khoá `!== undefined`. Nếu `@Transform` đổi `null` thành
 * `undefined` thì thao tác xoá bị nuốt ngay tại cổng vào: giao diện gửi đúng, máy chủ trả
 * thành công, mà cột vẫn giữ giá trị cũ.
 *
 * 30 trường trong DTO Đơn thư đi qua `stripHtmlTags`. Hàm ấy trả `undefined` cho cả `null`
 * lẫn `undefined`, nên nó gộp hai ý nghĩa khác hẳn nhau thành một: "không nhắc tới ô này" và
 * "xoá trắng ô này".
 *
 * `undefined` vào thì vẫn phải ra `undefined` — đó mới là "không nhắc tới".
 */
describe('Tín hiệu xoá trắng phải sống sót qua lớp làm sạch dữ liệu', () => {
  it('stripHtmlTags giữ nguyên null, chỉ undefined mới ra undefined', () => {
    expect(stripHtmlTags(null)).toBeNull();
    expect(stripHtmlTags(undefined)).toBeUndefined();
  });

  it('vẫn bóc thẻ HTML như cũ', () => {
    expect(stripHtmlTags('<b>Trộm cắp</b>')).toBe('Trộm cắp');
    expect(stripHtmlTags('  giữ nguyên  ')).toBe('giữ nguyên');
  });

  it.each([
    'raSoatTrung',
    'toiDanhBanDau',
    'nhanThay',
    'deXuat',
    'senderAddress',
    'ketQuaXuLyKhac',
  ])('trường "%s" gửi null thì tới lớp dịch vụ vẫn là null', (khoa) => {
    const dto = plainToInstance(UpdatePetitionDto, { [khoa]: null }) as Record<
      string,
      unknown
    >;
    expect(khoa in dto).toBe(true);
    expect(dto[khoa]).toBeNull();
  });

  it('không gửi khoá thì vẫn là "không nhắc tới", không thành null', () => {
    const dto = plainToInstance(UpdatePetitionDto, {}) as Record<string, unknown>;
    expect(dto['raSoatTrung']).toBeUndefined();
  });
});
