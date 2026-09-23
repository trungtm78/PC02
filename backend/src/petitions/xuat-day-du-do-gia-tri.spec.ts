import {
  KHAI_COT_XUAT_DON_THU_DAY_DU,
  COT_CAN_CHO_XUAT_DAY_DU,
  type DongXuatDayDu,
} from './xuat-day-du-don-thu';
import { TRUONG_FORM_DON_THU as MOI_TRUONG } from './khai-truong-form-don-thu.generated';
import { COT_XUAT_DAY_DU_LOAI_TRU } from './cot-xuat-day-du.loai-tru';

/**
 * Chỉ những trường CÒN LẠI trong tệp xuất.
 *
 * Bản sinh giữ trọn 130 trường vì nó là sự thật về FORM; tệp xuất đã cắt 88 khoá đo được là
 * rỗng (xem `cot-xuat-day-du.loai-tru.ts`). Cổng này đo TỆP XUẤT, nên phải lặp trên tập đã cắt
 * — lặp trên cả 130 là đòi tệp có cột nó cố ý không mang.
 */
const DA_CAT = new Set(COT_XUAT_DAY_DU_LOAI_TRU.map((c) => c.khoaLuu));
const TRUONG_FORM_DON_THU = MOI_TRUONG.filter((t) => !DA_CAT.has(t.khoaLuu));

/**
 * CỔNG: bảng xuất đầy đủ phải ra CHỮ, không chỉ ra TIÊU ĐỀ.
 *
 * Đếm đủ 130 tiêu đề cột KHÔNG chứng minh được gì — đó đúng là lớp cổng xanh rỗng dự án đã vấp
 * nhiều lần. Khoá form có thể trỏ vào `metadata` chứ không phải cột Prisma, và có trường cần bộ
 * đọc ghép (`ngayVietDonHienThi` đọc ba cột theo thứ tự). Một bộ đọc trả `null` cho mọi hồ sơ
 * thì tệp vẫn đủ cột, đủ tiêu đề, và trống trơn ở đúng chỗ cán bộ cần.
 *
 * Nên dựng MỘT hồ sơ có dữ liệu ở MỌI trường rồi khẳng định: trường nào có dữ liệu trong kho mà
 * ra ô trống là ĐỎ.
 */
/** Bộ đọc `metadata` dùng trong bảng xuất — chép đúng luật của `docTruong` cho nhánh metadata. */
const docTruongMeta = (khoaLuu: string) => (d: DongXuatDayDu) => {
  const meta = (d.metadata ?? {}) as Record<string, unknown>;
  const v = meta[khoaLuu];
  return v == null ? '' : String(v);
};

describe('CỔNG: xuất đầy đủ đo GIÁ TRỊ', () => {
  /** Hồ sơ có dữ liệu ở mọi trường — cột riêng đổ thẳng, ô hệ cũ nằm trong `metadata`. */
  const HO_SO: DongXuatDayDu = (() => {
    const d: Record<string, unknown> = {
      id: 'p1',
      stt: '2026-11973',
      sttCu: '208',
      status: 'PENDING',
      legacyRaw: null,
    };
    const meta: Record<string, unknown> = {};
    for (const t of MOI_TRUONG) {
      if (t.cot) {
        d[t.cot] = /^ngay[A-Z]/.test(t.cot) || t.cot.endsWith('Date') || t.cot === 'deadline' || t.cot === 'thoiHanUTDT'
          ? new Date('2026-03-04T00:00:00+07:00')
          : `GIA-TRI-${t.cot}`;
      } else {
        // Khoá THẬT trong `metadata`, không phải tên ô đặc tả. Bản đầu của cổng lặp lại đúng
        // khoá sai của mã nên che mất lỗi 44 trường xuất ra ô trống.
        meta[t.khoaLuu] = `META-${t.khoaLuu}`;
      }
    }
    d.metadata = meta;
    // Ngày viết đơn: bộ đọc ghép ưu tiên chữ nguyên văn.
    d.ngayVietDonChu = '19/4/2021 (03 đơn)';
    return d as unknown as DongXuatDayDu;
  })();

  it('danh mục trường không rỗng — cổng rỗng thì chẳng khẳng định được gì', () => {
    expect(MOI_TRUONG.length).toBeGreaterThan(100);
    expect(TRUONG_FORM_DON_THU.length).toBeGreaterThan(30);
    // +3 cột định danh (stt, sttCu, status) không nằm trong bố cục form.
    expect(KHAI_COT_XUAT_DON_THU_DAY_DU.length).toBe(TRUONG_FORM_DON_THU.length + 3);
  });

  it('MỌI cột ra chữ khác rỗng khi hồ sơ có dữ liệu ở mọi trường', () => {
    const trong = KHAI_COT_XUAT_DON_THU_DAY_DU.filter((c) => {
      const v = c.doc(HO_SO);
      return v === null || v === undefined || String(v).trim() === '';
    }).map((c) => `${c.key} (${c.tieuDe})`);
    expect(trong).toEqual([]);
  });

  /**
   * "Khác rỗng" KHÔNG đủ. Lượt soát mô hình ngoài 23/09/2026 thay bộ đọc số điện thoại bằng
   * hằng `"WRONG"` — cả tám mệnh đề vẫn xanh: tệp xuất ra đủ cột, đủ chữ, và sai giá trị ở mọi
   * dòng. Cổng phải so ĐÚNG giá trị mong đợi, tính từ chỗ lưu.
   */
  it('mọi cột ra ĐÚNG giá trị của chỗ lưu, không chỉ khác rỗng', () => {
    const lech: string[] = [];
    for (const t of TRUONG_FORM_DON_THU) {
      const khai = KHAI_COT_XUAT_DON_THU_DAY_DU.find(
        (c) => c.key === (t.cot ?? `meta.${t.khoaLuu}`),
      );
      if (!khai) {
        lech.push(`${t.khoaLuu}: thiếu khai cột`);
        continue;
      }
      const ra = String(khai.doc(HO_SO) ?? '');
      const mongDoi = t.cot
        ? /^ngay[A-Z]/.test(t.cot) || t.cot.endsWith('Date') || t.cot === 'deadline' || t.cot === 'thoiHanUTDT'
          ? '4/3/2026'
          : `GIA-TRI-${t.cot}`
        : `META-${t.khoaLuu}`;
      // "Ngày viết đơn" dùng bộ đọc ghép — có mệnh đề riêng ở dưới.
      if (t.cot === 'petitionDate') continue;
      if (ra !== mongDoi) lech.push(`${khai.key}: ra "${ra}", mong "${mongDoi}"`);
    }
    expect(lech).toEqual([]);
  });

  /** Ba ô CHỈ Đơn thư mới có, không nằm trong bố cục hệ cũ — thiếu là tệp "đầy đủ" nói dối. */
  it.each(['huongXuLy', 'donViGiaiQuyet', 'deXuat'])('có cột "%s"', (k) => {
    expect(KHAI_COT_XUAT_DON_THU_DAY_DU.some((c) => c.key === k)).toBe(true);
  });

  it('KHÔNG khoá lưu nào còn tiền tố `statistic.`', () => {
    expect(TRUONG_FORM_DON_THU.filter((t) => t.khoaLuu.includes('statistic.'))).toEqual([]);
  });

  /**
   * Sau khi cắt 88 khoá rỗng, tệp xuất còn ĐÚNG những ô `metadata` nào? Hôm nay là KHÔNG ô nào
   * — mọi ô `metadata` của bố cục đều đo được là rỗng. Mệnh đề vẫn giữ để ngày một ô quay lại
   * (CLI `kiem:cot-xuat-day-du` bắt được) thì đường đọc `metadata` vẫn đúng.
   */
  it('ô hệ cũ đọc từ `metadata`, không phải từ cột cùng tên', () => {
    const oMeta = TRUONG_FORM_DON_THU.filter((t) => !t.cot);
    if (!oMeta.length) {
      // Không còn ô metadata nào trong tệp — kiểm đường đọc bằng một ô của BẢN SINH đầy đủ.
      const bk = MOI_TRUONG.find((t) => !t.cot);
      // Bản sinh phải còn ô metadata; không còn nghĩa là bộ sinh hỏng.
      // (`expect` của Jest KHÔNG nhận tham số thông điệp như Vitest.)
      expect(bk).toBeDefined();
      expect(docTruongMeta(bk!.khoaLuu)(HO_SO)).toBe(`META-${bk!.khoaLuu}`);
      expect(docTruongMeta(bk!.khoaLuu)({ ...HO_SO, metadata: null })).toBe('');
      return;
    }
    const khai = KHAI_COT_XUAT_DON_THU_DAY_DU.find((c) => c.key === `meta.${oMeta[0].khoaLuu}`);
    expect(khai).toBeDefined();
    expect(khai!.doc(HO_SO)).toBe(`META-${oMeta[0].khoaLuu}`);
    // Không có metadata thì ra rỗng, KHÔNG ném.
    expect(khai!.doc({ ...HO_SO, metadata: null })).toBe('');
  });

  it('"Ngày viết đơn" dùng bộ đọc GHÉP, không đọc trơ cột ngày', () => {
    const khai = KHAI_COT_XUAT_DON_THU_DAY_DU.find((c) => c.key === 'petitionDate');
    expect(khai).toBeDefined();
    // Hồ sơ chỉ có CHỮ nguyên văn, cột ngày rỗng — bộ đọc trơ sẽ trả rỗng.
    expect(
      khai!.doc({
        ...HO_SO,
        petitionDate: null,
        ngayVietDonEdtf: null,
        ngayVietDonChu: '19/4/2021 (03 đơn), 20/4/2021 (9 đơn)',
      }),
    ).toContain('19/4/2021');
  });

  it('cột ngày in theo định dạng Việt Nam, không in ISO', () => {
    const khai = KHAI_COT_XUAT_DON_THU_DAY_DU.find((c) => c.key === 'ngayDeXuat');
    expect(khai).toBeDefined();
    // `ngayVN` của kho mã in không đệm số 0 — giữ đúng hành vi đang có, không đổi theo ý mình.
    expect(khai!.doc(HO_SO)).toBe('4/3/2026');
  });

  it('`select` chứa ĐỦ mọi cột mà bộ đọc cần — thiếu một cột là ô trống vĩnh viễn', () => {
    const can = new Set(COT_CAN_CHO_XUAT_DAY_DU);
    const thieu = TRUONG_FORM_DON_THU.filter((t) => t.cot && !can.has(t.cot)).map((t) => t.cot);
    expect(thieu).toEqual([]);
    for (const c of ['metadata', 'ngayVietDonEdtf', 'ngayVietDonChu', 'legacyRaw', 'stt', 'status'])
      expect(can.has(c)).toBe(true);
  });

  it('khoá cột KHÔNG trùng nhau — trùng là Excel mất cột', () => {
    const khoa = KHAI_COT_XUAT_DON_THU_DAY_DU.map((c) => c.key);
    expect(khoa.length).toBe(new Set(khoa).size);
  });

  it('tiêu đề cột lấy NGUYÊN VĂN nhãn trên màn', () => {
    for (const t of TRUONG_FORM_DON_THU.slice(0, 20)) {
      const khai = KHAI_COT_XUAT_DON_THU_DAY_DU.find(
        (c) => c.key === (t.cot ?? `meta.${t.khoaLuu}`),
      );
      expect(khai?.tieuDe).toBe(t.caption);
    }
  });
});
