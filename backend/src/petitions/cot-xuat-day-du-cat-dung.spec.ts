import {
  KHAI_COT_XUAT_DON_THU_DAY_DU,
  COT_CAN_CHO_XUAT_DAY_DU,
} from './xuat-day-du-don-thu';
import { TRUONG_FORM_DON_THU } from './khai-truong-form-don-thu.generated';
import { COT_XUAT_DAY_DU_LOAI_TRU } from './cot-xuat-day-du.loai-tru';
import { khoaCatNhamCoDuLieu } from './cli/kiem-cot-xuat-day-du';
import { docTruong } from './xuat-day-du-don-thu';

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

  /**
   * Cắt xong phải còn lại một tệp có ích — nhưng KHÔNG khoá bằng một con số tổng.
   *
   * Bản đầu viết `expect(conLai).toBe(cotRieng + 3)`, tức đòi MỌI ô metadata phải còn bị cắt.
   * Thế là chặn đúng việc mà cổng chống mục sinh ra để làm: khi CLI báo một ô đã có dữ liệu,
   * cách xử lý là XOÁ nó khỏi danh sách loại trừ — và cổng sẽ đỏ với "expected 45, received 46".
   * Cổng khoá cứng một con số thì mọi lần sửa đúng đều là đỏ.
   */
  it('giữ TRỌN cột riêng CÓ dữ liệu — không cắt nhầm cột nào', () => {
    const daCat = new Set(COT_XUAT_DAY_DU_LOAI_TRU.map((c) => c.khoaLuu));
    // Chỉ đòi giữ cột KHÔNG nằm trong danh sách cắt. Đòi giữ trọn 42 cột là chặn đúng việc
    // anh yêu cầu 23/09 (cắt cột rỗng) — cùng lớp lỗi "cổng chặn việc sửa đúng" đã vấp.
    const conLai = TRUONG_FORM_DON_THU.filter((t) => t.cot && !daCat.has(t.cot))
      .map((t) => t.cot as string);
    expect(conLai.length).toBeGreaterThan(35);
    const thieu = conLai.filter(
      (c) => !KHAI_COT_XUAT_DON_THU_DAY_DU.some((k) => k.key === c),
    );
    expect(thieu).toEqual([]);
    for (const k of ['senderName', 'detailContent', 'ketQuaXuLyKhac', 'loaiThongTin'])
      expect(KHAI_COT_XUAT_DON_THU_DAY_DU.some((c) => c.key === k)).toBe(true);
  });

  /** Và ô metadata KHÔNG nằm trong danh sách cắt thì PHẢI có trong tệp — đường đưa cột trở lại. */
  it('ô metadata chưa bị cắt thì vẫn vào tệp', () => {
    const daCat = new Set(COT_XUAT_DAY_DU_LOAI_TRU.map((c) => c.khoaLuu));
    const conMeta = TRUONG_FORM_DON_THU.filter((t) => !t.cot && !daCat.has(t.khoaLuu));
    for (const t of conMeta)
      expect(KHAI_COT_XUAT_DON_THU_DAY_DU.some((c) => c.key === `meta.${t.khoaLuu}`)).toBe(true);
  });

  /**
   * Bộ đọc `metadata` phải là bộ đọc THẬT của tệp xuất, không phải bản chép trong ca kiểm.
   * Lượt soát mô hình ngoài 23/09 tắt bộ đọc thật mà cả 25 mệnh đề vẫn xanh — vì ca kiểm đang
   * đo chính bản chép của nó.
   */
  it('bộ đọc metadata THẬT đọc đúng khoá lưu', () => {
    const doc = docTruong('soDangKyHoSo', null);
    expect(doc({ metadata: { soDangKyHoSo: 'HS-1' } } as never)).toBe('HS-1');
    expect(doc({ metadata: null } as never)).toBe('');
    // Mảng rỗng ra CHUỖI RỖNG — phép đo của CLI phải cùng nghĩa này.
    expect(doc({ metadata: { soDangKyHoSo: [] } } as never)).toBe('');
  });

  /**
   * NĂM ô trong nhóm gập CÓ dữ liệu thật — gập không phải lý do để cắt.
   *
   * ĐÍNH CHÍNH 23/09/2026: bản đầu liệt kê SÁU ô, gồm `lanhDaoToTung`. Đo trên prod 47.626 hồ
   * sơ thì ô ấy rỗng 0 — em suy từ một ô (CCCĐ 3.335 hồ sơ) ra cả nhóm thay vì đo từng ô. Nó
   * bị cắt vì RỖNG, không phải vì gập.
   */
  it.each(['senderIdNumber', 'senderIdIssueDate', 'senderIdIssuePlace', 'senderBirthYear', 'dieuTraVien'])(
    'ô trong nhóm gập "%s" VẪN có trong tệp',
    (k) => {
      expect(KHAI_COT_XUAT_DON_THU_DAY_DU.some((c) => c.key === k)).toBe(true);
    },
  );

  /**
   * Anh chốt 23/09/2026: "trường nào trong toàn bộ data không có thì không đưa vào". Luật ấy
   * áp cho CẢ HAI loại chỗ lưu, không riêng `metadata` — đợt trước em chỉ cắt metadata.
   */
  it('danh sách cắt gồm CẢ hai loại: metadata VÀ cột riêng', () => {
    const theoLoai = (l: string) => COT_XUAT_DAY_DU_LOAI_TRU.filter((c) => c.loai === l).length;
    expect(theoLoai('metadata')).toBeGreaterThan(50);
    // Chỉ cắt metadata là bỏ sót 42 cột riêng — đúng lỗi anh báo 23/09.
    // (`expect` của Jest KHÔNG nhận tham số thông điệp như Vitest.)
    expect(theoLoai('cot')).toBeGreaterThan(0);
  });

  it.each(['lanhDaoToTung', 'ngayXayRa', 'noiXayRaPhuongXa'])(
    'cột riêng rỗng "%s" KHÔNG còn trong tệp',
    (k) => {
      expect(KHAI_COT_XUAT_DON_THU_DAY_DU.some((c) => c.key === k)).toBe(false);
      expect(COT_XUAT_DAY_DU_LOAI_TRU.some((c) => c.khoaLuu === k && c.loai === 'cot')).toBe(true);
    },
  );

  /** Mỗi dòng loại trừ phải khai ĐÚNG loại: đo nhầm loại thì kết quả luôn 0 và cổng xanh rỗng. */
  it('loại khai khớp với chỗ lưu thật trong bản sinh', () => {
    const theoKhoa = new Map(TRUONG_FORM_DON_THU.map((t) => [t.khoaLuu, t]));
    const lech = COT_XUAT_DAY_DU_LOAI_TRU.filter((c) => {
      const t = theoKhoa.get(c.khoaLuu);
      return !t || (t.cot ? c.loai !== 'cot' : c.loai !== 'metadata');
    }).map((c) => `${c.khoaLuu}: khai '${c.loai}'`);
    expect(lech).toEqual([]);
  });

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
