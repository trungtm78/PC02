import {
  sinhCacCauNap,
  sinhMigrationTimKiem,
  truongPrismaCanCo,
  type KhaiThucThe,
} from './sinh-tim-kiem';
import { cotDbLech } from './tep-sinh';
import { dungDieuKienTimKiem } from '../dieu-kien';

/**
 * `cotGhep` (kiểu `chu`): MỘT cột bóng ghép từ NHIỀU cột nguồn. Màn Quản lý người dùng hiện "Họ tên"
 * = họ + tên (+ tài khoản khi trống) — không có cột `hoTen` thật. Khai `cot: 'hoTen'` + `cotGhep`
 * cho ra đúng `users.ho_ten_bd` mà kiểu `nguoi` của các thực thể khác đã sinh (cùng biểu thức), nên
 * bộ sinh gộp làm một, không dựng cột/trigger thứ hai.
 */
const NGUOI_DUNG: KhaiThucThe = {
  thucThe: 'nguoi-dung',
  bang: 'users',
  model: 'User',
  truong: [
    {
      key: 'hoTen',
      nhan: 'Họ tên',
      kieu: 'chu',
      cot: 'hoTen',
      cotGhep: ['lastName', 'firstName', 'username'],
    },
    { key: 'email', nhan: 'Email', kieu: 'chu', cot: 'email' },
  ],
};

/** Một thực thể khác có thẻ kiểu người → cũng sinh `users.ho_ten_bd`. */
const DON_THU: KhaiThucThe = {
  thucThe: 'don-thu',
  bang: 'petitions',
  model: 'Petition',
  truong: [
    {
      key: 'nguoiNhap',
      nhan: 'Người nhập',
      kieu: 'nguoi',
      quanHe: 'enteredBy',
    },
  ],
};

describe('bộ sinh — cotGhep', () => {
  it('gán cột bóng từ biểu thức ghép; trigger nghe mọi cột nguồn; tất cả các cột ghép các nguồn', () => {
    const sql = sinhMigrationTimKiem([NGUOI_DUNG]);
    expect(sql).toContain(
      `NEW."ho_ten_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."lastName", NEW."firstName", NEW."username"));`,
    );
    expect(sql).toMatch(
      /BEFORE INSERT OR UPDATE OF "lastName", "firstName", "username", "email" ON "users"/,
    );
    expect(sql).toContain(
      `NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."lastName", NEW."firstName", NEW."username", NEW."email"));`,
    );
    expect(sql).not.toContain('NEW."hoTen"');
  });

  it('gộp với khối users của kiểu người (cùng biểu thức) — không lỗi, một hàm trigger', () => {
    const sql = sinhMigrationTimKiem([DON_THU, NGUOI_DUNG]);
    expect(
      sql.match(/CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_users\(\)/g),
    ).toHaveLength(1);
  });

  it('field Prisma User.hoTenBd khai một lần; câu nạp dùng biểu thức ghép', () => {
    const truong = truongPrismaCanCo([DON_THU, NGUOI_DUNG]).filter(
      (t) => t.model === 'User' && t.field === 'hoTenBd',
    );
    expect(truong).toEqual([
      { model: 'User', field: 'hoTenBd', cot: 'ho_ten_bd' },
    ]);
    const nap = sinhCacCauNap([NGUOI_DUNG]).find((n) => n.bang === 'users');
    expect(nap?.cau.nap).toContain(
      `"ho_ten_bd" = ' ' || f_bo_dau(concat_ws(' ', "lastName", "firstName", "username"))`,
    );
  });

  it('cotDbLech kiểm TỪNG cột nguồn, không đòi cột `hoTen` ảo', () => {
    const du =
      'model User {\n  lastName String?\n  firstName String?\n  username String\n  email String\n}\n';
    expect(cotDbLech(du, [NGUOI_DUNG])).toEqual([]);
    const thieu =
      'model User {\n  lastName String?\n  username String\n  email String\n}\n';
    expect(cotDbLech(thieu, [NGUOI_DUNG]).map((l) => l.field)).toEqual([
      'firstName',
    ]);
  });
});

describe('điều kiện — cotGhep', () => {
  it('lọc trên cột bóng ghép; nhánh lùi tìm TỪNG cột nguồn', () => {
    const ra = JSON.stringify(
      dungDieuKienTimKiem(
        [{ key: 'hoTen', giaTri: ['nguyen van'] }],
        NGUOI_DUNG,
        {
          luiCotGoc: true,
        },
      ),
    );
    expect(ra).toContain('"hoTenBd":{"contains":"nguyen van"}');
    expect(ra).toContain('"hoTenBd":null');
    expect(ra).toContain(
      '"lastName":{"contains":"nguyen van","mode":"insensitive"}',
    );
    expect(ra).toContain(
      '"firstName":{"contains":"nguyen van","mode":"insensitive"}',
    );
    expect(ra).toContain(
      '"username":{"contains":"nguyen van","mode":"insensitive"}',
    );
    expect(ra).not.toContain('"hoTen":');
  });
});
