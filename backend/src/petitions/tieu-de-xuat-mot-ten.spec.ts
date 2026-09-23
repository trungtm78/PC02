import * as fs from 'fs';
import * as path from 'path';
import { TIEU_DE_XUAT_DON_THU } from './petitions.service';

/**
 * CỔNG: cả hai đường xuất Đơn thư in CÙNG MỘT tên văn bản.
 *
 * Anh yêu cầu 23/09/2026 bỏ "— ĐẦY ĐỦ TRƯỜNG" khỏi tiêu đề. "Đầy đủ trường" là chuyện kỹ thuật
 * của bảng cột, không phải tên văn bản: tệp này in ra dưới quốc hiệu và gửi trong ngành. Hai
 * lần xuất phân biệt nhau bằng TÊN TỆP, không bằng chữ kỹ thuật trên đầu văn bản.
 */
describe('CỔNG: tiêu đề tệp xuất Đơn thư', () => {
  const src = fs.readFileSync(
    path.join(__dirname, 'petitions.service.ts'),
    'utf8',
  );

  it('hằng tên văn bản đúng bằng tên nghiệp vụ', () => {
    expect(TIEU_DE_XUAT_DON_THU).toBe('DANH SÁCH ĐƠN THƯ');
  });

  it('KHÔNG còn chữ kỹ thuật nào trên tiêu đề', () => {
    expect(src).not.toContain('ĐẦY ĐỦ TRƯỜNG');
  });

  /**
   * Hai chuỗi chép tay là hai chỗ để lệch nhau. Cổng đòi cả hai đường xuất dùng CHUNG một hằng.
   */
  it('cả hai đường xuất dùng chung MỘT hằng, không chép tay', () => {
    const dung = src.split('tieuDe: TIEU_DE_XUAT_DON_THU').length - 1;
    expect(dung).toBe(2);
    // Đường xuất theo phường/xã là văn bản KHÁC, có tên riêng — không gộp nhầm.
    expect(src).toContain('DANH SÁCH ĐƠN THƯ THEO PHƯỜNG/XÃ');
  });
});
