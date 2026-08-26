import { describe, it, expect } from 'vitest';
import nguonBuilder from '../buildPetitionPayload.ts?raw';
import nguonTrang from '../PetitionFormPage.tsx?raw';
import { buildPetitionPayload } from '../buildPetitionPayload';
import { INITIAL_PETITION_FORM, type PetitionFormData } from '../petition-form-types';

/**
 * CỔNG: mọi ô cán bộ nhìn thấy trên form Đơn thư, khi xoá trắng rồi bấm Lưu, phải gửi `null`.
 *
 * Máy chủ chỉ ghi những khoá CÓ MẶT trong lời gọi (`dto.X !== undefined`). Ô rỗng bị bỏ khỏi
 * thân lời gọi thì thao tác xoá báo thành công mà giá trị cũ vẫn nằm nguyên dưới cơ sở dữ
 * liệu — cán bộ mở lại thấy thứ mình vừa xoá.
 *
 * Đã kiểm chiều ngược TRƯỚC khi đổi (bài học PR #245): 43/43 ô gửi `null` đều nạp lại được từ
 * máy chủ qua đường merge của trang. Ô trống trên màn Sửa vì thế thật sự nghĩa là cán bộ đã
 * xoá, không phải form chưa nạp.
 */

/** Đọc thẳng từ mã nguồn để cổng không phải liệt kê tay — thêm ô mới là tự được phủ. */
const O_GUI_NULL: string[] = Array.from(
  nguonBuilder.matchAll(/(?:\w+): oHeCu\(formData\.(\w+)\)/g),
).map((m) => m[1]);

function payload(sua: Partial<PetitionFormData>): Record<string, unknown> {
  return buildPetitionPayload({ ...INITIAL_PETITION_FORM, ...sua } as PetitionFormData, {
    effectiveEdit: true,
  });
}

describe('Xoá trắng một ô Đơn thư rồi lưu — giá trị cũ phải mất theo', () => {
  it('đọc được danh sách ô từ mã nguồn, không rơi về rỗng khi biểu thức hỏng', () => {
    expect(O_GUI_NULL.length).toBeGreaterThanOrEqual(40);
  });

  it.each(O_GUI_NULL)('ô "%s" xoá trắng thì gửi null, không bỏ khoá', (khoa) => {
    const p = payload({ [khoa]: '' } as Partial<PetitionFormData>);
    expect(p).toHaveProperty(khoa);
    expect(p[khoa]).toBeNull();
  });

  /**
   * Ô Tóm tắt đã ẩn khỏi giao diện — nội dung của nó cắt từ ô "Nội dung". Xoá Nội dung mà tóm
   * tắt ở lại thì danh sách Đơn thư vẫn hiện đoạn văn cán bộ vừa xoá.
   */
  it('xoá Nội dung thì Tóm tắt suy ra cũng mất theo', () => {
    const p = payload({ detailContent: '' });
    expect(p.detailContent).toBeNull();
    expect(p.summary).toBeNull();
  });

  /**
   * Ô không có chỗ nhập thì giữ nguyên ngữ nghĩa cũ. Cán bộ không xoá trắng được thứ mình
   * không nhìn thấy, nên gửi `null` ở đây chỉ thêm đường xoá nhầm.
   */
  it('ô không có chỗ nhập không bị đổi sang gửi null', () => {
    const p = payload({ assignedTeamId: '' });
    expect(p.assignedTeamId).toBeUndefined();
  });
});

describe('Trang Đơn thư phải dùng hàm dựng payload đã vá', () => {
  /**
   * Ca kiểm này canh chỗ hỏng THẬT. Hàm `buildPetitionPayload` có đúng cách mấy mà trang vẫn
   * tự dựng thân lời gọi bằng `|| undefined` thì cán bộ vẫn không xoá được ô nào.
   */
  it('PetitionFormPage không còn tự dựng payload bằng "|| undefined"', () => {
    const con = Array.from(nguonTrang.matchAll(/formData\.(\w+) \|\| undefined/g)).map(
      (m) => m[1],
    );
    expect(con).toEqual([]);
  });

  it('PetitionFormPage gọi buildPetitionPayload', () => {
    expect(nguonTrang).toContain('buildPetitionPayload(formData');
  });
});
