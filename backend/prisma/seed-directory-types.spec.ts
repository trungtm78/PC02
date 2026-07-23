import { DIRECTORY_DATA } from './seed-directory-types';

/**
 * Chặn hồi quy cho 3 danh mục TỪNG BỊ BỎ QUÊN.
 *
 * `Subject.occupationId` / `nationalityId` / `districtId` đều là FK trỏ tới
 * `directories`, nhưng seed không hề tạo dòng nào cho ba loại này — kiểm chứng
 * trên CSDL prod: 20 loại danh mục, KHÔNG có OCCUPATION/NATIONALITY/DISTRICT.
 * Hệ quả: ô chọn nghề nghiệp/quốc tịch rỗng, và hồ sơ cũ trỏ tới quận/huyện đã
 * bãi bỏ thì không hiển thị được tên.
 *
 * Màn hình `/danh-muc` lấy danh sách loại bằng `distinct type` trên chính bảng
 * này (directory.service.ts findTypes), nên có dữ liệu là màn hình tự hiện —
 * không cần viết màn hình riêng cho từng danh mục.
 */
describe('seed danh mục — 3 loại từng bị bỏ quên', () => {
  const byType = (t: string) => DIRECTORY_DATA.filter((d) => d.type === t);

  it('OCCUPATION có đủ 7 nghề nghiệp theo dropdown hệ cũ', () => {
    const rows = byType('OCCUPATION');
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.name)).toEqual(
      expect.arrayContaining(['Công nhân', 'Nông dân', 'Học sinh, sinh viên', 'Công chức, viên chức']),
    );
  });

  it('NATIONALITY có Việt Nam / nước ngoài / chưa xác định', () => {
    expect(byType('NATIONALITY').map((r) => r.code).sort()).toEqual(['KXD', 'NN', 'VN']);
  });

  it('DISTRICT có đủ 22 quận/huyện cũ (bảng chi_nhanh hệ cũ, loai_don_vi=5)', () => {
    const rows = byType('DISTRICT');
    expect(rows).toHaveLength(22);
    expect(rows.map((r) => r.name)).toEqual(expect.arrayContaining(['Quận 1', 'Thủ Đức', 'Cần Giờ', 'Bình Chánh']));
  });

  it('không có cặp (type, code) trùng — vi phạm sẽ làm upsert seed ghi đè nhau', () => {
    const keys = DIRECTORY_DATA.map((d) => `${d.type}|${d.code}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('mọi dòng đều có tên và thứ tự dương', () => {
    for (const d of DIRECTORY_DATA) {
      expect(d.name.trim().length).toBeGreaterThan(0);
      expect(d.order).toBeGreaterThan(0);
    }
  });
});
