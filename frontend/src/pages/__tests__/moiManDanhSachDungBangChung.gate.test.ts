import { describe, it, expect } from 'vitest';
import petitionsRaw from '../petitions/PetitionListPageShell.tsx?raw';
import incidentsRaw from '../incidents/IncidentListPageShell.tsx?raw';
import casesRaw from '../cases/CaseListPageShell.tsx?raw';
import comprehensiveRaw from '../cases/ComprehensiveListPageShell.tsx?raw';
import objectsRaw from '../objects/ObjectListPageShell.tsx?raw';
import lawyersRaw from '../lawyers/LawyerListPageShell.tsx?raw';
import deadlineRaw from '../admin/deadline-rules/DeadlineRulesListPage.tsx?raw';

/**
 * CỔNG: mọi màn DANH SÁCH đều dùng bảng chung và bật cá nhân hoá cột.
 *
 * Trước 28/08/2026, bảy màn danh sách dùng hai cách khác nhau: bốn màn dùng
 * `ListPageShell.Table`, ba màn tự viết thẻ `<table>`. Hệ quả là cán bộ kéo giãn được cột ở
 * màn này nhưng không ở màn kia — không có lý do nào giải thích được cho người dùng.
 *
 * Đọc mã nguồn bằng `?raw` (Vite) chứ không phải `node:fs`: tsconfig giao diện không khai
 * kiểu của Node, và `?raw` là cách kho này vẫn dùng cho cổng đọc-mã-nguồn.
 */
const MAN_DANH_SACH: Array<[string, string]> = [
  ['petitions/PetitionListPageShell.tsx', petitionsRaw],
  ['incidents/IncidentListPageShell.tsx', incidentsRaw],
  ['cases/CaseListPageShell.tsx', casesRaw],
  ['cases/ComprehensiveListPageShell.tsx', comprehensiveRaw],
  ['objects/ObjectListPageShell.tsx', objectsRaw],
  ['lawyers/LawyerListPageShell.tsx', lawyersRaw],
  ['admin/deadline-rules/DeadlineRulesListPage.tsx', deadlineRaw],
];

/**
 * Bỏ chú thích trước khi dò `<table`.
 *
 * Không bỏ thì chính câu chú thích "chuyển từ `<table>` tự dựng sang ListPageShell.Table"
 * làm cổng đỏ — cổng bắt được cái nó tự đọc chứ không phải mã thật. Bản đầu dính đúng thế.
 */
function maKhongChuThich(ma: string): string {
  return ma
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((d) => !d.trim().startsWith('//'))
    .join('\n');
}

describe('GATE — mọi màn danh sách dùng bảng chung', () => {
  it.each(MAN_DANH_SACH)('%s dùng ListPageShell.Table, không tự dựng <table>', (duong, ma) => {
    expect({ duong, dungBangChung: ma.includes('ListPageShell.Table') }).toEqual({
      duong,
      dungBangChung: true,
    });
    // `<table` tự viết là dấu hiệu quay lại lối cũ. Bảng con trong form không đi qua cổng này.
    expect({ duong, tuDungTable: maKhongChuThich(ma).includes('<table') }).toEqual({
      duong,
      tuDungTable: false,
    });
  });

  it.each(MAN_DANH_SACH)('%s bật kéo giãn cột', (duong, ma) => {
    expect({ duong, co: ma.includes('onKeoGian') }).toEqual({ duong, co: true });
  });

  /**
   * Thiếu `datTongBeRong` thì bảng đặt tổng bề rộng cho MỌI người, kể cả người chưa hề kéo —
   * đúng lỗi P0 Codex bắt được. Cổng này giữ cho màn mới không lặp lại.
   */
  it.each(MAN_DANH_SACH)('%s chỉ đặt tổng bề rộng khi người dùng đã kéo', (duong, ma) => {
    expect({ duong, co: ma.includes('datTongBeRong') }).toEqual({ duong, co: true });
  });

  it.each(MAN_DANH_SACH)('%s có nút chọn cột và cho đổi thứ tự', (duong, ma) => {
    expect({ duong, picker: ma.includes('<ColumnPicker'), doiCho: ma.includes('onDoiCho') }).toEqual(
      { duong, picker: true, doiCho: true },
    );
  });

  /** Mỗi màn một khoá bảng RIÊNG — trùng khoá là bố cục hai màn đè lên nhau. */
  it('mỗi màn dùng một khoá bảng riêng, không trùng', () => {
    const khoa = MAN_DANH_SACH.map(([d, ma]) => {
      const m = /useBoCucCot\(\s*'([^']+)'/.exec(ma);
      expect({ d, timThay: m !== null }).toEqual({ d, timThay: true });
      return m![1];
    });
    expect(new Set(khoa).size).toBe(khoa.length);
  });
});
