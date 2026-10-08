import { describe, expect, it } from 'vitest';
import { phanNapLaiSauKhiTao } from '../PetitionFormPage/ketQuaTao';
import { buildPetitionPayload } from '../PetitionFormPage/buildPetitionPayload';
import { taoFormDonThuMoi } from '../PetitionFormPage/types';

/**
 * Codex bắt trên PR chép đơn: sau POST tạo đơn, form chỉ nạp lại `stt`, không nạp `deadline` máy chủ vừa
 * tính. Lần lưu kế (PUT — vd upload tệp lỗi rồi lưu lại, hoặc "Lưu và xuất file" ở lại form) gửi
 * `deadline: null` và XOÁ hạn vừa tính. Lỗi có sẵn cho mọi đơn tạo mới; đơn chép từng không lộ vì mang
 * sẵn hạn của đơn cũ, nay hạn để trống nên lộ ra.
 */
describe('nạp lại giá trị máy chủ cấp sau khi tạo đơn', () => {
  it('nạp cả số tiếp nhận thật lẫn hạn giải quyết máy chủ vừa tính (đổi sang ngày giờ Việt Nam)', () => {
    const patch = phanNapLaiSauKhiTao({ id: 'p1', stt: '2026-12345', deadline: '2026-11-06T17:00:00.000Z' });
    expect(patch.stt).toBe('2026-12345');
    expect(patch.deadline).toBe('2026-11-07');
  });

  it('thiếu hạn trong phản hồi thì KHÔNG đưa khoá deadline vào (giữ giá trị người dùng đang có)', () => {
    expect(phanNapLaiSauKhiTao({ id: 'p1', stt: '2026-1' })).toEqual({ stt: '2026-1' });
    expect(phanNapLaiSauKhiTao({ id: 'p1', deadline: null })).toEqual({});
    expect(phanNapLaiSauKhiTao(undefined)).toEqual({});
  });

  it('hạn không đọc được thì bỏ qua, không ghi chuỗi rác vào form', () => {
    expect(phanNapLaiSauKhiTao({ deadline: 'không phải ngày' })).toEqual({});
  });

  it('lần lưu kế (PUT) gửi hạn ĐÃ NẠP chứ không gửi null xoá hạn', () => {
    const form = { ...taoFormDonThuMoi(), senderName: 'A', summary: 's' };
    const truocKhiNap = buildPetitionPayload(form, { effectiveEdit: true, parityState: {}, metaState: {} });
    expect(truocKhiNap.deadline).toBeNull(); // mô tả lỗi: ô rỗng gửi null, máy chủ xoá hạn

    const sauKhiNap = buildPetitionPayload(
      { ...form, ...phanNapLaiSauKhiTao({ deadline: '2026-11-06T17:00:00.000Z' }) },
      { effectiveEdit: true, parityState: {}, metaState: {} },
    );
    expect(sauKhiNap.deadline).toBe('2026-11-07');
  });
});
