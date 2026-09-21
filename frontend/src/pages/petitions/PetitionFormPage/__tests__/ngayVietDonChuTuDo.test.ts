import { describe, it, expect } from 'vitest';
import { computeFormErrors } from '../validate';
import { buildPetitionPayload } from '../buildPetitionPayload';
import { INITIAL_PETITION_FORM } from '../types';
import { docNgayVietDon } from '@/shared/ngay-thieu/ngay-viet-don';

/*
  Ca hỏng cán bộ báo 21/09/2026, đi TRỌN đường form: gõ → kiểm → dựng payload.

  Chuỗi này trước đây bị chặn với "Năm phải đủ 4 chữ số" — trong khi năm đã đủ bốn chữ số.
*/
const THAM_SO = { effectiveEdit: false, parityState: {}, metaState: {} } as never;

const CHU = '../../2026, 31/01/2026 (đơn không có chữ ký người đứng đơn)';

/** Điền form như ô nhập vẫn điền, để ca kiểm đi đúng đường sản phẩm. */
function goVaoO(chuGo: string) {
  const ra = docNgayVietDon(chuGo);
  return {
    ...INITIAL_PETITION_FORM,
    detailContent: 'nội dung bắt buộc',
    ngayVietDonEdtf: ra.edtf ?? '',
    petitionDate: ra.ngayThat ?? '',
    ngayVietDonChu: ra.chu ?? '',
  };
}

describe('Ngày viết đơn — chữ tự do đi trọn đường form', () => {
  /*
    CƠ CHẾ thật khiến chuỗi này lưu được: chữ thô KHÔNG còn bị nhét vào cột EDTF.

    Bản cũ dựng `sangEdtf` thẳng từ chữ gõ, ra `"../../2026, 31/01/2026 (…)-XX-XX"` — lệch
    hình dạng nên `loiEdtf` chặn. Nay chữ thô đi vào cột riêng, cột EDTF chỉ nhận thứ đọc hiểu
    được. Ca kiểm bám ĐÚNG chỗ ấy: ô nhập có quay về lối cũ là đỏ ngay.

    (Ca "không còn chặn Lưu" viết trước đó là XANH RỖNG — gieo lỗi vào `validate.ts` không làm
    nó đỏ, vì `loiEdtf` vốn đã cho chuỗi rỗng đi qua.)
  */
  it('chữ thô KHÔNG bị nhét vào cột EDTF, nên không còn chặn Lưu', () => {
    const fd = goVaoO(CHU);
    expect(fd.ngayVietDonEdtf).toMatch(/^(\d{4}-(\d{2}|XX)-(\d{2}|XX))?$/);
    expect(fd.ngayVietDonEdtf).not.toContain('(');
    expect(computeFormErrors(fd, false).fields).not.toContain('field-petitionDate');
  });

  it('chữ không đọc ra ngày nào cũng không chặn, và cột EDTF để rỗng', () => {
    const fd = goVaoO('Không ghi ngày');
    expect(fd.ngayVietDonEdtf).toBe('');
    expect(computeFormErrors(fd, false).fields).not.toContain('field-petitionDate');
  });

  it('payload mang ĐÚNG chữ nguyên văn, không cắt không sửa', () => {
    const p = buildPetitionPayload(goVaoO(CHU), THAM_SO) as Record<string, unknown>;
    expect(p.ngayVietDonChu).toBe(CHU);
  });

  /* Vẫn suy ra được phần đọc hiểu, để hồ sơ còn lọc theo năm. */
  it('vẫn gửi EDTF suy từ mảnh đầu', () => {
    const p = buildPetitionPayload(goVaoO(CHU), THAM_SO) as Record<string, unknown>;
    expect(p.ngayVietDonEdtf).toBe('2026-XX-XX');
  });

  it('ngày gõ sạch vẫn gửi ngày thật và KHÔNG gửi chữ thừa', () => {
    const p = buildPetitionPayload(goVaoO('31/01/2026'), THAM_SO) as Record<string, unknown>;
    expect(p.petitionDate).toBe('2026-01-31');
    expect(p.ngayVietDonChu).toBeNull();
  });

  /*
    Ô ngày SAI thật (thiếu chữ số năm) vẫn phải chặn khi không có chữ nguyên văn — nới lỏng cho
    chữ tự do không được nới luôn cho ngày gõ hụt.
  */
  it('ngày gõ hụt mà KHÔNG có chữ nguyên văn thì vẫn chặn', () => {
    const fd = { ...INITIAL_PETITION_FORM, detailContent: 'x', ngayVietDonEdtf: '20-12-XX', ngayVietDonChu: '' };
    const loi = computeFormErrors(fd, false);
    expect(loi.fields).toContain('field-petitionDate');
  });
});
