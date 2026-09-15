import { docThe, dungDieuKienTimKiem } from './dieu-kien';
import type { KhaiThucThe } from './sinh/sinh-tim-kiem';

const KHAI: KhaiThucThe = {
  thucThe: 'vu-an',
  bang: 'cases',
  model: 'Case',
  truong: [
    {
      key: 'doiTuongBiCan',
      nhan: 'Đối tượng bị can',
      kieu: 'doi-tuong',
      quanHe: 'subjects',
      loaiDoiTuong: 'SUSPECT',
    },
  ],
};

const dk = (tk: string[], luiCotGoc = true) =>
  dungDieuKienTimKiem(docThe(tk, KHAI), KHAI, { luiCotGoc });

/**
 * Thẻ Đối tượng bị can: có ÍT NHẤT MỘT đối tượng đúng loại, chưa xoá, tên khớp. Cột bóng
 * `subjects.full_name_bd` rỗng tới khi chạy CLI nạp → luôn lùi về `fullName` (bảng nhỏ).
 */
describe('dungDieuKienTimKiem — kiểu doi-tuong', () => {
  const mot = (bd: string, goc: string) => ({
    OR: [
      { fullNameBd: { contains: bd } },
      { fullNameBd: null, fullName: { contains: goc, mode: 'insensitive' } },
    ],
  });

  it('lọc quan hệ some theo loại, bỏ đã xoá, tên bỏ dấu + lùi cột gốc', () => {
    expect(dk(['doiTuongBiCan~Nguyễn Văn'])).toEqual([
      {
        subjects: {
          some: {
            deletedAt: null,
            type: 'SUSPECT',
            ...mot('nguyen van', 'Nguyễn Văn'),
          },
        },
      },
    ]);
  });

  it('nhiều giá trị cùng thẻ → OR giữa các điều kiện quan hệ', () => {
    const ra = dk(['doiTuongBiCan~An', 'doiTuongBiCan~Bình']);
    expect(ra).toHaveLength(1);
    expect((ra[0] as { OR: unknown[] }).OR).toHaveLength(2);
  });

  it('luiCotGoc: false vẫn giữ nhánh lùi (bảng nhỏ, cột bóng có thể chưa nạp)', () => {
    expect(dk(['doiTuongBiCan~An'], false)).toEqual(dk(['doiTuongBiCan~An']));
  });

  it('không có loaiDoiTuong → không lọc theo type', () => {
    const khongLoai: KhaiThucThe = {
      ...KHAI,
      truong: [{ ...KHAI.truong[0], loaiDoiTuong: undefined }],
    };
    const ra = dungDieuKienTimKiem(
      docThe(['doiTuongBiCan~An'], khongLoai),
      khongLoai,
    );
    expect(JSON.stringify(ra)).not.toContain('SUSPECT');
    expect(JSON.stringify(ra)).toContain('"deletedAt":null');
  });
});
