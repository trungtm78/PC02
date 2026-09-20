import { describe, expect, it } from 'vitest';
import { computeFormErrors } from '../validate';
import { INITIAL_PETITION_FORM, type PetitionFormData } from '../types';
import corpus from '@/shared/nguon-don/truc-tiep.corpus.json';

/** Lấy tên từ BỘ TÊN CHUẨN dùng chung — không bên nào được tự chọn mẫu dễ cho mình. */
const KHONG_TRUC_TIEP = corpus.khong_truc_tiep.filter(Boolean);
const TRUC_TIEP = corpus.truc_tiep;

/**
 * Số điện thoại nguyên đơn bắt buộc CÓ ĐIỀU KIỆN — bản trình duyệt.
 *
 * Phải khớp TỪNG CA với máy chủ (`backend/src/petitions/sdt-bat-buoc-theo-nguon-don.spec.ts`),
 * vì cả hai gọi cùng một hàm thuần `laNguonTrucTiep`. Lệch nhau là form cho Lưu rồi máy chủ
 * trả 400 — cán bộ gõ xong mới biết.
 */
const co = (p: Partial<PetitionFormData>): PetitionFormData => ({
  ...INITIAL_PETITION_FORM,
  senderName: 'Nguyễn Văn A',
  senderAddress: 'Địa chỉ',
  detailContent: 'Nội dung',
  crimeChinhId: 'c1',
  receivedDate: '2026-09-20',
  ...p,
});

const loiSdt = (fd: PetitionFormData) =>
  computeFormErrors(fd, false).fields.filter((f) => f === 'field-senderPhone');

describe('validate.ts — SĐT theo Nguồn đơn', () => {
  it('Trực tiếp + trống SĐT → CHẶN', () => {
    expect(loiSdt(co({ nguonDon: 'Trực tiếp', senderPhone: '' }))).toHaveLength(1);
  });

  it.each(KHONG_TRUC_TIEP)('Nguồn "%s" + trống SĐT → LƯU ĐƯỢC', (nguonDon) => {
    expect(loiSdt(co({ nguonDon, senderPhone: '' }))).toHaveLength(0);
  });

  it.each(TRUC_TIEP)('Nguồn "%s" + trống SĐT → CHẶN', (nguonDon) => {
    expect(loiSdt(co({ nguonDon, senderPhone: '' }))).toHaveLength(1);
  });

  it('chưa chọn nguồn thì KHÔNG ép nhập', () => {
    expect(loiSdt(co({ nguonDon: '', senderPhone: '' }))).toHaveLength(0);
  });

  it('đơn nặc danh không bắt buộc, kể cả Trực tiếp', () => {
    expect(
      loiSdt(co({ nguonDon: 'Trực tiếp', senderPhone: '', senderIsAnonymous: true })),
    ).toHaveLength(0);
  });

  it('SĐT sai định dạng VẪN chặn ở mọi nguồn — nới "bắt buộc" không phải nới "hợp lệ"', () => {
    expect(loiSdt(co({ nguonDon: 'Bưu điện', senderPhone: '123' }))).toHaveLength(1);
  });

  it('Trực tiếp + SĐT hợp lệ → qua', () => {
    expect(loiSdt(co({ nguonDon: 'Trực tiếp', senderPhone: '0901234567' }))).toHaveLength(0);
  });
});
