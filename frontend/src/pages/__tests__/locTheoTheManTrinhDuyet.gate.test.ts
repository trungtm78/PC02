import { describe, it, expect } from 'vitest';
import danhMuc from '../admin/MasterClassPage.tsx?raw';

/**
 * CỔNG: 1 màn tải hết dòng về rồi lọc tại chỗ đều tìm bằng ô thẻ (`useLocTheoThe`), cùng ngữ
 * nghĩa máy chủ (không dấu, chọn cột, thẻ trên URL). Hướng dẫn đơn, Kiến nghị VKS, Ủy thác, Trao đổi, Đơn thư phường, Vụ án phường, Vụ việc phường, Hồ sơ mới tiếp nhận, Đơn trùng, Chuyển đội/Trả hồ sơ chuyển xuống máy chủ, Phân loại khác GỠ HẲN (hệ cũ 0 hồ sơ) — 17–18/09/2026
 * — chuyển xuống máy chủ (`*.timKiemThe.test.tsx` của từng màn).
 *
 * Trước M5, mỗi màn tự chép một đoạn `toLowerCase().includes` trên vài cột cố định — gõ "trom cap"
 * không ra "Trộm cắp", và đoạn chép lệch nhau theo thời gian. Cổng này chặn hai đường lùi:
 *   1. màn bỏ `useLocTheoThe` (dựng lại ô chữ riêng);
 *   2. ô chữ cũ `quickSearch` lọc cả khi cờ bật — so khớp phải nằm sau điều kiện cờ tắt.
 *
 * Đọc mã nguồn dạng văn bản (`?raw`) vì khai và hook nằm trong component.
 */
const MAN = [
  ['Phân loại danh mục', danhMuc],
] as const;

const dungHook = (src: string) => /useLocTheoThe\(\{/.test(src);

/**
 * Bảng lọc tiếp TỪ dòng hook trả về. Gọi hook và vẽ ô thẻ mà vẫn `allData.filter(...)` thì thẻ hiện
 * trên ô nhưng không lọc gì — hai điều kiện trên đều qua.
 */
const locTuHook = (src: string) => /timKiem\.dongLoc\.filter\(/.test(src);

/** Ô tìm dạng thẻ có mặt trong JSX và dựa trên khai của màn. */
const coOThe = (src: string) => /<OTimKiemThe\b/.test(src);

/**
 * Mỗi chỗ so chữ của Ô CHỮ CŨ (`quickSearch`, `searchLower`, `q`, `search`) phải có điều kiện cờ
 * trong vài dòng ngay trước: `!theBat &&`, `if (theBat) return true`, `theBat ||` — ba dạng các màn
 * đang dùng. Xét TỪNG chỗ: một điều kiện cờ ở chỗ khác trong tệp không che được chỗ này. So chữ của
 * mặt lọc nâng cao (vd `advancedFilters.currentTeam`) không thuộc ô chữ cũ, không xét.
 */
const O_CHU_CU = /toLowerCase\(\)\.includes\((quickSearch|searchLower|q\)|search\.toLowerCase)/;
const DIEU_KIEN_CO = /!theBat\s*&&|if \(theBat\) return true|theBat\s*\|\|/;
const SO_DONG_NHIN_LEN = 8;

const soChuCuKhongChanCo = (src: string) => {
  const dong = src.split('\n');
  return dong.some(
    (l, i) =>
      O_CHU_CU.test(l) &&
      !DIEU_KIEN_CO.test(dong.slice(Math.max(0, i - SO_DONG_NHIN_LEN), i + 1).join('\n')),
  );
};

/**
 * Cột "STT" gán bằng số thứ tự DÒNG (`stt: i + 1`) thì KHÔNG được khai là khoá tìm được. Từ 17/09/2026
 * thẻ mã so CHỨA (như %like%), nên khoá ấy gõ "5" ra dòng 5, 15, 25, 50–59… — số dòng không phải dữ
 * liệu, tìm theo nó vô nghĩa. Bắt cả số dòng lồng trong biểu thức (mã bịa `HD-${String(i + 1)…}` từng có).
 * Bản đầu PR1 đổi luật mà không gỡ khoá này ở 8 màn (rà mã thấy 5, cổng này thấy đủ 8).
 */
const STT_LA_SO_DONG = /\bstt:[^\n]*\bi\s*\+\s*1\b/;
const KHAI_STT = /key:\s*'stt'/;
const sttSoDongTimDuoc = (src: string) => STT_LA_SO_DONG.test(src) && KHAI_STT.test(src);

/** Prefix URL của thẻ — mỗi màn một tiền tố, trùng thì hai màn đọc thẻ của nhau. */
const prefixCua = (src: string) => /useLocTheoThe\(\{\s*prefix:\s*'([^']+)'/.exec(src)?.[1];

describe('GATE tìm kiếm — 1 màn lọc phía trình duyệt', () => {
  it.each(MAN)('%s: dùng useLocTheoThe + OTimKiemThe, bảng lọc từ dòng của hook', (_ten, src) => {
    expect(dungHook(src)).toBe(true);
    expect(coOThe(src)).toBe(true);
    expect(locTuHook(src)).toBe(true);
  });

  it.each(MAN)('%s: có ít nhất một chỗ so chữ ô cũ (cổng không rỗng)', (_ten, src) => {
    expect(src.split('\n').some((l) => O_CHU_CU.test(l))).toBe(true);
  });

  it.each(MAN)('%s: ô chữ cũ chỉ lọc khi cờ TIM_KIEM_THE tắt', (_ten, src) => {
    expect(soChuCuKhongChanCo(src)).toBe(false);
  });

  it.each(MAN)('%s: cột STT là số thứ tự dòng thì KHÔNG là khoá tìm được', (_ten, src) => {
    expect(sttSoDongTimDuoc(src)).toBe(false);
  });

  /**
   * Từ 18/09/2026 mọi màn còn ở cổng đều KHÔNG gán STT bằng số dòng nữa, nên nguồn gieo lỗi là một đoạn
   * mã dựng tay — cổng vẫn phải bắt được kiểu sai ấy nếu nó quay lại.
   */
  it('gieo lỗi: khai lại khoá stt ở màn gán STT bằng số dòng → cổng bắt được', () => {
    const manSai = [
      "const KHAI = [{ key: 'stt', nhan: 'STT', kieu: 'ma' }];",
      'const dong = ds.map((d, i) => ({ stt: i + 1, ten: d.ten }));',
    ].join('\n');
    expect(STT_LA_SO_DONG.test(manSai)).toBe(true);
    expect(sttSoDongTimDuoc(manSai)).toBe(true);
    // Màn thật đang ở cổng thì không dính.
    for (const [, src] of MAN) expect(sttSoDongTimDuoc(src)).toBe(false);
  });

  it('mỗi màn một tiền tố thẻ, không trùng', () => {
    const prefix = MAN.map(([, src]) => prefixCua(src));
    expect(prefix.every(Boolean)).toBe(true);
    expect(new Set(prefix).size).toBe(prefix.length);
  });

  it('gieo lỗi: gỡ hook / gỡ điều kiện cờ / trùng tiền tố thì cổng bắt được', () => {
    const boHook = danhMuc.replace(/useLocTheoThe\(\{/g, 'useKhac({');
    expect(dungHook(boHook)).toBe(false);

    const boCo = danhMuc.replace(/theBat \|\|\s*/g, '');
    expect(boCo).not.toBe(danhMuc);
    expect(soChuCuKhongChanCo(boCo)).toBe(true);

    // Hai màn cùng tiền tố thì đọc thẻ của nhau — dựng một bản sao trùng tiền tố để cổng phải thấy.
    const trung = danhMuc.replace(/prefix:\s*'masterClass'/, "prefix: 'trungTienTo'");
    expect(prefixCua(trung)).toBe('trungTienTo');
    expect(prefixCua(danhMuc)).toBe('masterClass');
  });

  it('gieo lỗi: lọc từ allData dù vẫn gọi hook → cổng bắt được', () => {
    const boQuaHook = danhMuc.replace(/timKiem\.dongLoc\.filter\(/g, 'allData.filter(');
    expect(dungHook(boQuaHook)).toBe(true);
    expect(locTuHook(boQuaHook)).toBe(false);
  });

  it('gieo lỗi: gỡ điều kiện cờ ở MỘT chỗ khi tệp còn điều kiện cờ chỗ khác → cổng bắt được', () => {
    // Điều kiện cờ đứng ngay trước chỗ so chữ ô cũ. Gỡ MỘT chỗ ấy thôi, tệp vẫn còn `theBat` ở nơi khác
    // (ô thẻ vẫn vẽ theo cờ) — cổng phải xét TỪNG chỗ so chữ chứ không xét cả tệp.
    const hong = [
      'const theBat = useFeatureBatMacDinh("TIM_KIEM_THE");',
      'const loc = ds.filter((d) => d.ten.toLowerCase().includes(quickSearch));',
      'return theBat ? <OTimKiemThe /> : <input />;',
    ].join('\n');
    expect(/theBat/.test(hong)).toBe(true);
    expect(soChuCuKhongChanCo(hong)).toBe(true);
    // Màn thật vẫn chặn đúng.
    for (const [, src] of MAN) expect(soChuCuKhongChanCo(src)).toBe(false);
  });
});
