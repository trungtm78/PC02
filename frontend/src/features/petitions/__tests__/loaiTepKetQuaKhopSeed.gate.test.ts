import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LOAI_TEP_KET_QUA } from '../loai-tep.def';

/**
 * CỔNG: mã loại tài liệu của khu "Tệp nhận từ đơn vị xử lý" phải CÓ THẬT trong seed danh mục.
 *
 * Mã này là một chuỗi, và chuỗi thì gõ sai không ai biết: trình duyệt lọc theo mã không tồn tại
 * sẽ trả về danh sách RỖNG chứ không báo lỗi — khu tệp hiện ra trống trơn, ô chọn loại không có
 * lựa chọn nào, và cán bộ kết luận "chức năng hỏng" trong khi mọi ca kiểm đều xanh.
 *
 * Đây đúng lớp "khe hở giữa bộ nạp và bộ đọc" dự án đã vấp: hai phía cùng một quy ước thì phải
 * có một phép đo nối hai phía, không phải hai hằng số chép tay.
 */
const GOC = path.resolve(__dirname, '..', '..', '..', '..', '..');
const SEED = path.join(GOC, 'backend', 'prisma', 'seed-directory-types.ts');

describe('CỔNG: mã loại tệp kết quả khớp seed danh mục', () => {
  const src = fs.readFileSync(SEED, 'utf8');

  it('đọc được tệp seed và thấy nhóm DOCUMENT_TYPE', () => {
    expect(src.length).toBeGreaterThan(100);
    expect(src.split("type: 'DOCUMENT_TYPE'").length - 1).toBeGreaterThanOrEqual(5);
  });

  it('mã của khu tệp kết quả có mặt trong seed', () => {
    const co = new RegExp(
      `type: 'DOCUMENT_TYPE',\s*code: '${LOAI_TEP_KET_QUA}'`,
    ).test(src.replace(/\s+/g, ' ').replace(/, /g, ',\n '));
    // So trên chuỗi đã chuẩn hoá khoảng trắng — seed căn cột bằng nhiều dấu cách.
    const goN = src.replace(/\s+/g, ' ');
    expect(
      goN.includes(`type: 'DOCUMENT_TYPE', code: '${LOAI_TEP_KET_QUA}'`) || co,
    ).toBe(true);
  });

  it('mã không rỗng và viết hoa gạch dưới như mọi mã danh mục khác', () => {
    expect(LOAI_TEP_KET_QUA).toMatch(/^[A-Z][A-Z0-9_]+$/);
  });
});
