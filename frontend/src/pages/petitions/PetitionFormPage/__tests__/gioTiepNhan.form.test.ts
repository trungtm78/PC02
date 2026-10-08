/**
 * Giờ tiếp nhận ở form Đơn thư (09/10/2026): kiểm tra, gói tin gửi máy chủ, giá trị khởi tạo.
 *
 * Nguyên tắc kiểm: không bao giờ bịa giờ cho hồ sơ cũ (ô rỗng → null), tạo mới mặc định là GIỜ HIỆN TẠI tính lúc gọi,
 * xoá trắng ô phải gửi `null` (bỏ khoá thì không xoá được giờ đã lưu).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeFormErrors, loiGioTiepNhan } from '../validate';
import { buildPetitionPayload } from '../buildPetitionPayload';
import { INITIAL_PETITION_FORM, taoFormDonThuMoi, type PetitionFormData } from '../types';
import { LOI_GIO_KHONG_HOP_LE, LOI_GIO_TUONG_LAI } from '@/lib/gioPhut';

const nen = (p: Partial<PetitionFormData> = {}): PetitionFormData => ({
  ...INITIAL_PETITION_FORM,
  receivedDate: '2026-08-01',
  senderName: 'Nguyễn Văn A',
  senderAddress: '12 Lê Lợi',
  senderPhone: '0912345678',
  crimeChinhId: 'crime-1',
  detailContent: 'Nội dung đơn',
  ...p,
});

afterEach(() => vi.useRealTimers());

describe('loiGioTiepNhan', () => {
  it('rỗng → KHÔNG lỗi (ô không bắt buộc: rỗng = không biết giờ)', () => {
    expect(loiGioTiepNhan({ gioTiepNhan: '', receivedDate: '2026-08-01' })).toBeNull();
    expect(loiGioTiepNhan({ gioTiepNhan: '   ', receivedDate: '2026-08-01' })).toBeNull();
  });

  it('thiếu khoá (dữ liệu dựng từ nguồn cũ) → không lỗi, không ném', () => {
    expect(loiGioTiepNhan({ receivedDate: '2026-08-01' } as never)).toBeNull();
  });

  it.each(['09:30', '00:00', '23:59'])('"%s" hợp lệ, ngày quá khứ', (g) => {
    expect(loiGioTiepNhan({ gioTiepNhan: g, receivedDate: '2026-08-01' })).toBeNull();
  });

  it.each(['8:3', '24:00', '09:60', '0930', '08:', 'abc', '09:30:00'])('"%s" → không hợp lệ (đang gõ dở/ngoài khoảng KHÔNG được lưu)', (g) => {
    expect(loiGioTiepNhan({ gioTiepNhan: g, receivedDate: '2026-08-01' })).toBe(LOI_GIO_KHONG_HOP_LE);
  });

  it('hôm nay + giờ ở tương lai (vượt dung sai 5 phút) → lỗi; trong dung sai hoặc đã qua → qua', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T07:00:00Z')); // 14:00 giờ VN
    const hom = '2026-10-08';
    expect(loiGioTiepNhan({ gioTiepNhan: '14:06', receivedDate: hom })).toBe(LOI_GIO_TUONG_LAI);
    expect(loiGioTiepNhan({ gioTiepNhan: '23:59', receivedDate: hom })).toBe(LOI_GIO_TUONG_LAI);
    expect(loiGioTiepNhan({ gioTiepNhan: '14:05', receivedDate: hom })).toBeNull();
    expect(loiGioTiepNhan({ gioTiepNhan: '09:30', receivedDate: hom })).toBeNull();
    // Ngày QUÁ KHỨ: giờ nào cũng được.
    expect(loiGioTiepNhan({ gioTiepNhan: '23:59', receivedDate: '2026-10-07' })).toBeNull();
  });
});

describe('computeFormErrors — ô giờ', () => {
  it('giờ hợp lệ hoặc rỗng không thêm lỗi', () => {
    expect(computeFormErrors(nen({ gioTiepNhan: '09:30' }), false).msgs).toEqual([]);
    expect(computeFormErrors(nen({ gioTiepNhan: '' }), false).msgs).toEqual([]);
  });

  it('giờ sai → chặn Lưu và trỏ đúng ô field-gioTiepNhan', () => {
    const r = computeFormErrors(nen({ gioTiepNhan: '8:3' }), false);
    expect(r.msgs).toContain(LOI_GIO_KHONG_HOP_LE);
    expect(r.fields).toContain('field-gioTiepNhan');
  });

  it('lỗi giờ đứng NGAY SAU lỗi ngày (đúng thứ tự trên màn: ngày rồi giờ cạnh nhau)', () => {
    const r = computeFormErrors(nen({ receivedDate: '', gioTiepNhan: '99:99' }), false);
    expect(r.fields.slice(0, 2)).toEqual(['field-receivedDate', 'field-gioTiepNhan']);
  });
});

describe('buildPetitionPayload — gioTiepNhan', () => {
  const dung = (fd: PetitionFormData, edit = false) =>
    buildPetitionPayload(fd, { effectiveEdit: edit, parityState: {}, metaState: {} } as never);

  it('có giờ → gửi nguyên giá trị', () => {
    expect(dung(nen({ gioTiepNhan: '09:30' })).gioTiepNhan).toBe('09:30');
  });

  it('ô TRỐNG → gửi null, KHÔNG bỏ khoá (bỏ khoá thì sửa không xoá được giờ đã lưu)', () => {
    const p = dung(nen({ gioTiepNhan: '' }), true);
    expect('gioTiepNhan' in p).toBe(true);
    expect(p.gioTiepNhan).toBeNull();
  });

  it('chỉ toàn khoảng trắng cũng là null', () => {
    expect(dung(nen({ gioTiepNhan: '  ' })).gioTiepNhan).toBeNull();
  });
});

describe('khởi tạo form', () => {
  it('hằng INITIAL_PETITION_FORM KHÔNG mang giờ (không bao giờ bịa giờ cho hồ sơ nạp từ nguồn cũ)', () => {
    expect(INITIAL_PETITION_FORM.gioTiepNhan).toBe('');
  });

  it('taoFormDonThuMoi() cho GIỜ HIỆN TẠI VN, tính LÚC GỌI', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T07:00:00Z')); // 14:00 VN
    expect(taoFormDonThuMoi().gioTiepNhan).toBe('14:00');
    vi.setSystemTime(new Date('2026-10-08T07:37:00Z'));
    expect(taoFormDonThuMoi().gioTiepNhan).toBe('14:37');
  });

  it('rạng sáng VN: 00:05, không phải "24:05" (17:05Z hôm trước)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T17:05:00Z'));
    const f = taoFormDonThuMoi();
    expect(f.gioTiepNhan).toBe('00:05');
    expect(f.receivedDate).toBe('2026-10-08');
  });

  it('giờ mặc định luôn hợp lệ với chính phép kiểm của form (không tạo đơn mà bấm Lưu bị chặn ngay)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T07:00:00Z'));
    const f = taoFormDonThuMoi();
    expect(loiGioTiepNhan(f)).toBeNull();
  });
});
