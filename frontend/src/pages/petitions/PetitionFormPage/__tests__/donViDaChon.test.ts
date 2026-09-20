import { describe, expect, it } from 'vitest';
import { giuDonViDaChon } from '../donViDaChon';

/*
  Ô "Đơn vị xử lý" ở hướng Giao đơn / Trả đơn-Lưu đơn chọn từ danh sách Tổ/Nhóm nội bộ, nhưng
  CỘT `donViGiaiQuyet` là CHỮ TỰ DO và phần lớn giá trị trong đó đến từ hệ cũ.

  Đo prod 20/09/2026: 47.484 đơn có Đơn vị xử lý, **30.285 đơn (64%) mang tên KHÔNG khớp tổ
  nội bộ nào** — "Phòng PC46 CATP Hồ Chí Minh", "PC01 Công an TP Hồ Chí Minh"…

  `FKSelect` không tìm thấy giá trị trong `options` thì hiện PLACEHOLDER, nên 30.285 hồ sơ ấy
  mở ra trông như ô RỖNG dù trong CSDL có giá trị. Cán bộ thấy ô trống sẽ chọn một tổ khác rồi
  bấm Cập nhật — đơn vị gốc bị ghi đè, không ai bấm gì để gây ra chuyện đó.

  Cùng lớp lỗi với cán bộ đã khoá rơi khỏi ô chọn, và cùng cách vá: GHIM giá trị đang có.
*/
describe('giuDonViDaChon', () => {
  const ds = [
    { value: 'Tổ công tác Số 2', label: 'Tổ công tác Số 2' },
    { value: 'PC02', label: 'PC02' },
  ];

  it('giá trị KHÔNG có trong danh sách vẫn được giữ, ghim lên đầu', () => {
    const ra = giuDonViDaChon(ds, 'Phòng PC46 CATP Hồ Chí Minh');
    expect(ra[0].value).toBe('Phòng PC46 CATP Hồ Chí Minh');
    expect(ra).toHaveLength(3);
  });

  it('nhãn nói RÕ đây là giá trị đang lưu, không giả vờ là một tổ', () => {
    const ra = giuDonViDaChon(ds, 'Phòng PC46 CATP Hồ Chí Minh');
    expect(ra[0].label).toContain('Phòng PC46 CATP Hồ Chí Minh');
    expect(ra[0].label).toMatch(/ngoài danh sách|đang lưu/i);
  });

  it('giá trị ĐÃ có trong danh sách thì không nhân đôi', () => {
    expect(giuDonViDaChon(ds, 'PC02')).toEqual(ds);
  });

  it('rỗng thì giữ nguyên danh sách', () => {
    expect(giuDonViDaChon(ds, '')).toEqual(ds);
    expect(giuDonViDaChon(ds, '   ')).toEqual(ds);
  });

  it('so khớp KHÔNG phân biệt khoảng trắng thừa hai đầu', () => {
    // Dữ liệu hệ cũ nhiều dòng có khoảng trắng đuôi; ghim thêm một mục trùng nghĩa là ô chọn
    // hiện hai dòng nhìn giống hệt nhau.
    expect(giuDonViDaChon(ds, '  PC02  ')).toEqual(ds);
  });
});
