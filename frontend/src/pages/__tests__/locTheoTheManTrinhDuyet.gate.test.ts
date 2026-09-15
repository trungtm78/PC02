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

/** Ô tìm dạng thẻ có mặt trong JSX và dựa trên khai của màn. */
const coOThe = (src: string) => /<OTimKiemThe\b/.test(src);

/**
 * Có đoạn so chữ cũ mà KHÔNG có điều kiện cờ đứng trước: `!theBat &&`, `if (theBat) return true`,
 * `theBat ||` — ba dạng các màn đang dùng để bỏ qua ô chữ cũ khi cờ bật.
 */
const soChuCuKhongChanCo = (src: string) =>
  /toLowerCase\(\)\.includes/.test(src) && !/(!theBat\s*&&|if \(theBat\) return true|theBat\s*\|\|)/.test(src);

/** Prefix URL của thẻ — mỗi màn một tiền tố, trùng thì hai màn đọc thẻ của nhau. */
const prefixCua = (src: string) => /useLocTheoThe\(\{\s*prefix:\s*'([^']+)'/.exec(src)?.[1];

describe('GATE tìm kiếm — 12 màn lọc phía trình duyệt', () => {
  it.each(MAN)('%s: dùng useLocTheoThe + OTimKiemThe', (_ten, src) => {
    expect(dungHook(src)).toBe(true);
    expect(coOThe(src)).toBe(true);
  });

  it.each(MAN)('%s: ô chữ cũ chỉ lọc khi cờ TIM_KIEM_THE tắt', (_ten, src) => {
    expect(soChuCuKhongChanCo(src)).toBe(false);
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
});
