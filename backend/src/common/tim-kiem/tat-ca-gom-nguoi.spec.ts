import { dungDieuKienTimKiem } from './dieu-kien';
import { sinhCauConChuaNap, type KhaiThucThe } from './sinh/sinh-tim-kiem';
import { KHAI_TIM_KIEM_NHAT_KY } from './khai/nhat-ky.khai';

/**
 * Tuỳ chọn khai `tatCaGomNguoi`: thẻ "tất cả các cột" tìm CẢ tên người qua quan hệ (kiểu `nguoi`).
 *
 * Mặc định thẻ "*" chỉ hỏi cột ghép `tim_kiem_bd` của bảng — một điều kiện dùng GIN. Nhật ký hoạt động
 * không có cột chữ nào ngoài mã (CASE_CREATED, id, IP), nên "*" không ra tên người thực hiện — đúng
 * thứ ô tìm cũ hứa. Bật theo từng khai chứ không bật chung: thêm OR qua quan hệ users trên bảng 47k
 * đơn thư làm mất chỉ mục của cột ghép.
 */
const NHAT_KY: KhaiThucThe = {
  thucThe: 'nhat-ky-thu',
  bang: 'audit_logs',
  model: 'AuditLog',
  tatCaGomNguoi: true,
  truong: [
    { key: 'nguoi', nhan: 'Người', kieu: 'nguoi', quanHe: 'user' },
    { key: 'thaoTac', nhan: 'Thao tác', kieu: 'ma-thuong', cot: 'action' },
  ],
};

const NGUOI_CHUA = (mau: string, goc: string) => ({
  user: {
    is: {
      OR: [
        { hoTenBd: { contains: mau } },
        {
          hoTenBd: null,
          OR: ['lastName', 'firstName', 'username'].map((c) => ({
            [c]: { contains: goc, mode: 'insensitive' },
          })),
        },
      ],
    },
  },
});

describe('điều kiện — "*" gồm tên người (tatCaGomNguoi)', () => {
  it('bật → "*" là cột ghép HOẶC tên người qua quan hệ', () => {
    expect(
      dungDieuKienTimKiem([{ key: '*', giaTri: ['Nguyễn'] }], NHAT_KY, {
        luiCotGoc: false,
      }),
    ).toEqual([
      {
        OR: [
          { timKiemBd: { contains: 'nguyen' } },
          NGUOI_CHUA('nguyen', 'Nguyễn'),
        ],
      },
    ]);
  });

  it('bật + còn dòng chưa nạp → thêm nhánh lùi cột gốc, vẫn gồm tên người', () => {
    // Giá trị ≥3 ký tự: 1–2 ký tự là khớp đầu từ (mẫu có khoảng trắng đầu) — ca riêng ở dieu-kien.spec.
    const [dk] = dungDieuKienTimKiem([{ key: '*', giaTri: ['binh'] }], NHAT_KY);
    const or = (dk as { OR: unknown[] }).OR;
    expect(or).toContainEqual({ timKiemBd: { contains: 'binh' } });
    expect(or).toContainEqual(NGUOI_CHUA('binh', 'binh'));
    expect(JSON.stringify(or)).toContain('"timKiemBd":null');
  });

  it('không bật → "*" chỉ hỏi cột ghép (không đổi hành vi các khai khác)', () => {
    const khong: KhaiThucThe = { ...NHAT_KY, tatCaGomNguoi: false };
    expect(
      dungDieuKienTimKiem([{ key: '*', giaTri: ['nguyen'] }], khong, {
        luiCotGoc: false,
      }),
    ).toEqual([{ timKiemBd: { contains: 'nguyen' } }]);
  });

  it('bật mà khai không có trường kiểu nguoi → khai sai, báo lỗi', () => {
    expect(() =>
      sinhCauConChuaNap({
        ...NHAT_KY,
        truong: [NHAT_KY.truong[1]],
      }),
    ).toThrow(/tatCaGomNguoi/);
  });

  it('khai Nhật ký hoạt động thật bật tuỳ chọn — "*" ra tên người thực hiện', () => {
    expect(KHAI_TIM_KIEM_NHAT_KY.tatCaGomNguoi).toBe(true);
  });
});

describe('điều kiện — "*" gồm trường quan hệ (tatCaGomQuanHe)', () => {
  it('khai trỏ tới khoá không phải quan-he/doi-tuong → khai sai, báo lỗi', () => {
    expect(() =>
      sinhCauConChuaNap({ ...NHAT_KY, tatCaGomQuanHe: ['khongCo'] }),
    ).toThrow(/tatCaGomQuanHe/);
  });
});
