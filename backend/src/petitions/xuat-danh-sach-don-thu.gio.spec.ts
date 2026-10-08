import { KHAI_COT_XUAT_DON_THU } from './xuat-danh-sach-don-thu';

/** Cột "Ngày tiếp nhận" của bản xuất Excel kèm GIỜ khi có (09/10/2026). */
describe('KHAI_COT_XUAT_DON_THU — Ngày tiếp nhận + giờ', () => {
  const cot = KHAI_COT_XUAT_DON_THU.find((c) => c.key === 'receivedDate')!;
  const dong = (over: Record<string, unknown>) =>
    ({ receivedDate: new Date('2026-10-08T00:00:00Z'), gioTiepNhan: null, ...over }) as never;

  it('có giờ khai → "<ngày VN> HH:mm" (ngày theo định dạng sẵn có của bản xuất, không đệm 0)', () => {
    expect(cot.doc(dong({ gioTiepNhan: '09:30' }))).toBe('8/10/2026 09:30');
  });

  it('hồ sơ cũ không có giờ → chỉ ngày, KHÔNG bịa giờ (không "07:00")', () => {
    const v = String(cot.doc(dong({})));
    expect(v).toBe('8/10/2026');
    expect(v).not.toContain('07:00');
  });

  it('cột rộng đủ cho "dd/mm/yyyy HH:mm"', () => {
    expect(cot.rong).toBeGreaterThanOrEqual(16);
  });
});
