import { describe, it, expect } from 'vitest';
import nguonDonThu from '@/pages/petitions/PetitionFormPage/index.tsx?raw';
import nguonVuViec from '@/pages/incidents/IncidentFormPage.tsx?raw';
import nguonVuAn from '@/pages/cases/CaseFormPage/tabs.tsx?raw';
import { ownedColumnsFor } from '@/features/legacy-form/registry';

/**
 * CỔNG: ô viết tay trên trang form KHÔNG được ghi vào cột mà bố cục hệ cũ đã có ô.
 *
 * Hai ô cùng ghi một cột là mất dữ liệu trong đúng một lần lưu: cán bộ gõ ở tab, mở khối "Bổ
 * sung hệ mới" ra sửa việc khác, bấm Lưu — và ô trong khối (đang giữ giá trị cũ) đè lên thứ
 * vừa gõ. Không thông báo gì.
 *
 * Cổng này từng chỉ soi Vụ việc, nên 27/08/2026 nó KHÔNG thấy ô "Đơn vị giải quyết" thứ hai
 * của Đơn thư: khi ô trong tab được trỏ lại về cột `donViGiaiQuyet`, trang có ngay hai ô cùng
 * ghi cột ấy. Ca kiểm dựng cây React lên mới báo "Found multiple elements". Nay soi cả ba.
 *
 * Đọc mã nguồn dạng văn bản chứ không dựng cây: dựng lên thì chỉ thấy tab đang mở, mà ô trùng
 * hay nằm ở tab khác.
 */

interface Man {
  ten: string;
  thucThe: string;
  nguon: string;
  /**
   * Ô viết tay ĐƯỢC PHÉP trùng cột — chỉ khi nó là bản ghim luôn hiện (`pinnedTop`) cho ô máy
   * chủ bắt buộc. Gập ô bắt buộc đi thì cán bộ bấm Lưu, bị chặn bởi một ô không nhìn thấy.
   */
  duocPhepTrung: readonly string[];
}

const BANG: Man[] = [
  {
    ten: 'Đơn thư',
    thucThe: 'petition',
    nguon: nguonDonThu,
    duocPhepTrung: [],
  },
  {
    ten: 'Vụ việc',
    thucThe: 'incident',
    nguon: nguonVuViec,
    duocPhepTrung: [],
  },
  { ten: 'Vụ án', thucThe: 'case', nguon: nguonVuAn, duocPhepTrung: [] },
];

/**
 * Ô mà trang khai làm Ô RIÊNG thay tại chỗ (`renderOverride`).
 *
 * Đây KHÔNG phải ô thứ hai: bố cục hệ cũ giữ nguyên nhãn và chỗ đứng, chỉ thay ruột — vì ô
 * mặc định không làm nổi việc (chọn-nhiều theo danh mục động, ô điện thoại có kiểm dạng).
 * Gỡ chúng đi là hạ cấp năng lực, nên cổng phải nhận ra và bỏ qua.
 */
function oRieng(nguon: string): ReadonlySet<string> {
  return new Set(
    Array.from(nguon.matchAll(/^\s{2,}(\w+):\s*\(label(?::[^)]*)?\)\s*=>/gm)).map((m) => m[1]),
  );
}

/** Ô viết tay ngay trong tệp trang — ô của bố cục hệ cũ do `LegacyLayoutSection` sinh, không tính. */
function oVietTay(nguon: string): string[] {
  const rieng = oRieng(nguon);
  return Array.from(
    new Set([
      ...Array.from(nguon.matchAll(/(?:data-)?test[Ii]d="field-([\w.]+)"/g)).map((m) => m[1]),
      // Ô không gắn nhãn kiểm thử vẫn ghi vào cột — và trên Vụ án đó là 30 trong 31 ô trùng.
      // Soi luôn chỗ GHI thì cổng thấy hết, không phụ thuộc ai có nhớ đặt `data-testid` không.
      ...Array.from(nguon.matchAll(/update\("(\w+)"/g)).map((m) => m[1]),
    ]),
  ).filter((o) => !rieng.has(o));
}

describe.each(BANG.map((m) => [m.ten, m] as const))(
  'GATE %s — ô viết tay không dựng lại cột mà bố cục hệ cũ đã có',
  (_ten, man) => {
    it('đọc được cả hai danh sách, không rơi về rỗng', () => {
      expect(ownedColumnsFor(man.thucThe).size).toBeGreaterThan(40);
      expect(oVietTay(man.nguon).length).toBeGreaterThan(4);
    });

    it('không ô viết tay nào trùng cột với bố cục hệ cũ', () => {
      const coSan = ownedColumnsFor(man.thucThe);
      const trung = oVietTay(man.nguon).filter(
        (o) => coSan.has(o) && !man.duocPhepTrung.includes(o),
      );
      expect(trung).toEqual([]);
    });
  },
);

/**
 * Gỡ ô trùng KHÔNG được gỡ nhầm tính năng. Lần đầu chạy bộ gỡ tự động, nó nuốt luôn nút
 * "Khởi tố thành vụ án" vì nút ấy đứng trong cùng một khối với một ô trùng tên.
 */
describe('Gỡ ô trùng không được gỡ nhầm tính năng', () => {
  it('nút "Khởi tố thành vụ án" của Vụ việc vẫn còn', () => {
    expect(nguonVuViec).toContain('Khởi tố thành vụ án');
    expect(nguonVuViec).toContain('caseProvenance=FROM_INCIDENT');
  });
});
