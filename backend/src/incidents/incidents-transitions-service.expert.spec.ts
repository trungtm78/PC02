import { BadRequestException } from '@nestjs/common';
import { IncidentStatus } from '@prisma/client';
import { IncidentsService } from './incidents.service';
import { VALID_TRANSITIONS, TERMINAL_STATUSES } from './incidents.constants';

/**
 * EXPERT model-based — bản đồ trạng thái phải được CHẶN Ở SERVICE, không chỉ khai trong hằng số.
 *
 * ── Khe hở mà bộ kiểm cũ để lại ──
 *
 * `incidents-transitions.expert.spec.ts` chứng minh ĐỒ THỊ hợp lệ (không self-loop, terminal
 * không có cạnh ra, không dead-end...). Nhưng đồ thị đúng mà tầng service không đọc nó thì hệ
 * thống vẫn cho nhảy bừa — và không ca nào biết. Đây đúng lớp "khe hở giữa bộ nạp và bộ đọc":
 * hai bên tự nó đúng, chỗ hỏng nằm ở khoảng giữa.
 *
 * Ca dưới đây VÉT CẠN toàn bộ ma trận từ × đến (15 × 15) qua chính `updateStatus` của service.
 * Cạnh hợp lệ phải đi được; MỌI cạnh còn lại phải bị từ chối bằng lỗi rõ ràng.
 */
const MOI_TRANG_THAI = Object.values(IncidentStatus) as IncidentStatus[];

function dungService(trangThaiHienTai: IncidentStatus) {
  const ban = {
    id: 'i1',
    code: 'VV-1',
    status: trangThaiHienTai,
    deletedAt: null,
    assignedTeamId: null,
    createdById: 'u1',
    unitId: null,
    metadata: {},
  };
  const prisma: any = {
    incident: {
      findFirst: jest.fn().mockResolvedValue(ban),
      update: jest.fn().mockImplementation((a: any) => Promise.resolve({ ...ban, ...a.data })),
    },
    incidentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
    ),
  };
  const svc = new IncidentsService(
    prisma,
    { log: jest.fn().mockResolvedValue(undefined) } as any,
    {} as any,
    { getActive: jest.fn().mockResolvedValue({ id: 'r1', value: 20 }) } as any,
    {} as any,
    { emit: jest.fn() } as any,
  );
  return { svc, prisma };
}

/** Vài trạng thái đòi thêm trường bắt buộc — cấp sẵn để không nhầm lỗi thiếu trường với lỗi cạnh. */
function dtoCho(den: IncidentStatus): Record<string, unknown> {
  const d: Record<string, unknown> = { status: den };
  if (den === IncidentStatus.KHONG_KHOI_TO) d.lyDoKhongKhoiTo = 'Điều 157 khoản 1';
  return d;
}

describe('EXPERT — service chặn ĐÚNG ma trận transition (vét cạn 15×15)', () => {
  const capHopLe: [IncidentStatus, IncidentStatus][] = [];
  const capTraiLuat: [IncidentStatus, IncidentStatus][] = [];
  for (const tu of MOI_TRANG_THAI) {
    const duoc = VALID_TRANSITIONS[tu] ?? [];
    for (const den of MOI_TRANG_THAI) {
      (duoc.includes(den) ? capHopLe : capTraiLuat).push([tu, den]);
    }
  }

  it('ma trận có đủ cả hai loại cạnh (ca kiểm này không rỗng)', () => {
    expect(capHopLe.length).toBeGreaterThan(0);
    expect(capTraiLuat.length).toBeGreaterThan(0);
    expect(capHopLe.length + capTraiLuat.length).toBe(MOI_TRANG_THAI.length ** 2);
  });

  it.each(capHopLe)('cạnh HỢP LỆ %s → %s phải đi được', async (tu, den) => {
    const { svc, prisma } = dungService(tu);
    await expect(
      svc.updateStatus('i1', dtoCho(den) as never, 'u1', undefined as never),
    ).resolves.toBeDefined();
    expect(prisma.incident.update).toHaveBeenCalled();
  });

  it.each(capTraiLuat)('cạnh TRÁI LUẬT %s → %s phải bị chặn Ở SERVICE', async (tu, den) => {
    const { svc, prisma } = dungService(tu);
    await expect(
      svc.updateStatus('i1', dtoCho(den) as never, 'u1', undefined as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Chặn nghĩa là KHÔNG ghi gì — từ chối rồi vẫn ghi là tệ hơn không chặn.
    expect(prisma.incident.update).not.toHaveBeenCalled();
  });

  /** Trạng thái kết thúc: mọi lối ra đều phải bị chặn, không có ngoại lệ nào lọt. */
  it.each(TERMINAL_STATUSES.map((t) => [t]))(
    'trạng thái kết thúc %s không đi đâu được nữa',
    async (tu) => {
      for (const den of MOI_TRANG_THAI) {
        const { svc } = dungService(tu as IncidentStatus);
        await expect(
          svc.updateStatus('i1', dtoCho(den) as never, 'u1', undefined as never),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    },
  );
});
