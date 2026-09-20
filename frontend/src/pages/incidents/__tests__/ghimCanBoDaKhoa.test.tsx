import { describe, expect, it } from 'vitest';
import { gomCanBoTheoTo, NHOM_GHIM } from '@/hooks/gomCanBoTheoTo';
import type { OfficerOption } from '@/hooks/useOfficerOptions';

/**
 * Cán bộ ĐÃ BỊ KHOÁ mà hồ sơ đang trỏ tới phải được GHIM đầu danh sách.
 *
 * `useOfficerOptions` lọc `status: active`; lời gọi riêng ngày trước thì không. Nên một điều
 * tra viên bị khoá trước đây vẫn hiện tên, nay biến mất khỏi danh sách: ô hiện chữ gợi ý,
 * trông như chưa phân công, và cán bộ chọn người khác — PHÂN CÔNG LẠI NGẦM.
 *
 * Ba màn (Đơn thư, Vụ án, Vụ việc) đều phải truyền id đang giữ vào `gomCanBoTheoTo`.
 */
const DS: OfficerOption[] = [
  { value: 'a', label: 'Nguyễn Văn A', teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }] },
];

describe('Ghim cán bộ đã khoá mà hồ sơ đang trỏ tới', () => {
  it('KHÔNG truyền id đang giữ → người ấy biến mất khỏi danh sách', () => {
    const co = gomCanBoTheoTo(DS).flatMap((n) => n.options.map((o) => o.value));
    expect(co).not.toContain('da-khoa');
  });

  it('truyền id đang giữ + mục giữ lại → GHIM đầu danh sách', () => {
    const giuLai: OfficerOption = { value: 'da-khoa', label: 'Lê Đã Khoá (không còn hoạt động)', teams: [] };
    const nhom = gomCanBoTheoTo([giuLai, ...DS], 'da-khoa');
    expect(nhom[0].key).toBe(NHOM_GHIM);
    expect(nhom[0].options[0].value).toBe('da-khoa');
  });
});
