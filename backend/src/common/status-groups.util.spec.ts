import { resolveGroup, countByGroup } from './status-groups.util';

/**
 * Nhóm trạng thái = 1 thẻ thống kê gộp nhiều trạng thái (vd "Đang xử lý" = DANG_XU_LY +
 * CHO_PHE_DUYET). Client chỉ gửi KEY của nhóm; server giải nghĩa ra danh sách trạng thái.
 */
const GROUPS = {
  'dang-xu-ly': ['DANG_XU_LY', 'CHO_PHE_DUYET'],
  'da-giai-quyet': ['DA_GIAI_QUYET', 'DA_CHUYEN_VU_VIEC', 'DA_CHUYEN_VU_AN'],
  'rong': [] as string[],
};

describe('resolveGroup', () => {
  it('key hợp lệ → trả đúng danh sách trạng thái', () => {
    expect(resolveGroup(GROUPS, 'dang-xu-ly')).toEqual(['DANG_XU_LY', 'CHO_PHE_DUYET']);
  });

  it('key không tồn tại / rỗng / undefined → null (không lọc)', () => {
    expect(resolveGroup(GROUPS, 'khong-co')).toBeNull();
    expect(resolveGroup(GROUPS, '')).toBeNull();
    expect(resolveGroup(GROUPS, undefined)).toBeNull();
  });

  /**
   * [P1] Lỗi 500 CÓ THẬT trong incidents.service.ts: `if (phase && PHASE_STATUSES[phase])`
   * không chặn prototype chain. `PHASE_STATUSES['constructor']` trả về hàm Object —
   * truthy nhưng KHÔNG phải mảng → Prisma nhận `{ in: [Function] }` → ném → 500.
   * Test cũ dùng 'invalid-phase' nên lọt lưới.
   */
  it('[P1] key trên prototype chain → null, KHÔNG rò hàm Object ra ngoài', () => {
    for (const evil of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
      expect(resolveGroup(GROUPS, evil)).toBeNull();
    }
  });

  it('nhóm khai báo rỗng vẫn là nhóm hợp lệ → trả mảng rỗng, không phải null', () => {
    // Phân biệt "nhóm tồn tại nhưng không có trạng thái nào" với "không có nhóm này".
    expect(resolveGroup(GROUPS, 'rong')).toEqual([]);
  });
});

describe('countByGroup', () => {
  const byStatus = {
    DANG_XU_LY: 3,
    CHO_PHE_DUYET: 2,
    DA_GIAI_QUYET: 10,
    DA_CHUYEN_VU_VIEC: 0,
    DA_CHUYEN_VU_AN: 5,
    MOI_TIEP_NHAN: 7,
  };

  it('cộng đúng số của mọi trạng thái trong nhóm', () => {
    const out = countByGroup(GROUPS, byStatus);
    expect(out['dang-xu-ly']).toBe(5);
    expect(out['da-giai-quyet']).toBe(15);
  });

  it('trả về ĐỦ mọi key nhóm, nhóm rỗng = 0 chứ không phải undefined', () => {
    const out = countByGroup(GROUPS, byStatus);
    expect(Object.keys(out).sort()).toEqual(['da-giai-quyet', 'dang-xu-ly', 'rong']);
    expect(out['rong']).toBe(0);
  });

  it('trạng thái thiếu trong byStatus tính là 0, không NaN', () => {
    const out = countByGroup(GROUPS, { DANG_XU_LY: 3 });
    expect(out['dang-xu-ly']).toBe(3);
    expect(out['da-giai-quyet']).toBe(0);
    expect(Number.isNaN(out['da-giai-quyet'])).toBe(false);
  });

  it('trạng thái ngoài mọi nhóm không lọt vào kết quả', () => {
    const out = countByGroup(GROUPS, byStatus);
    expect(Object.values(out).reduce((a, b) => a + b, 0)).toBe(20); // KHÔNG cộng MOI_TIEP_NHAN
  });
});
