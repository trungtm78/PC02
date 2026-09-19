import { ConflictException } from '@nestjs/common';
import { CasesService } from './cases.service';

/**
 * PUT /cases/:id — đối tượng / vật chứng / tài liệu THÊM trong lúc sửa vụ án phải được lưu (tồn đọng PR #217/#220).
 *
 * Trước 19/09/2026: form sửa vụ án có tab ĐTBS và Vật chứng; cán bộ thêm mục, bấm Lưu, thấy "Cập nhật hồ sơ thành
 * công!" — nhưng `update` không đọc ba mảng ấy, mục thêm biến mất. Mảng trong PUT là mục THÊM MỚI (form sửa không
 * nạp mục cũ vào tab, nên không bao giờ gửi lại mục cũ).
 *
 * Mục con phải ghi CÙNG giao dịch với vụ án: hỏng một mục thì vụ án cũng không đổi, không có trạng thái nửa vời.
 */
const VU_AN = {
  id: 'c1',
  status: 'TIEP_NHAN',
  assignedTeamId: 't1',
  investigatorId: 'u1',
  metadata: {},
  createdAt: new Date('2026-09-01'),
  ngayGiaiQuyet: null,
  deletedAt: null,
};

function dung() {
  const nhatKy: string[] = [];
  const tx = {
    case: {
      findUnique: jest.fn().mockResolvedValue(VU_AN),
      update: jest.fn(() => {
        nhatKy.push('tx.case.update');
        return Promise.resolve({ ...VU_AN, updatedAt: new Date() });
      }),
    },
    subject: {
      createMany: jest.fn((a: { data: unknown[] }) => {
        nhatKy.push('tx.subject.createMany');
        return Promise.resolve({ count: a.data.length });
      }),
    },
    evidence: {
      createMany: jest.fn((a: { data: unknown[] }) => {
        nhatKy.push('tx.evidence.createMany');
        return Promise.resolve({ count: a.data.length });
      }),
    },
    document: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    caseStatistic: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    case: {
      findFirst: jest.fn().mockResolvedValue(VU_AN),
      findUnique: jest.fn().mockResolvedValue(VU_AN),
      // Ghi NGOÀI giao dịch là sai — ca kiểm khẳng định không ai gọi.
      update: jest.fn(() => {
        nhatKy.push('NGOAI.case.update');
        return Promise.resolve(VU_AN);
      }),
    },
    caseStatistic: {
      upsert: jest.fn(() => {
        nhatKy.push('NGOAI.caseStatistic.upsert');
        return Promise.resolve({});
      }),
    },
    petition: { findFirst: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => {
      nhatKy.push('$transaction');
      return fn(tx);
    }),
  };
  const audit = {
    log: jest.fn().mockResolvedValue(undefined),
    wrapUpdate: jest.fn(
      async (o: {
        fetchFn: () => Promise<unknown>;
        updateFn: () => Promise<unknown>;
      }) => {
        await o.fetchFn();
        return o.updateFn();
      },
    ),
  };
  const service = new CasesService(
    prisma as never,
    audit as never,
    { getNumericValue: jest.fn(), getKyThongKe: jest.fn() } as never,
    {} as never,
    { emit: jest.fn() } as never,
  );
  return { service, prisma, tx, audit, nhatKy };
}

describe('PUT /cases/:id — mục con thêm khi sửa', () => {
  it('đối tượng và vật chứng thêm mới được ghi, gắn đúng vụ án, TRONG cùng giao dịch với vụ án', async () => {
    const { service, tx, nhatKy } = dung();
    await service.update(
      'c1',
      {
        name: 'Tên mới',
        subjects: [{ fullName: 'Nguyễn Văn B', type: 'VICTIM' }],
        evidences: [{ code: 'VC-1', name: 'Dao' }],
      } as never,
      'u1',
    );
    expect(tx.subject.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          fullName: 'Nguyễn Văn B',
          caseId: 'c1',
          type: 'VICTIM',
        }),
      ],
    });
    expect(tx.evidence.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          code: 'VC-1',
          caseId: 'c1',
          createdById: 'u1',
        }),
      ],
    });
    expect(nhatKy).toEqual([
      '$transaction',
      'tx.case.update',
      'tx.subject.createMany',
      'tx.evidence.createMany',
    ]);
  });

  it('thống kê mở rộng cũng ghi trong giao dịch, không ghi ngoài', async () => {
    const { service, tx, nhatKy } = dung();
    await service.update('c1', { statistic: {} } as never, 'u1');
    expect(tx.caseStatistic.upsert).toHaveBeenCalled();
    expect(nhatKy).not.toContain('NGOAI.caseStatistic.upsert');
  });

  it('nhật ký sửa (before/after) ghi cùng giao dịch', async () => {
    const { service, audit, tx } = dung();
    await service.update('c1', { name: 'X' } as never, 'u1');
    expect(audit.wrapUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tx }),
    );
  });

  it('khoá lạc quan vẫn thành 409 khi vụ án đã bị người khác sửa', async () => {
    const { service, tx } = dung();
    tx.case.update.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('x'), { code: 'P2025' })),
    );
    await expect(
      service.update(
        'c1',
        { name: 'X', expectedUpdatedAt: new Date().toISOString() } as never,
        'u1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('không có mục con → không gọi createMany', async () => {
    const { service, tx } = dung();
    await service.update('c1', { name: 'X' } as never, 'u1');
    expect(tx.subject.createMany).not.toHaveBeenCalled();
    expect(tx.evidence.createMany).not.toHaveBeenCalled();
  });
});
