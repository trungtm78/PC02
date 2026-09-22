import { describe, it, expect } from 'vitest';
import { buildPetitionPayload } from '../PetitionFormPage/buildPetitionPayload';
import { INITIAL_PETITION_FORM } from '../PetitionFormPage/types';
import type { PetitionFormData } from '../PetitionFormPage/types';

const than = (
  batDau: Partial<PetitionFormData>,
  effectiveEdit: boolean,
): Record<string, unknown> =>
  buildPetitionPayload({ ...INITIAL_PETITION_FORM, ...batDau }, { effectiveEdit });

/**
 * "Trường hợp báo cáo Ban Giám đốc" là BA trạng thái, không phải hai.
 *
 * Ô trên màn là ô CHỮ (`baoCaoBanGiamDocText`); cột trong cơ sở dữ liệu là Đúng/Sai. Đo bản sao
 * prod 22/09/2026 trên 47.169 đơn thư: 4.085 hồ sơ cột là ĐÚNG, ~43.000 hồ sơ cột là NULL —
 * NULL ở đây nghĩa là "chưa xác định", không phải "không báo cáo".
 *
 * Nên gửi `false` mỗi lần lưu là biến 43.000 lời "chưa biết" thành 43.000 lời khẳng định sai,
 * chỉ vì cán bộ mở một hồ sơ di trú ra sửa ô khác. Không ai nhìn thấy, vì ô gây ra nó để trống.
 *
 * Luật đúng, và mệnh đề dưới đây là chỗ duy nhất chứng minh nó:
 *
 *     chữ rỗng  +  SỬA hồ sơ cũ   →  KHÔNG gửi khoá   (giữ NULL)
 *     chữ ≈ "không"               →  gửi false        (cán bộ đã trả lời)
 *     chữ khác                    →  gửi true
 */
describe('CỔNG: baoCaoBanGiamDoc là BA trạng thái', () => {
  it('SỬA hồ sơ cũ, ô chữ để trống → KHÔNG gửi khoá (giữ NULL "chưa xác định")', () => {
    const t = than({ baoCaoBanGiamDocText: '' }, true);
    expect(
      'baoCaoBanGiamDoc' in t,
      'gửi khoá này khi ô trống là biến ~43.000 hồ sơ NULL thành false',
    ).toBe(false);
  });

  it('TẠO MỚI với mặc định "Không" → gửi false (anh chốt mặc định là Không)', () => {
    const t = than({}, false);
    expect(INITIAL_PETITION_FORM.baoCaoBanGiamDocText).toBe('Không');
    expect(t.baoCaoBanGiamDoc).toBe(false);
  });

  it.each(['Không', 'không', 'KHÔNG', '  khong  ', 'Khong'])(
    'chữ %j → false, không phụ thuộc dấu hay hoa thường',
    (chu) => {
      expect(than({ baoCaoBanGiamDocText: chu }, true).baoCaoBanGiamDoc).toBe(false);
    },
  );

  it.each([
    'Có',
    'Có báo cáo ngày 05/9/2026',
    'Đã báo cáo Ban Giám đốc',
    'không rõ ngày, đã báo cáo',
  ])('chữ %j → true, giữ nguyên 4.085 hồ sơ đang đúng', (chu) => {
    expect(than({ baoCaoBanGiamDocText: chu }, true).baoCaoBanGiamDoc).toBe(true);
  });

  it('ô chữ vẫn được gửi nguyên văn để xoá trắng được', () => {
    expect(than({ baoCaoBanGiamDocText: '' }, true).baoCaoBanGiamDocText).toBe(null);
    expect(than({ baoCaoBanGiamDocText: 'Có' }, true).baoCaoBanGiamDocText).toBe('Có');
  });
});
