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

  it('gộp `userTeams` thành `teams: [{teamId, teamName, isLeader, laDiaBan}]`', async () => {
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

    // `laDiaBan` false khi `wardId` rỗng — tổ chức năng là mặc định.
    expect(res.data[0].teams).toEqual([
      { teamId: 't1', teamName: 'Tổ 1', isLeader: true, laDiaBan: false },
      { teamId: 't2', teamName: 'Tổ 2', isLeader: false, laDiaBan: false },
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

  /*
    Đo prod 20/09: 241 cán bộ hoạt động trải trên **207 tổ có người**. Nhưng chỉ 2 tổ là tổ
    công tác thật (PC02 18 người, Tổ công tác Số 2 13 người); 167 tổ còn lại là công an
    phường/xã, mỗi nơi ĐÚNG MỘT tài khoản.

    Đo tiếp: trong 47.941 đơn thư, chỉ 34 người từng được giao hoặc nhập đơn, và **không một
    ai** thuộc tổ địa bàn. Gom nhóm theo tổ mà không phân biệt hai loại thì ô chọn mọc ra 167
    tiêu đề nhóm một người — đúng thứ yêu cầu 1 muốn dẹp.

    Bảng `teams` đã có sẵn cột phân biệt từ v0.33: `wardId` rỗng là tổ CHỨC NĂNG, có giá trị
    là tổ ĐỊA BÀN. Máy chủ nói ra điều đó, tầng dựng nhóm quyết định cách hiển thị — không
    đoán theo tên tổ, vì tên là thứ người ta sửa được.
  */
  it('nói rõ tổ nào là tổ ĐỊA BÀN qua cờ `laDiaBan`', async () => {
    findMany.mockResolvedValue([
      {
        id: 'u4',
        username: 'd',
        userTeams: [
          { isLeader: false, team: { id: 't1', name: 'Tổ công tác Số 2', wardId: null } },
          {
            isLeader: false,
            team: { id: 't9', name: 'Công an Phường Chợ Quán', wardId: 'w1' },
          },
        ],
      },
    ]);
    count.mockResolvedValue(1);

    const res = await service.getUsers({} as never);

    expect(res.data[0].teams).toEqual([
      { teamId: 't1', teamName: 'Tổ công tác Số 2', isLeader: false, laDiaBan: false },
      {
        teamId: 't9',
        teamName: 'Công an Phường Chợ Quán',
        isLeader: false,
        laDiaBan: true,
      },
    ]);
  });

  it('`select` phải LẤY `wardId` — không lấy thì cờ luôn false và 167 nhóm quay lại', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await service.getUsers({} as never);

    const chon = findMany.mock.calls[0][0].select as Record<string, unknown>;
    expect(JSON.stringify(chon)).toContain('wardId');
  });
});
