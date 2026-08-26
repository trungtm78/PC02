import { builderTargets } from './builder-targets';
import { PARITY } from '../field-parity.def';

/**
 * Đọc mã `legacy-mapper.ts` THẬT, không dựng bản giả: cái cần gác là "bộ đọc có nhìn thấy
 * đủ đích không", mà bản giả thì luôn nhìn thấy đủ.
 */
describe('builderTargets — thấy MỌI đích của một field, không chỉ đích đầu tiên', () => {
  const t = builderTargets();

  it('field chữ đổ vào hai cột thì phải thấy cả hai', () => {
    const dich = (t.petition.get('truong_hop_bao_cao_ban_giam_doc') ?? []).map((d) => d.column);
    // Cột đúng/sai gặp TRƯỚC trong mã; bản cũ dừng ở đó nên cột chữ vô hình với ma trận.
    expect(dich).toContain('baoCaoBanGiamDoc');
    expect(dich).toContain('baoCaoBanGiamDocText');
  });

  it('mỗi thực thể đọc theo builder của chính nó', () => {
    expect((t.incident.get('tinh_trang') ?? []).map((d) => d.column)).toContain('tinhTrangHoSo');
    expect((t.petition.get('tinh_trang') ?? []).map((d) => d.column)).toContain('tinhTrang');
  });

  /**
   * Nguồn thứ hai: `parityColumns()` đổ theo BẢNG KHAI, không có `rec.<field>` nào trong mã
   * để quét. Bỏ sót nguồn này thì mọi field do bảng khai phụ trách bị xếp nhầm là "chưa ai
   * đọc", và ma trận đòi thêm cột cho những cột đã có sẵn và đang được đổ đầy đủ.
   *
   * Kiểm theo TÍNH CHẤT thay vì theo một field may mắn: mọi dòng của bảng khai đều phải có
   * mặt, nên thêm dòng mới sau này cũng được gác.
   */
  it.each(['petition', 'incident', 'case'] as const)(
    'thực thể %s: mọi dòng của bảng khai đều có đích',
    (entity) => {
      const thieu = PARITY[entity].filter(
        (c) => !(t[entity].get(c.field) ?? []).some((d) => d.column === c.col),
      );
      expect(thieu.map((c) => `${c.field}→${c.col}`)).toEqual([]);
    },
  );

  it('không bịa đích cho field không ai đọc', () => {
    expect(t.petition.get('khong_co_field_nay')).toBeUndefined();
  });
});
