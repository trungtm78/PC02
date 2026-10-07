import { CaseChildAccessService } from '../case-child-access/case-child-access.service';
import { ordinaryChildFixture } from '../case-child-access/test-child-access-fixture';
import { CaseSourceCreationService } from '../case-child-access/case-source-creation.service';
import { ordinarySourceFixture, setSourceFixtureScope } from '../case-child-access/test-source-creation-fixture';
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
    { emit: jest.fn() } as never, ordinarySourceFixture(prisma as never), ordinaryChildFixture(prisma as never) as never
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

describe('GET /incidents — quyenGhi trên từng dòng', () => {
  it('trả capability theo đúng phạm vi ghi của từng hồ sơ', async () => {
    const prisma = {
      incident: {
        findMany: jest.fn().mockResolvedValue([
          { ...VU_VIEC, id: 'writable', assignedTeamId: 't1' },
          {
            ...VU_VIEC,
            id: 'readonly',
            assignedTeamId: 't2',
            investigatorId: 'u-khac',
          },
        ]),
        count: jest.fn().mockResolvedValue(2),
      },
    };
    const service = new IncidentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emit: jest.fn() } as never, ordinarySourceFixture(prisma as never), ordinaryChildFixture(prisma as never) as never
    );
    jest.spyOn(service, 'dungWhereDanhSach').mockResolvedValue({
      where: {},
      ky: {
        ky: 'TAT_CA',
        truong: 'NGAY_TIEP_NHAN',
        tuNgay: null,
        denNgay: null,
      },
    });
    const result = await service.getList({} as never, phamVi() as never);
    expect(
      result.data.map((row) => ({ id: row.id, quyenGhi: row.quyenGhi })),
    ).toEqual([
      { id: 'writable', quyenGhi: true },
      { id: 'readonly', quyenGhi: false },
    ]);
  });
});
