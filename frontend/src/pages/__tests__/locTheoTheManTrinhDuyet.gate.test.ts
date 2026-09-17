import { describe, it, expect } from 'vitest';
import donThuPhuong from '../petitions/WardPetitionsPage.tsx?raw';
import vuViecPhuong from '../classification/WardIncidentsPage.tsx?raw';
import vuAnPhuong from '../classification/WardCasesPage.tsx?raw';
import phanLoaiKhac from '../classification/OtherClassificationPage.tsx?raw';
import donTrung from '../classification/DuplicatePetitionsPage.tsx?raw';
import kienNghi from '../classification/ProsecutorProposalPage.tsx?raw';
import traoDoi from '../workflow/CaseExchangePage.tsx?raw';
import uyThac from '../workflow/InvestigationDelegationPage.tsx?raw';
import huongDan from '../workflow/PetitionGuidancePage.tsx?raw';
import chuyenTra from '../workflow/TransferAndReturnPage.tsx?raw';
import hoSoMoi from '../cases/InitialCasesPage.tsx?raw';
import danhMuc from '../admin/MasterClassPage.tsx?raw';

/**
 * CỔNG: 12 màn tải hết dòng về rồi lọc tại chỗ đều tìm bằng ô thẻ (`useLocTheoThe`), cùng ngữ
 * nghĩa máy chủ (không dấu, chọn cột, thẻ trên URL).
 *
 * Trước M5, mỗi màn tự chép một đoạn `toLowerCase().includes` trên vài cột cố định — gõ "trom cap"
 * không ra "Trộm cắp", và đoạn chép lệch nhau theo thời gian. Cổng này chặn hai đường lùi:
 *   1. màn bỏ `useLocTheoThe` (dựng lại ô chữ riêng);
 *   2. ô chữ cũ `quickSearch` lọc cả khi cờ bật — so khớp phải nằm sau điều kiện cờ tắt.
 *
 * Đọc mã nguồn dạng văn bản (`?raw`) vì khai và hook nằm trong component.
 */
const MAN = [
  ['Đơn thư phường/xã', donThuPhuong],
  ['Vụ việc phường/xã', vuViecPhuong],
  ['Vụ án phường/xã', vuAnPhuong],
  ['Phân loại khác', phanLoaiKhac],
  ['Đơn trùng', donTrung],
  ['Kiến nghị VKS', kienNghi],
  ['Trao đổi chuyên án', traoDoi],
  ['Ủy thác điều tra', uyThac],
  ['Hướng dẫn đơn', huongDan],
  ['Chuyển đội / Trả hồ sơ', chuyenTra],
  ['Hồ sơ mới tiếp nhận', hoSoMoi],
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
 * liệu, tìm theo nó vô nghĩa. Bắt cả số dòng lồng trong mã bịa (`HD-${String(i + 1)…}` ở Hướng dẫn đơn).
 * Bản đầu PR1 đổi luật mà không gỡ khoá này ở 8 màn (rà mã thấy 5, cổng này thấy đủ 8).
 */
const STT_LA_SO_DONG = /\bstt:[^\n]*\bi\s*\+\s*1\b/;
const KHAI_STT = /key:\s*'stt'/;
const sttSoDongTimDuoc = (src: string) => STT_LA_SO_DONG.test(src) && KHAI_STT.test(src);

/** Prefix URL của thẻ — mỗi màn một tiền tố, trùng thì hai màn đọc thẻ của nhau. */
const prefixCua = (src: string) => /useLocTheoThe\(\{\s*prefix:\s*'([^']+)'/.exec(src)?.[1];

describe('GATE tìm kiếm — 12 màn lọc phía trình duyệt', () => {
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

  it('gieo lỗi: khai lại khoá stt ở màn gán STT bằng số dòng → cổng bắt được', () => {
    expect(STT_LA_SO_DONG.test(vuAnPhuong)).toBe(true); // màn mẫu đúng là gán số dòng
    expect(STT_LA_SO_DONG.test(huongDan)).toBe(true); // số dòng lồng trong mã bịa HD-00N
    const khaiLai = `${vuAnPhuong}\nconst X = [{ key: 'stt', nhan: 'STT', kieu: 'ma' }];`;
    expect(sttSoDongTimDuoc(khaiLai)).toBe(true);
  });

  it('mỗi màn một tiền tố thẻ, không trùng', () => {
    const prefix = MAN.map(([, src]) => prefixCua(src));
    expect(prefix.every(Boolean)).toBe(true);
    expect(new Set(prefix).size).toBe(prefix.length);
  });

  it('gieo lỗi: gỡ hook / gỡ điều kiện cờ / trùng tiền tố thì cổng bắt được', () => {
    const boHook = donThuPhuong.replace(/useLocTheoThe\(\{/g, 'useKhac({');
    expect(dungHook(boHook)).toBe(false);

    const boCo = vuViecPhuong.replace(/!theBat\s*&&\s*/g, '');
    expect(boCo).not.toBe(vuViecPhuong);
    expect(soChuCuKhongChanCo(boCo)).toBe(true);

    const trung = vuAnPhuong.replace(/prefix:\s*'wardCases'/, "prefix: 'wardIncidents'");
    expect(prefixCua(trung)).toBe(prefixCua(vuViecPhuong));
  });

  it('gieo lỗi: lọc từ allData dù vẫn gọi hook → cổng bắt được', () => {
    const boQuaHook = vuViecPhuong.replace(/timKiem\.dongLoc\.filter\(/g, 'allData.filter(');
    expect(dungHook(boQuaHook)).toBe(true);
    expect(locTuHook(boQuaHook)).toBe(false);
  });

  it('gieo lỗi: gỡ điều kiện cờ ở MỘT chỗ khi tệp còn điều kiện cờ chỗ khác → cổng bắt được', () => {
    // Chuyển đội: `theBat ||` đứng trước chỗ so chữ ô cũ. Gỡ nó đi, tệp vẫn còn `theBat` ở nơi khác.
    const hong = chuyenTra.replace(/theBat \|\|\s*\n(\s*)record\.recordCode/, '\n$1record.recordCode');
    expect(hong).not.toBe(chuyenTra);
    expect(/theBat/.test(hong)).toBe(true);
    expect(soChuCuKhongChanCo(hong)).toBe(true);
  });
});
