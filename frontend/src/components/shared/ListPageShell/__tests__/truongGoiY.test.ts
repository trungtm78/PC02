import { describe, it, expect } from 'vitest';
import { truongGoiY } from '../truongGoiY';

const KHAI = [
  { key: 'stt', nhan: 'STT', kieu: 'ma' },
  { key: 'sttCu', nhan: 'STT cũ', kieu: 'ma-cu' },
  { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
] as const;

describe('truongGoiY', () => {
  it('đúng thứ tự cột, trải cột nhiều khoá, bỏ trùng, bỏ cột không tìm được', () => {
    const cot = [
      { key: 'actions' },
      { key: 'nguoi', timKiem: 'nguoiGui' },
      { key: 'stt', timKiem: ['stt', 'sttCu'] },
      { key: 'nguoi2', timKiem: 'nguoiGui' },
    ];
    expect(truongGoiY(cot, KHAI).map((t) => t.key)).toEqual(['nguoiGui', 'stt', 'sttCu']);
  });

  it('khoá không có trong khai thì không gợi ý', () => {
    expect(truongGoiY([{ key: 'x', timKiem: 'khongCo' }], KHAI)).toEqual([]);
  });
});
