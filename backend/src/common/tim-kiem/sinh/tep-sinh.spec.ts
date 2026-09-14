import { thuMucMigrationTimKiemMoiNhat, truongPrismaThieu } from './tep-sinh';

describe('thuMucMigrationTimKiemMoiNhat', () => {
  it('chọn migration tìm kiếm có dấu thời gian lớn nhất, bỏ qua migration khác', () => {
    expect(
      thuMucMigrationTimKiemMoiNhat([
        '20260909150000_huong_xu_ly_don',
        '20260915100000_tim_kiem_don_thu',
        '20261001000000_tim_kiem_vu_viec',
        '99999999999999_init_rls',
        'migration_lock.toml',
      ]),
    ).toBe('20261001000000_tim_kiem_vu_viec');
  });

  it('không có migration tìm kiếm → undefined', () => {
    expect(
      thuMucMigrationTimKiemMoiNhat(['20260909150000_huong_xu_ly_don']),
    ).toBeUndefined();
  });

  it('tên sai dạng (thiếu dấu thời gian đủ 14 số) không được tính', () => {
    expect(
      thuMucMigrationTimKiemMoiNhat(['2026_tim_kiem_x', 'tim_kiem_x']),
    ).toBeUndefined();
  });
});

describe('truongPrismaThieu', () => {
  const schema = [
    'model Petition {',
    '  id String @id',
    '  /// CHỈ ĐỌC — cột bóng do trigger giữ',
    '  senderNameBd    String?   @map("sender_name_bd")',
    '}',
    '',
    'model User {',
    '  id String @id',
    '}',
  ].join('\n');

  it('field khai đúng → không thiếu; field chưa khai / model khác → thiếu', () => {
    expect(
      truongPrismaThieu(schema, [
        { model: 'Petition', field: 'senderNameBd', cot: 'sender_name_bd' },
        { model: 'Petition', field: 'timKiemBd', cot: 'tim_kiem_bd' },
        { model: 'User', field: 'hoTenBd', cot: 'ho_ten_bd' },
      ]),
    ).toEqual([
      { model: 'Petition', field: 'timKiemBd', cot: 'tim_kiem_bd' },
      { model: 'User', field: 'hoTenBd', cot: 'ho_ten_bd' },
    ]);
  });

  it('field nằm ở model KHÁC không được tính cho model cần', () => {
    expect(
      truongPrismaThieu(schema, [
        { model: 'User', field: 'senderNameBd', cot: 'sender_name_bd' },
      ]),
    ).toHaveLength(1);
  });

  it('@map sai tên cột → thiếu', () => {
    expect(
      truongPrismaThieu(schema, [
        { model: 'Petition', field: 'senderNameBd', cot: 'sender_bd' },
      ]),
    ).toHaveLength(1);
  });

  it('model không tồn tại → thiếu', () => {
    expect(
      truongPrismaThieu(schema, [{ model: 'Case', field: 'xBd', cot: 'x_bd' }]),
    ).toHaveLength(1);
  });
});
