import { describe, it, expect } from 'vitest';
import donThu from '../petitions/PetitionListPageShell.tsx?raw';
import vuAn from '../cases/CaseListPageShell.tsx?raw';
import vuViec from '../incidents/IncidentListPageShell.tsx?raw';
import donThuPhuong from '../petitions/WardPetitionsPage.tsx?raw';

/**
 * CỔNG "bảng dễ đọc" (anh yêu cầu 18/09/2026) cho Đơn thư, Vụ án, Vụ việc và Đơn thư phường:
 *   - Tóm tắt nội dung 5 dòng, "Xem thêm" bung tại chỗ → `SummaryCell`;
 *   - các cột xuống dòng → bảng chung bật `xuongDong`, KHÔNG còn ô cắt chữ `TABLE_CELL_TRUNCATE`;
 *   - thanh cuộn ngang ở trên bảng → `xuongDong` (bảng chung) hoặc `ThanhCuonNgangTren` (bảng tự dựng).
 * Màn mới thêm cột "cho gọn" bằng ô cắt chữ là cổng đỏ — đúng lỗi anh đã phải báo.
 */
const MAN_CHUNG = [
  ['Đơn thư', donThu],
  ['Vụ án', vuAn],
  ['Vụ việc', vuViec],
] as const;

/** Khối JSX `<ListPageShell.Table … >` (tới dấu `>` đóng thẻ mở) — nơi prop được truyền. */
function theBang(src: string): string {
  const dau = src.indexOf('<ListPageShell.Table');
  if (dau < 0) return '';
  const cuoi = src.indexOf('\n      />', dau);
  return src.slice(dau, cuoi < 0 ? undefined : cuoi);
}

function viPham(src: string): string[] {
  const loi: string[] = [];
  if (!/<SummaryCell\b/.test(src)) loi.push('thiếu SummaryCell');
  if (!/^\s*xuongDong\b/m.test(theBang(src))) loi.push('bảng chưa bật xuongDong');
  if (/\bTABLE_CELL_TRUNCATE\b/.test(src)) loi.push('còn ô cắt chữ TABLE_CELL_TRUNCATE');
  // Ngày MỘT dòng, mono, số thẳng hàng — mọi cột ngày đi qua DateCell (PR-F, 18/09/2026).
  // Cấm MỌI `formatVNDate(` ở màn danh sách (không chỉ `r.x`): `row.x`, `r?.x` cũng là tự vẽ ngày.
  if (/\bformatVNDate\(/.test(src)) loi.push('cột ngày tự vẽ, không qua DateCell');
  return loi;
}

describe('CỔNG bảng dễ đọc', () => {
  it.each(MAN_CHUNG)('%s: tóm tắt 5 dòng + xuống dòng + thanh cuộn trên', (_ten, src) => {
    expect(viPham(src)).toEqual([]);
  });

  it('Đơn thư phường (bảng tự dựng): SummaryCell + thanh cuộn trên, không kẹp tóm tắt 2 dòng', () => {
    expect(donThuPhuong).toMatch(/<SummaryCell\b/);
    expect(donThuPhuong).toMatch(/<ThanhCuonNgangTren\b/);
    expect(donThuPhuong).not.toMatch(/line-clamp-2/);
  });

  it('gieo lỗi: thêm lại một ô cắt chữ / bỏ xuongDong → cổng bắt được', () => {
    const catChu = donThu.replace(
      "key: 'nguonDon',",
      "key: 'nguonDon',\n        cellClassName: TABLE_CELL_TRUNCATE,",
    );
    expect(viPham(catChu)).toContain('còn ô cắt chữ TABLE_CELL_TRUNCATE');
    const tuVeNgay = donThu.replace(
      /<DateCell\s+value=\{r\.createdAt\}[\s\S]*?\/>/,
      '{formatVNDate(r.createdAt)}',
    );
    expect(viPham(tuVeNgay)).toContain('cột ngày tự vẽ, không qua DateCell');
    const boXuongDong = donThu.replace(/^\s*xuongDong\n/m, '\n');
    expect(viPham(boXuongDong)).toContain('bảng chưa bật xuongDong');
  });
});
