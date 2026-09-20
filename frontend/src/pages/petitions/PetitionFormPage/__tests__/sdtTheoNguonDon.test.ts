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

/**
 * Ngày viết đơn ráp lại phải CÓ THẬT — chặn lúc Lưu, không chỉ hiện chữ đỏ dưới ô.
 *
 * Chữ đỏ dưới ô mà vẫn Lưu được thì cán bộ bấm Lưu, máy chủ trả 400, và thông báo ấy khó
 * hiểu hơn hẳn lỗi tại chỗ.
 */
describe('validate.ts — Ngày viết đơn phải có thật', () => {
  const loiNgay = (fd: PetitionFormData) =>
    computeFormErrors(fd, false).fields.filter((f) => f === 'field-petitionDate');

  it.each(['2026-02-31', '2026-13-01', '2025-02-29'])('CHẶN "%s"', (edtf) => {
    expect(loiNgay(co({ ngayVietDonEdtf: edtf }))).toHaveLength(1);
  });

  it.each(['2026-12-15', '2026-12-XX', '2026-XX-XX', '2024-02-29', ''])('nhận "%s"', (edtf) => {
    expect(loiNgay(co({ ngayVietDonEdtf: edtf }))).toHaveLength(0);
  });
});
