import type { DataScope } from '../../auth/services/unit-scope.service';
import { CasesBulkService } from '../../cases/bulk/cases.bulk.service';
import { IncidentsBulkService } from '../../incidents/bulk/incidents.bulk.service';
import { PetitionsBulkService } from '../../petitions/bulk/petitions.bulk.service';
import { LawyersBulkService } from '../../lawyers/bulk/lawyers.bulk.service';
import { SubjectsBulkService } from '../../subjects/bulk/subjects.bulk.service';

/**
 * XOÁ HÀNG LOẠT phải lọc theo phạm vi GHI — quyết định 19/09/2026 (điều phối viên ngoài phạm vi chỉ xem + phân
 * công). Trước đó cả 5 hàm dùng bộ lọc ĐỌC: điều phối viên (19 cán bộ trên prod) được bộ lọc `null` → xoá hàng
 * loạt hồ sơ mọi đơn vị; người thường xoá được hồ sơ của tổ mình CHỈ được cấp quyền xem.
 *
 * Các spec hàng loạt có sẵn giả lập `findMany` mà không xem điều kiện, nên không bắt được. Ca này bắt đúng câu
 * truy vấn chọn hồ sơ được xoá.
 */
const DIEU_PHOI: DataScope = {
  userIds: ['u1'],
  teamIds: ['t-ghi', 't-chi-xem'],
  writableTeamIds: ['t-ghi'],
  canDispatch: true,
};

/** Prisma giả: mọi phương thức của mọi bảng trả rỗng; ghi lại các lời gọi `findMany`. */
function prismaGhiLai() {
  const findMany: Array<{ bang: string; args: { where?: unknown } }> = [];
  const bang = (ten: string) =>
    new Proxy(
      {},
      {
        get: (_t, ham: string) => (args: { where?: unknown }) => {
          if (ham === 'findMany') findMany.push({ bang: ten, args });
          if (ham === 'findUnique' || ham === 'findFirst')
            return Promise.resolve(null);
          if (ham === 'count') return Promise.resolve(0);
          return Promise.resolve([]);
        },
      },
    );
  const prisma: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_t, ten: string) => {
        if (ten === '$transaction')
          return (fn: (tx: unknown) => unknown) => fn(prisma);
        if (ten.startsWith('$')) return () => Promise.resolve([]);
        return bang(ten);
      },
    },
  );
  return { prisma, findMany };
}

/** Nhật ký giả: mọi phương thức (log, logBulkHeader, …) trả một mã giả. */
const audit = new Proxy({}, { get: () => () => Promise.resolve('audit-id') });

const DAU_VAO = {
  ids: ['x1', 'x2'],
  reason: 'Xoá thử',
  actorId: 'u1',
  actorRole: 'OFFICER',
  dataScope: DIEU_PHOI,
};

const TRUONG_HOP = [
  { ten: 'vụ án', bang: 'case', Lop: CasesBulkService },
  { ten: 'vụ việc', bang: 'incident', Lop: IncidentsBulkService },
  { ten: 'đơn thư', bang: 'petition', Lop: PetitionsBulkService },
  { ten: 'luật sư', bang: 'lawyer', Lop: LawyersBulkService },
  { ten: 'đối tượng', bang: 'subject', Lop: SubjectsBulkService },
] as const;

describe.each(TRUONG_HOP)(
  'bulkDelete $ten — lọc theo phạm vi GHI',
  ({ bang, Lop }) => {
    it('điều phối viên: câu chọn hồ sơ CÓ lọc, chỉ tổ được ghi (không tổ chỉ-xem, không bỏ qua)', async () => {
      const { prisma, findMany } = prismaGhiLai();
      const svc = new Lop(prisma as never, audit as never);
      await svc.bulkDelete(DAU_VAO as never);

      const chon = findMany.find(
        (c) =>
          c.bang === bang &&
          JSON.stringify(c.args?.where ?? {}).includes('"x1"'),
      );
      expect(chon).toBeDefined();
      const dieuKien = JSON.stringify(chon!.args.where);
      expect(dieuKien).toContain('t-ghi');
      expect(dieuKien).not.toContain('t-chi-xem');
    });
  },
);
