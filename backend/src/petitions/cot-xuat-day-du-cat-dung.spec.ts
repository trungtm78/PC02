import {
  KHAI_COT_XUAT_DON_THU_DAY_DU,
  COT_CAN_CHO_XUAT_DAY_DU,
} from './xuat-day-du-don-thu';
import { TRUONG_FORM_DON_THU } from './khai-truong-form-don-thu.generated';
import { COT_XUAT_DAY_DU_LOAI_TRU } from './cot-xuat-day-du.loai-tru';
import { khoaCatNhamCoDuLieu } from './cli/kiem-cot-xuat-day-du';

/**
 * CỔNG: tệp "Xuất Excel (mọi trường)" không được mang cột rỗng.
 *
 * Anh báo 23/09/2026 tệp có "rất nhiều field dư thừa". Đo: 88/130 cột RỖNG trên cả 46.741 hồ sơ
 * — 68% tệp là cột trắng, toàn ô giai đoạn Vụ án/Vụ việc mà một đơn thư chưa chuyển không bao
 * giờ đi tới.
 */
describe('CỔNG: cắt cột rỗng khỏi tệp xuất đầy đủ', () => {
  it('danh sách loại trừ không rỗng và mọi khoá CÓ THẬT trong bản sinh', () => {
    expect(COT_XUAT_DAY_DU_LOAI_TRU.length).toBeGreaterThan(50);
    const coThat = new Set(TRUONG_FORM_DON_THU.map((t) => t.khoaLuu));
    const la = COT_XUAT_DAY_DU_LOAI_TRU.filter((c) => !coThat.has(c.khoaLuu));
    expect(la).toEqual([]);
  });

  /**
   * Lý do phải KÈM SỐ ĐO và NGÀY ĐO, không phải "lý do viết sẵn". Danh sách loại trừ không đo
   * được là danh sách sẽ mục: ô nào đó có dữ liệu trở lại mà không ai biết.
   */
  it('mỗi khoá loại trừ có số đo và ngày đo', () => {
    for (const c of COT_XUAT_DAY_DU_LOAI_TRU) {
      expect(c.lyDo).toMatch(/\d/);
      expect(c.doNgay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('bảng xuất KHÔNG còn cột nào đã cắt', () => {
    const daCat = new Set(COT_XUAT_DAY_DU_LOAI_TRU.map((c) => `meta.${c.khoaLuu}`));
    const con = KHAI_COT_XUAT_DON_THU_DAY_DU.filter((c) => daCat.has(c.key));
    expect(con.map((c) => c.key)).toEqual([]);
  });

  /** Cắt xong phải còn lại một tệp có ích, không phải cắt trụi. */
  it('vẫn giữ trọn cột có chỗ lưu thật', () => {
    const conLai = KHAI_COT_XUAT_DON_THU_DAY_DU.length;
    const cotRieng = TRUONG_FORM_DON_THU.filter((t) => t.cot).length;
    expect(conLai).toBe(cotRieng + 3); // +3 cột định danh (stt, sttCu, status)
    expect(cotRieng).toBeGreaterThan(35);
    for (const k of ['senderName', 'detailContent', 'ketQuaXuLyKhac', 'loaiThongTin'])
      expect(KHAI_COT_XUAT_DON_THU_DAY_DU.some((c) => c.key === k)).toBe(true);
  });

  /** Sáu ô trong nhóm gập CÓ dữ liệu thật (3.335 hồ sơ có CCCĐ) — gập không phải lý do để cắt. */
  it.each(['senderIdNumber', 'senderIdIssueDate', 'senderIdIssuePlace', 'senderBirthYear', 'dieuTraVien', 'lanhDaoToTung'])(
    'ô trong nhóm gập "%s" VẪN có trong tệp',
    (k) => {
      expect(KHAI_COT_XUAT_DON_THU_DAY_DU.some((c) => c.key === k)).toBe(true);
    },
  );

  it('`select` không đòi cột nào thừa sau khi cắt', () => {
    expect(COT_CAN_CHO_XUAT_DAY_DU).toContain('metadata');
    expect(new Set(COT_CAN_CHO_XUAT_DAY_DU).size).toBe(COT_CAN_CHO_XUAT_DAY_DU.length);
  });

  /** Phép so của CLI — cổng gọi thẳng hàm CLI dùng, không chép lại luật. */
  it('phép so của CLI bắt đúng khoá đã cắt mà nay có dữ liệu', () => {
    expect(khoaCatNhamCoDuLieu([{ khoaLuu: 'a', soHoSo: 0 }])).toEqual([]);
    expect(khoaCatNhamCoDuLieu([{ khoaLuu: 'a', soHoSo: 1 }])).toEqual([
      { khoaLuu: 'a', soHoSo: 1 },
    ]);
  });
});
