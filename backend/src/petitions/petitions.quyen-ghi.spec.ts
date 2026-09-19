import { ForbiddenException } from '@nestjs/common';
import { PetitionsService } from './petitions.service';

/**
 * Form sửa Đơn thư báo "chỉ xem" ngay khi mở thay vì để cán bộ nhập xong mới nhận 403 — cùng cách Vụ án (#439) và
 * Vụ việc (#440), 20/09/2026. Máy chủ trả `quyenGhi` theo CHÍNH luật checkWriteScope.
 */
const DON = {
  id: 'p1',
  status: 'MOI_TIEP_NHAN',
  assignedTeamId: 't1',
  enteredById: 'u1',
  deletedAt: null,
};

function dung(don: Record<string, unknown>) {
  const prisma = {
    petition: { findFirst: jest.fn().mockResolvedValue(don) },
  };
  return new PetitionsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { emit: jest.fn() } as never,
  );
}
const phamVi = (o: Record<string, unknown> = {}) => ({
  teamIds: ['t1', 't2'],
  userIds: ['u1'],
  writableTeamIds: ['t1'],
  writableUserIds: ['u1'],
  canDispatch: false,
  isWardOfficer: false,
  ...o,
});
const quyenGhi = (kq: { data: unknown }) =>
  (kq.data as { quyenGhi?: boolean }).quyenGhi;

describe('GET /petitions/:id — quyenGhi', () => {
  it('đơn tổ ghi được → true', async () => {
    expect(quyenGhi(await dung(DON).getById('p1', phamVi() as never))).toBe(
      true,
    );
  });

  it('đơn tổ CHỈ XEM → false', async () => {
    const kq = await dung({
      ...DON,
      assignedTeamId: 't2',
      enteredById: 'u-khac',
    }).getById('p1', phamVi() as never);
    expect(quyenGhi(kq)).toBe(false);
  });

  it('điều phối viên xem đơn tổ khác → đọc được, quyenGhi = false', async () => {
    const kq = await dung({
      ...DON,
      assignedTeamId: 't9',
      enteredById: 'u-khac',
    }).getById('p1', phamVi({ canDispatch: true }) as never);
    expect(quyenGhi(kq)).toBe(false);
  });

  it('người nhập đơn (tổ khác) → true', async () => {
    const kq = await dung({ ...DON, assignedTeamId: 't9' }).getById(
      'p1',
      phamVi() as never,
    );
    expect(quyenGhi(kq)).toBe(true);
  });

  it('cán bộ phường xem đơn chưa giao tổ mình nhập → true; đơn chưa giao người khác nhập → không đọc được', async () => {
    const wo = phamVi({ isWardOfficer: true });
    expect(
      quyenGhi(
        await dung({ ...DON, assignedTeamId: null }).getById('p1', wo as never),
      ),
    ).toBe(true);
    await expect(
      dung({ ...DON, assignedTeamId: null, enteredById: 'u-khac' }).getById(
        'p1',
        wo as never,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('quản trị → true', async () => {
    expect(
      quyenGhi(
        await dung({ ...DON, assignedTeamId: 't9' }).getById('p1', null),
      ),
    ).toBe(true);
  });
});
