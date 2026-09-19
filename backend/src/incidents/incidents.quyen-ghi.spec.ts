import { ForbiddenException } from '@nestjs/common';
import { IncidentsService } from './incidents.service';

/**
 * Trang chi tiết Vụ việc ẩn nút GHI (Chỉnh sửa, Khởi tố thành vụ án) khi người xem chỉ ĐỌC được vụ việc — cùng cách
 * đã làm cho Vụ án (#439, 20/09/2026). Máy chủ trả `quyenGhi` theo CHÍNH luật checkWriteScope.
 */
const VU_VIEC = {
  id: 'i1',
  status: 'TIEP_NHAN',
  assignedTeamId: 't1',
  investigatorId: 'u1',
  deletedAt: null,
  petitions: [],
};

function dung(vuViec: Record<string, unknown>) {
  const prisma = {
    incident: { findFirst: jest.fn().mockResolvedValue(vuViec) },
  };
  return new IncidentsService(
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
  ...o,
});

describe('GET /incidents/:id — quyenGhi', () => {
  it('vụ việc tổ ghi được → true', async () => {
    const kq = await dung(VU_VIEC).getById('i1', phamVi() as never);
    expect((kq.data as { quyenGhi?: boolean }).quyenGhi).toBe(true);
  });

  it('vụ việc tổ CHỈ XEM → false', async () => {
    const kq = await dung({
      ...VU_VIEC,
      assignedTeamId: 't2',
      investigatorId: 'u-khac',
    }).getById('i1', phamVi() as never);
    expect((kq.data as { quyenGhi?: boolean }).quyenGhi).toBe(false);
  });

  it('điều phối viên xem vụ việc tổ khác → đọc được, quyenGhi = false', async () => {
    const kq = await dung({
      ...VU_VIEC,
      assignedTeamId: 't9',
      investigatorId: 'u-khac',
    }).getById('i1', phamVi({ canDispatch: true }) as never);
    expect((kq.data as { quyenGhi?: boolean }).quyenGhi).toBe(false);
  });

  it('quản trị → true', async () => {
    const kq = await dung({ ...VU_VIEC, assignedTeamId: 't9' }).getById(
      'i1',
      null,
    );
    expect((kq.data as { quyenGhi?: boolean }).quyenGhi).toBe(true);
  });

  it('ngoài phạm vi ĐỌC → vẫn 403 như cũ', async () => {
    await expect(
      dung({
        ...VU_VIEC,
        assignedTeamId: 't9',
        investigatorId: 'u-khac',
      }).getById('i1', phamVi() as never),
    ).rejects.toThrow(ForbiddenException);
  });
});
