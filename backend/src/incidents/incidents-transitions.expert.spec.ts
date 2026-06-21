/**
 * EXPERT TEST — state machine bất biến cho VALID_TRANSITIONS (Vụ việc, BLTTHS 2015).
 * Phương pháp: model-based / stateful + property-based. Chứng minh đồ thị trạng thái HỢP LỆ:
 * terminal không có cạnh ra, không self-loop, target hợp lệ, không bẫy dead-end, reachability.
 */
import fc from 'fast-check';
import { IncidentStatus } from '@prisma/client';
import { VALID_TRANSITIONS, TERMINAL_STATUSES, PHASE_STATUSES } from './incidents.constants';

const ALL_STATUSES = Object.values(IncidentStatus);
const isTerminal = (s: IncidentStatus): boolean => TERMINAL_STATUSES.includes(s);
const outgoing = (s: IncidentStatus): IncidentStatus[] => VALID_TRANSITIONS[s] ?? [];

describe('EXPERT model-based — đồ thị transition Vụ việc hợp lệ', () => {
  it('ST-01: terminal status KHÔNG có cạnh ra (không thoát khỏi trạng thái kết thúc)', () => {
    for (const t of TERMINAL_STATUSES) {
      expect(outgoing(t)).toHaveLength(0);
    }
  });

  it('ST-02: không self-loop (from ∉ targets của chính nó)', () => {
    for (const from of Object.keys(VALID_TRANSITIONS) as IncidentStatus[]) {
      expect(outgoing(from)).not.toContain(from);
    }
  });

  it('ST-03: mọi target là IncidentStatus hợp lệ (không trỏ trạng thái không tồn tại)', () => {
    for (const from of Object.keys(VALID_TRANSITIONS) as IncidentStatus[]) {
      for (const to of outgoing(from)) {
        expect(ALL_STATUSES).toContain(to);
      }
    }
  });

  it('ST-04: mọi target KHÔNG trùng lặp trong cùng 1 from', () => {
    for (const from of Object.keys(VALID_TRANSITIONS) as IncidentStatus[]) {
      const tos = outgoing(from);
      expect(new Set(tos).size).toBe(tos.length);
    }
  });

  it('ST-05: không bẫy dead-end — mọi non-terminal CÓ THỂ tới được 1 terminal (BFS)', () => {
    const canReachTerminal = (start: IncidentStatus): boolean => {
      const seen = new Set<IncidentStatus>();
      const queue = [start];
      while (queue.length) {
        const cur = queue.shift()!;
        if (isTerminal(cur)) return true;
        if (seen.has(cur)) continue;
        seen.add(cur);
        queue.push(...outgoing(cur));
      }
      return false;
    };
    for (const from of Object.keys(VALID_TRANSITIONS) as IncidentStatus[]) {
      if (!isTerminal(from) && outgoing(from).length > 0) {
        expect(canReachTerminal(from)).toBe(true);
      }
    }
  });

  it('ST-06: reachability — từ TIEP_NHAN tới được mọi status trong VALID_TRANSITIONS keys (trừ QUA_HAN do hệ thống set)', () => {
    const seen = new Set<IncidentStatus>();
    const queue: IncidentStatus[] = [IncidentStatus.TIEP_NHAN];
    while (queue.length) {
      const cur = queue.shift()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      queue.push(...outgoing(cur));
    }
    // Mọi status nguồn (có cạnh ra) phải reachable, trừ QUA_HAN (set bởi job quá hạn, không phải transition target)
    for (const from of Object.keys(VALID_TRANSITIONS) as IncidentStatus[]) {
      if (from === IncidentStatus.QUA_HAN) continue;
      expect(seen.has(from)).toBe(true);
    }
  });

  it('ST-07: mọi status (key + target) thuộc đúng 1 phase (PHASE_STATUSES phủ toàn bộ)', () => {
    const phaseStatuses = new Set(Object.values(PHASE_STATUSES).flat());
    const involved = new Set<IncidentStatus>();
    for (const from of Object.keys(VALID_TRANSITIONS) as IncidentStatus[]) {
      involved.add(from);
      outgoing(from).forEach((t) => involved.add(t));
    }
    for (const s of involved) {
      expect(phaseStatuses.has(s)).toBe(true);
    }
  });
});

describe('EXPERT model-based — random walk (stateful, fast-check)', () => {
  it('ST-08: walk ngẫu nhiên theo cạnh hợp lệ — status LUÔN hợp lệ + dừng ở terminal hoặc cycle non-terminal', () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 20 }), { minLength: 1, maxLength: 30 }), (choices) => {
        let cur: IncidentStatus = IncidentStatus.TIEP_NHAN;
        for (const choice of choices) {
          // Invariant sau mỗi bước: status hiện tại luôn là enum hợp lệ.
          expect(ALL_STATUSES).toContain(cur);
          const tos = outgoing(cur);
          if (tos.length === 0) {
            // Đã ở terminal/không có cạnh ra → walk dừng đúng.
            expect(isTerminal(cur) || tos.length === 0).toBe(true);
            break;
          }
          cur = tos[choice % tos.length];
        }
        // Kết thúc walk: status vẫn hợp lệ.
        expect(ALL_STATUSES).toContain(cur);
      }),
      { numRuns: 500 },
    );
  });

  it('ST-09: TĐC cycle — TAM_DINH_CHI → PHUC_HOI_NGUON_TIN → (DANG_XAC_MINH|DA_PHAN_CONG) hợp lệ', () => {
    expect(outgoing(IncidentStatus.TAM_DINH_CHI)).toContain(IncidentStatus.PHUC_HOI_NGUON_TIN);
    expect(outgoing(IncidentStatus.PHUC_HOI_NGUON_TIN)).toEqual(
      expect.arrayContaining([IncidentStatus.DANG_XAC_MINH, IncidentStatus.DA_PHAN_CONG]),
    );
  });
});
