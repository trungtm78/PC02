import { describe, it, expect } from 'vitest';
import { locTheoThe, type TruongLoc } from '../loc-theo-the';

interface Dong {
  id: string;
  ma: string;
  ten: string;
  noiDung: string | null;
  trangThai: string;
  ngay: string;
  canBo: string[];
}

const DONG: Dong[] = [
  {
    id: '1',
    ma: 'DT-2026-00012',
    ten: 'Nguyễn Văn An',
    noiDung: 'Tranh chấp  đất đai',
    trangThai: 'TIEP_NHAN',
    ngay: '2026-09-12T03:00:00.000Z',
    canBo: ['Trần Bình'],
  },
  {
    id: '2',
    ma: 'DT-2026-00345',
    ten: 'Lê Thị Hoa',
    noiDung: 'Trộm cắp tài sản',
    trangThai: 'DA_GIAI_QUYET',
    ngay: '2026-08-01T10:00:00.000Z',
    canBo: ['Phạm Anh', 'Đỗ Cường'],
  },
  {
    id: '3',
    ma: 'DT-2025-00001',
    ten: 'Đặng An Khang',
    noiDung: null,
    trangThai: 'TIEP_NHAN',
    ngay: '2025-12-31T18:30:00.000Z',
    canBo: [],
  },
];

const KHAI: readonly TruongLoc<Dong>[] = [
  { key: 'stt', nhan: 'STT', kieu: 'ma', lay: (d) => d.ma },
  { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu', lay: (d) => d.ten },
  { key: 'tomTat', nhan: 'Tóm tắt', kieu: 'chu', lay: (d) => d.noiDung },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon', lay: (d) => d.trangThai },
  { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay', lay: (d) => d.ngay },
  { key: 'canBo', nhan: 'Cán bộ', kieu: 'chu', lay: (d) => d.canBo },
];

const ids = (the: Parameters<typeof locTheoThe>[1]) =>
  locTheoThe(DONG, the, KHAI).map((d) => d.id);

describe('locTheoThe — lọc phía trình duyệt cùng ngữ nghĩa máy chủ', () => {
  it('không thẻ → giữ nguyên mảng (cùng tham chiếu)', () => {
    expect(locTheoThe(DONG, [], KHAI)).toBe(DONG);
  });

  it('chữ: không dấu, không hoa thường, gộp khoảng trắng thừa/NBSP', () => {
    expect(ids([{ khoa: 'nguoiGui', giaTri: ['nguyen van'] }])).toEqual(['1']);
    expect(ids([{ khoa: 'tomTat', giaTri: ['TRANH CHAP DAT'] }])).toEqual(['1']);
    expect(ids([{ khoa: 'tomTat', giaTri: ['trộm cắp'] }])).toEqual(['2']);
  });

  it('`đ` bỏ dấu thành `d`', () => {
    expect(ids([{ khoa: 'nguoiGui', giaTri: ['dang'] }])).toEqual(['3']);
  });

  /** Máy chủ: dưới 3 ký tự chỉ khớp ĐẦU TỪ (tránh "an" khớp "Khang", "Thanh"…). */
  it('1–2 ký tự: chỉ khớp đầu từ', () => {
    expect(ids([{ khoa: 'nguoiGui', giaTri: ['an'] }])).toEqual(['1', '3']);
    expect(ids([{ khoa: 'nguoiGui', giaTri: ['ng'] }])).toEqual(['1']);
  });

  it('cùng khoá → OR; khác khoá → AND', () => {
    expect(ids([{ khoa: 'nguoiGui', giaTri: ['hoa', 'khang'] }])).toEqual(['2', '3']);
    expect(
      ids([
        { khoa: 'nguoiGui', giaTri: ['hoa', 'khang'] },
        { khoa: 'trangThai', giaTri: ['TIEP_NHAN'] },
      ]),
    ).toEqual(['3']);
  });

  it('`*` tìm mọi cột chữ và mã, không tìm cột chọn/ngày', () => {
    expect(ids([{ khoa: '*', giaTri: ['00345'] }])).toEqual(['2']);
    expect(ids([{ khoa: '*', giaTri: ['dat dai'] }])).toEqual(['1']);
    expect(ids([{ khoa: '*', giaTri: ['TIEP_NHAN'] }])).toEqual([]);
  });

  it('cột nhiều giá trị (danh sách cán bộ): khớp bất kỳ phần tử nào', () => {
    expect(ids([{ khoa: 'canBo', giaTri: ['cuong'] }])).toEqual(['2']);
  });

  it('chọn: so đúng mã, không so chứa', () => {
    expect(ids([{ khoa: 'trangThai', giaTri: ['TIEP'] }])).toEqual([]);
    expect(ids([{ khoa: 'trangThai', giaTri: ['DA_GIAI_QUYET'] }])).toEqual(['2']);
  });

  /** Ngày theo giờ Việt Nam (+07:00): 2025-12-31T18:30Z là 01/01/2026 lúc 01:30 tại VN. */
  it('ngày: dd/mm/yyyy · mm/yyyy · yyyy theo múi giờ Việt Nam', () => {
    expect(ids([{ khoa: 'ngayTao', giaTri: ['12/09/2026'] }])).toEqual(['1']);
    expect(ids([{ khoa: 'ngayTao', giaTri: ['08/2026'] }])).toEqual(['2']);
    expect(ids([{ khoa: 'ngayTao', giaTri: ['2026'] }])).toEqual(['1', '2', '3']);
    expect(ids([{ khoa: 'ngayTao', giaTri: ['01/01/2026'] }])).toEqual(['3']);
    expect(ids([{ khoa: 'ngayTao', giaTri: ['2026-09-12'] }])).toEqual(['1']);
  });

  /** Nhiều màn lưu sẵn chuỗi đã định dạng `formatVNDate` (dd/mm/yyyy) — `Date.parse` không đọc được. */
  it('ô ngày đã định dạng dd/mm/yyyy vẫn lọc đúng', () => {
    const khai: readonly TruongLoc<{ d: string }>[] = [
      { key: 'ngay', nhan: 'Ngày', kieu: 'ngay', lay: (x) => x.d },
    ];
    const rows = [{ d: '05/09/2026' }, { d: '15/08/2026' }];
    expect(locTheoThe(rows, [{ khoa: 'ngay', giaTri: ['09/2026'] }], khai)).toEqual([rows[0]]);
    expect(locTheoThe(rows, [{ khoa: 'ngay', giaTri: ['15/08/2026'] }], khai)).toEqual([rows[1]]);
  });

  it('ngày sai dạng → không khớp dòng nào (không coi như bỏ lọc)', () => {
    expect(ids([{ khoa: 'ngayTao', giaTri: ['hôm qua'] }])).toEqual([]);
  });

  /** Khoá lạ hiện thẻ ĐỎ trên ô tìm; lọc bỏ qua nó chứ không làm rỗng cả bảng. */
  it('khoá không có trong khai → bỏ qua', () => {
    expect(ids([{ khoa: 'cotCu', giaTri: ['x'] }])).toEqual(['1', '2', '3']);
  });

  it('giá trị rỗng/null ở dòng không khớp chữ nào', () => {
    expect(ids([{ khoa: 'tomTat', giaTri: ['a'] }])).not.toContain('3');
  });
});
