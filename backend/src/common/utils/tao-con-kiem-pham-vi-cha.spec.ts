import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConclusionsService } from '../../conclusions/conclusions.service';
import { InvestigationSupplementsService } from '../../investigation-supplements/investigation-supplements.service';
import { LawyersService } from '../../lawyers/lawyers.service';
import { SubjectsService } from '../../subjects/subjects.service';
import { DelegationsService } from '../../delegations/delegations.service';
import { ProposalsService } from '../../proposals/proposals.service';
import type { DataScope } from '../../auth/services/unit-scope.service';

/**
 * Tạo / chuyển bản ghi CON (kết luận, ĐTBS, luật sư, đối tượng, ủy thác, đề xuất) phải kiểm phạm vi GHI
 * của vụ án CHA — cùng luật với sửa/xoá (đã kiểm từ trước).
 *
 * Lỗi còn sống trên prod tới 19/09/2026 (danh sách tồn đọng PR #217/#220): `create` của sáu module không
 * nhận `dataScope`, nên cán bộ Tổ 2 gắn được kết luận / luật sư / bị can vào vụ án của Đội 4 chỉ bằng cách
 * gửi `caseId` của nó; sửa luật sư/đối tượng thì CHUYỂN được bản ghi sang vụ án ngoài phạm vi.
 */
const CA_TRONG = { id: 'c-trong', assignedTeamId: 't1', investigatorId: 'u1' };
const CA_NGOAI = {
  id: 'c-ngoai',
  assignedTeamId: 't-khac',
  investigatorId: 'u-khac',
};

const canBo: DataScope = {
  teamIds: ['t1'],
  userIds: ['u1'],
  writableTeamIds: ['t1'],
  writableUserIds: ['u1'],
  canDispatch: false,
} as DataScope;
const dieuPhoi: DataScope = { ...canBo, canDispatch: true } as DataScope;

/** Prisma giả: `case.findFirst` trả vụ án theo id; mọi lệnh GHI được ghi lại để khẳng định KHÔNG xảy ra. */
function taoPrisma(banGhiCon?: Record<string, unknown>) {
  const ghi: string[] = [];
  const duLieu: Array<Record<string, unknown> | undefined> = [];
  const bang = new Map<string, Record<string, jest.Mock>>();
  const model = (ten: string) => {
    if (!bang.has(ten)) {
      const m: Record<string, jest.Mock> = {};
      for (const hanh of [
        'create',
        'update',
        'delete',
        'upsert',
        'createMany',
        'updateMany',
      ]) {
        m[hanh] = jest.fn((arg: { data?: Record<string, unknown> }) => {
          ghi.push(`${ten}.${hanh}`);
          duLieu.push(arg?.data);
          return Promise.resolve({ id: 'moi', ...(arg?.data ?? {}) });
        });
      }
      m.findFirst = jest.fn((arg: { where?: { id?: string } }) => {
        const id = arg?.where?.id;
        if (ten === 'case') {
          return Promise.resolve(
            [CA_TRONG, CA_NGOAI].find((c) => c.id === id) ?? null,
          );
        }
        return Promise.resolve(
          banGhiCon && id === banGhiCon.id ? banGhiCon : null,
        );
      });
      m.findUnique = m.findFirst;
      m.findMany = jest.fn().mockResolvedValue([]);
      m.count = jest.fn().mockResolvedValue(0);
      bang.set(ten, m);
    }
    return bang.get(ten)!;
  };
  const prisma = new Proxy(
    {},
    {
      get: (_t, p: string) => {
        if (p === '$transaction') {
          return jest.fn((fn: (tx: unknown) => unknown) => {
            ghi.push('$transaction');
            return Promise.resolve(fn(prisma));
          });
        }
        return model(p);
      },
    },
  );
  return { prisma: prisma as never, ghi, duLieu };
}

const audit = { log: jest.fn().mockResolvedValue(undefined) } as never;
const docNums = {
  commitWithTx: jest.fn().mockResolvedValue({ number: 'SO-1', logId: 'log1' }),
} as never;
const emitter = { emit: jest.fn() } as never;

type Tao = (
  prisma: never,
  caseId: string,
  scope: DataScope | null,
) => Promise<unknown>;
const TAO: Array<[string, Tao]> = [
  [
    'Kết luận',
    (p, caseId, s) =>
      new ConclusionsService(p, audit).create(
        { caseId, type: 'KET_LUAN_DIEU_TRA', content: 'x' } as never,
        'u1',
        undefined,
        s,
      ),
  ],
  [
    'Điều tra bổ sung',
    (p, caseId, s) =>
      new InvestigationSupplementsService(p, audit).create(
        { caseId, type: 'VKS_TRA' } as never,
        'u1',
        undefined,
        s,
      ),
  ],
  [
    'Luật sư',
    (p, caseId, s) =>
      new LawyersService(p, audit).create(
        { caseId, fullName: 'LS A', barNumber: 'B-1' } as never,
        'u1',
        undefined,
        s,
      ),
  ],
  [
    'Đối tượng',
    (p, caseId, s) =>
      new SubjectsService(p, audit).create(
        { caseId, fullName: 'Nguyễn Văn A', type: 'SUSPECT' } as never,
        'u1',
        undefined,
        s,
      ),
  ],
  [
    'Ủy thác',
    (p, caseId, s) =>
      new DelegationsService(p, audit, docNums, emitter).create(
        {
          relatedCaseId: caseId,
          receivingUnit: 'CA Q1',
          content: 'x',
        } as never,
        'u1',
        undefined,
        s,
      ),
  ],
  [
    'Đề xuất',
    (p, caseId, s) =>
      new ProposalsService(p, audit, docNums).create(
        { relatedCaseId: caseId, content: 'x' } as never,
        'u1',
        undefined,
        s,
      ),
  ],
];

describe.each(TAO)('Tạo %s gắn vào vụ án cha', (_ten, tao) => {
  it('vụ án NGOÀI phạm vi → 403, không ghi gì', async () => {
    const { prisma, ghi } = taoPrisma();
    await expect(tao(prisma, CA_NGOAI.id, canBo)).rejects.toThrow(
      ForbiddenException,
    );
    expect(ghi).toEqual([]);
  });

  it('điều phối viên cũng KHÔNG tạo được ngoài phạm vi (ngoài phạm vi chỉ xem + phân công)', async () => {
    const { prisma, ghi } = taoPrisma();
    await expect(tao(prisma, CA_NGOAI.id, dieuPhoi)).rejects.toThrow(
      ForbiddenException,
    );
    expect(ghi).toEqual([]);
  });

  it('vụ án không tồn tại → 400 nói rõ, không ghi gì', async () => {
    const { prisma, ghi } = taoPrisma();
    await expect(tao(prisma, 'c-khong-co', canBo)).rejects.toThrow(
      BadRequestException,
    );
    expect(ghi).toEqual([]);
  });

  it('vụ án TRONG phạm vi → tạo được', async () => {
    const { prisma, ghi } = taoPrisma();
    await tao(prisma, CA_TRONG.id, canBo);
    expect(ghi.some((g) => g.endsWith('.create'))).toBe(true);
  });

  it('quản trị (không phạm vi) → tạo được', async () => {
    const { prisma, ghi } = taoPrisma();
    await tao(prisma, CA_NGOAI.id, null);
    expect(ghi.some((g) => g.endsWith('.create'))).toBe(true);
  });
});

describe('Chuyển bản ghi con sang vụ án khác phải kiểm phạm vi GHI của vụ án ĐÍCH', () => {
  it('Luật sư: đổi caseId sang vụ án ngoài phạm vi → 403, không ghi', async () => {
    const luatSu = {
      id: 'ls1',
      caseId: CA_TRONG.id,
      barNumber: 'B-1',
      case: CA_TRONG,
      deletedAt: null,
    };
    const { prisma, ghi } = taoPrisma(luatSu);
    await expect(
      new LawyersService(prisma, audit).update(
        'ls1',
        { caseId: CA_NGOAI.id } as never,
        'u1',
        undefined,
        canBo,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(ghi).toEqual([]);
  });

  it('Đối tượng: đổi caseId sang vụ án ngoài phạm vi → 403, không ghi', async () => {
    const doiTuong = {
      id: 'dt1',
      caseId: CA_TRONG.id,
      type: 'SUSPECT',
      fullName: 'A',
      case: CA_TRONG,
      deletedAt: null,
    };
    const { prisma, ghi } = taoPrisma(doiTuong);
    await expect(
      new SubjectsService(prisma, audit).update(
        'dt1',
        { caseId: CA_NGOAI.id } as never,
        'u1',
        undefined,
        canBo,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(ghi).toEqual([]);
  });
});

/**
 * Rà mã độc lập 19/09/2026: chuyển luật sư sang vụ án khác mà không gửi `subjectId` thì luật sư vẫn trỏ tới
 * bị can của vụ án CŨ — bản ghi bào chữa cho người không có trong vụ án của nó.
 */
describe('Chuyển luật sư sang vụ án khác', () => {
  const luatSu = {
    id: 'ls1',
    caseId: CA_TRONG.id,
    subjectId: 'bi-can-vu-cu',
    barNumber: 'B-1',
    case: CA_TRONG,
    deletedAt: null,
  };

  it('không gửi subjectId → bỏ liên kết bị can của vụ án cũ', async () => {
    const { prisma, duLieu } = taoPrisma(luatSu);
    await new LawyersService(prisma, audit).update(
      'ls1',
      { caseId: CA_NGOAI.id } as never,
      'u1',
      undefined,
      null,
    );
    expect(duLieu[0]).toEqual(
      expect.objectContaining({ caseId: CA_NGOAI.id, subjectId: null }),
    );
  });

  it('không đổi vụ án → giữ nguyên bị can', async () => {
    const { prisma, duLieu } = taoPrisma(luatSu);
    await new LawyersService(prisma, audit).update(
      'ls1',
      { fullName: 'LS B' } as never,
      'u1',
      undefined,
      null,
    );
    expect(duLieu[0]).not.toHaveProperty('subjectId');
  });
});
