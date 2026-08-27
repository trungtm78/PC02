import { decomposeLegacyRecord } from './legacy-mapper';

/**
 * Ô nội dung của hồ sơ di trú KHÔNG được trắng.
 *
 * Hệ cũ có đúng một ô nội dung (`tom_tat_noi_dung`). Form Đơn thư hiện nó ở ô "Tóm tắt nội
 * dung", và ô ấy đọc `detailContent` — `summary` bị ẩn, được suy lại từ `detailContent` mỗi
 * lần lưu. Bản di trú chỉ đổ vào `summary`, nên cán bộ mở hồ sơ ra thấy ô nội dung trắng dù
 * chữ vẫn nằm trong bảng, và bấm Lưu thì bị chặn vì "Nội dung là bắt buộc".
 *
 * Đo trên máy chạy 27/08/2026: cả 46.499 hồ sơ di trú đều vướng — tức KHÔNG hồ sơ cũ nào sửa
 * và lưu lại được.
 */
describe('Nội dung hồ sơ di trú phải nạp được lên form', () => {
  const rec = {
    id: '1',
    _id: '1',
    tom_tat_noi_dung: 'Tố giác hành vi lừa đảo chiếm đoạt tài sản',
    phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau',
  } as Record<string, unknown>;

  const donThu = (r: Record<string, unknown>) =>
    (decomposeLegacyRecord(r as never).petition ?? {}) as Record<string, unknown>;

  it('đổ vào ô form đọc, không chỉ ô bị ẩn', () => {
    expect(donThu(rec).detailContent).toBe('Tố giác hành vi lừa đảo chiếm đoạt tài sản');
  });

  it('vẫn giữ `summary` — hai ô cùng một chữ, không ô nào bị bỏ trống', () => {
    const p = donThu(rec);
    expect(p.summary).toBe(p.detailContent);
  });

  it('hệ cũ không có nội dung thì không bịa chuỗi rỗng', () => {
    const p = donThu({ id: '2', _id: '2', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau' });
    expect(p.detailContent).toBeUndefined();
  });
});
