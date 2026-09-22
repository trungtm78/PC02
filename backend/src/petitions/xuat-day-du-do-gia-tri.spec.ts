import {
  KHAI_COT_XUAT_DON_THU_DAY_DU,
  COT_CAN_CHO_XUAT_DAY_DU,
  type DongXuatDayDu,
} from './xuat-day-du-don-thu';
import { TRUONG_FORM_DON_THU } from './khai-truong-form-don-thu.generated';

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
    for (const t of TRUONG_FORM_DON_THU) {
      if (t.cot) {
        d[t.cot] = /^ngay[A-Z]/.test(t.cot) || t.cot.endsWith('Date') || t.cot === 'deadline' || t.cot === 'thoiHanUTDT'
          ? new Date('2026-03-04T00:00:00+07:00')
          : `GIA-TRI-${t.cot}`;
      } else {
        meta[t.field] = `META-${t.field}`;
      }
    }
    d.metadata = meta;
    // Ngày viết đơn: bộ đọc ghép ưu tiên chữ nguyên văn.
    d.ngayVietDonChu = '19/4/2021 (03 đơn)';
    return d as unknown as DongXuatDayDu;
  })();

  it('danh mục trường không rỗng — cổng rỗng thì chẳng khẳng định được gì', () => {
    expect(TRUONG_FORM_DON_THU.length).toBeGreaterThan(100);
    expect(KHAI_COT_XUAT_DON_THU_DAY_DU.length).toBe(TRUONG_FORM_DON_THU.length + 3);
  });

  it('MỌI cột ra chữ khác rỗng khi hồ sơ có dữ liệu ở mọi trường', () => {
    const trong = KHAI_COT_XUAT_DON_THU_DAY_DU.filter((c) => {
      const v = c.doc(HO_SO);
      return v === null || v === undefined || String(v).trim() === '';
    }).map((c) => `${c.key} (${c.tieuDe})`);
    expect(trong).toEqual([]);
  });

  it('ô hệ cũ đọc từ `metadata`, không phải từ cột cùng tên', () => {
    const oMeta = TRUONG_FORM_DON_THU.filter((t) => !t.cot);
    expect(oMeta.length).toBeGreaterThan(50);
    const khai = KHAI_COT_XUAT_DON_THU_DAY_DU.find((c) => c.key === `meta.${oMeta[0].field}`);
    expect(khai).toBeDefined();
    expect(khai!.doc(HO_SO)).toBe(`META-${oMeta[0].field}`);
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
        (c) => c.key === (t.cot ?? `meta.${t.field}`),
      );
      expect(khai?.tieuDe).toBe(t.caption);
    }
  });
});
