import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TeamsService } from '../teams/teams.service';
import { EnrollmentService } from '../auth/services/enrollment.service';

/**
 * Ô chọn cán bộ trên form gom nhóm theo TỔ, nên `GET /admin/users` phải trả tổ của
 * từng người. Trước đây phần chọn chỉ có `departmentId` (một id, không tên), còn tên tổ
 * nằm ở `GET /teams` — ghép hai nguồn ở trình duyệt là hai lần hỏi và một lần lệch.
 *
 * Hình trả về khớp ĐÚNG `/auth/me` (`auth.service.getProfile`) để cả ứng dụng chỉ có một
 * hình dữ liệu "tổ của một người".
 */
describe('GET /admin/users trả kèm tổ của từng cán bộ', () => {
  let service: AdminService;

  /** Khai kiểu cho mock để đọc lại đối số mà không rơi về `any` — `select` là thứ ca kiểm soi. */
  type ThamSoFindMany = { select: Record<string, unknown> };
  const findMany = jest.fn<
    Promise<Record<string, unknown>[]>,
    [ThamSoFindMany]
  >();
  const count = jest.fn<Promise<number>, []>();
  const prisma = { user: { findMany, count } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: TeamsService, useValue: {} },
        { provide: EnrollmentService, useValue: {} },
      ],
    }).compile();
    service = mod.get(AdminService);
  });

  it('chọn kèm `userTeams` để lấy được TÊN tổ, không chỉ id phòng ban', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await service.getUsers({} as never);

    const select = findMany.mock.calls[0][0].select;
    expect(select.userTeams).toBeDefined();
  });

  it('gộp `userTeams` thành `teams: [{teamId, teamName, isLeader}]`', async () => {
    findMany.mockResolvedValue([
      {
        id: 'u1',
        username: 'a.doi1',
        userTeams: [
          { isLeader: true, team: { id: 't1', name: 'Tổ 1' } },
          { isLeader: false, team: { id: 't2', name: 'Tổ 2' } },
        ],
      },
    ]);
    count.mockResolvedValue(1);

    const res = await service.getUsers({} as never);

    expect(res.data[0].teams).toEqual([
      { teamId: 't1', teamName: 'Tổ 1', isLeader: true },
      { teamId: 't2', teamName: 'Tổ 2', isLeader: false },
    ]);
  });

  it('người chưa thuộc tổ nào trả mảng RỖNG, không phải undefined', async () => {
    // Mảng rỗng là thứ tầng dựng nhóm gom được vào "Chưa có tổ"; `undefined` làm nó nổ.
    findMany.mockResolvedValue([{ id: 'u2', username: 'b', userTeams: [] }]);
    count.mockResolvedValue(1);

    const res = await service.getUsers({} as never);

    expect(res.data[0].teams).toEqual([]);
  });

  it('KHÔNG rò `userTeams` thô ra ngoài — chỉ hình đã gộp', async () => {
    findMany.mockResolvedValue([
      {
        id: 'u3',
        username: 'c',
        userTeams: [{ isLeader: false, team: { id: 't1', name: 'Tổ 1' } }],
      },
    ]);
    count.mockResolvedValue(1);

    const res = await service.getUsers({} as never);

    expect((res.data[0] as Record<string, unknown>).userTeams).toBeUndefined();
  });
});
