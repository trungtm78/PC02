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

  /**
   * ĐỔI LUẬT 17/09/2026 (anh báo "search chưa đúng %like%"): trước dưới 3 ký tự chỉ khớp ĐẦU TỪ, nay
   * CHUỖI CON ở bất kỳ đâu như máy chủ. Ví dụ chọn sao cho hai luật cho kết quả KHÁC nhau — "an" thì
   * cả hai dòng đều có từ bắt đầu bằng "an", nên không chứng minh được gì.
   */
  it('1–2 ký tự: khớp chuỗi con ở bất kỳ đâu (như %like%)', () => {
    // "ng" giữa từ: "Đặng", "Khang" — luật đầu từ chỉ ra dòng 1 ("Nguyễn").
    expect(ids([{ khoa: 'nguoiGui', giaTri: ['ng'] }])).toEqual(['1', '3']);
    // "uy" chỉ nằm GIỮA từ "Nguyễn" — luật đầu từ ra rỗng.
    expect(ids([{ khoa: 'nguoiGui', giaTri: ['uy'] }])).toEqual(['1']);
  });

  /**
   * Bỏ dấu phải GIỐNG máy chủ, kể cả dấu câu: dữ liệu dán từ Word mang gạch ngang ngắn (U+2013),
   * cán bộ gõ gạch thường. Trước 17/09/2026 trình duyệt không quy đổi nên lọc ra rỗng trong khi màn
   * lọc ở máy chủ vẫn ra — cùng một chữ gõ, hai màn hai kết quả.
   */
  it('dấu câu quy đổi như máy chủ: gạch ngang ngắn ≡ gạch thường', () => {
    const khai: readonly TruongLoc<{ t: string }>[] = [
      { key: 'ten', nhan: 'Tên', kieu: 'chu', lay: (x) => x.t },
    ];
    const rows = [{ t: `Số 12${String.fromCharCode(0x2013)}2026` }];
    expect(locTheoThe(rows, [{ khoa: 'ten', giaTri: ['12-2026'] }], khai)).toEqual(rows);
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

  /**
   * ĐỔI LUẬT 17/09/2026: anh gõ thẻ "STT: 78" ra "Không tìm thấy" vì thẻ MÃ so ĐÚNG NGUYÊN mã. Nay
   * so CHỨA như máy chủ. Lý do cũ ("nhiều màn khai STT là số thứ tự 1..100, so chứa thì `stt~5` ra cả
   * dòng 15") là lỗi của chính các màn ấy — cột STT hiện số dòng thay cho mã thật — và được sửa ở màn,
   * không phải bằng cách làm thẻ mã không tìm được một phần.
   */
  it('mã: so CHỨA chuỗi gõ (không hoa thường), giống `*`', () => {
    const khai: readonly TruongLoc<{ id: string; stt: number; ma: string }>[] = [
      { key: 'stt', nhan: 'STT', kieu: 'ma', lay: (x) => x.stt },
      { key: 'ma', nhan: 'Mã', kieu: 'ma', lay: (x) => x.ma },
    ];
    const rows = [
      { id: 'a', stt: 5, ma: 'DT-2026-00012' },
      { id: 'b', stt: 15, ma: 'DT-2026-00125' },
      { id: 'c', stt: 50, ma: 'VA-2026-00012' },
    ];
    const loc = (the: Parameters<typeof locTheoThe>[1]) =>
      locTheoThe(rows, the, khai).map((r) => r.id);
    expect(loc([{ khoa: 'stt', giaTri: ['5'] }])).toEqual(['a', 'b', 'c']);
    expect(loc([{ khoa: 'ma', giaTri: ['dt-2026-00012'] }])).toEqual(['a']);
    expect(loc([{ khoa: 'ma', giaTri: ['00012'] }])).toEqual(['a', 'c']);
    expect(loc([{ khoa: '*', giaTri: ['00012'] }])).toEqual(['a', 'c']);
  });

  /**
   * Biến thể mã hồ sơ như máy chủ (`ho-so-code.util.ts`): hồ sơ lưu dạng NGẮN "26-11171" thì gõ dạng
   * ĐẦY ĐỦ "2026-11171" không phải chuỗi con của nó — phải thử cả dạng ngắn.
   */
  it('mã: gõ dạng đầy đủ vẫn ra hồ sơ lưu dạng ngắn, và ngược lại', () => {
    const khai: readonly TruongLoc<{ id: string; ma: string }>[] = [
      { key: 'stt', nhan: 'STT', kieu: 'ma', lay: (x) => x.ma },
    ];
    const rows = [
      { id: 'ngan', ma: '26-11171' },
      { id: 'day', ma: '2025-4478' },
    ];
    const loc = (v: string) =>
      locTheoThe(rows, [{ khoa: 'stt', giaTri: [v] }], khai).map((r) => r.id);
    expect(loc('2026-11171')).toEqual(['ngan']);
    expect(loc('25-4478')).toEqual(['day']);
    expect(loc('78')).toEqual(['day']);
  });

  /**
   * STT cũ theo ĐÚNG luật máy chủ (`stt-cu.util.ts`, chép hệ cũ `list.php:140-151`): gõ `2016-208` thì
   * lấy vế SAU dấu `-`; chuỗi thuần số bỏ số 0 đệm (`008` ≡ `8`); rồi so chứa. Trước 17/09/2026 trình
   * duyệt so ĐÚNG NGUYÊN — gõ `2016-208` không ra hồ sơ có STT cũ `208`, trong khi máy chủ vẫn ra.
   */
  it('STT cũ: lấy vế sau dấu -, bỏ số 0 đệm, so chứa — như máy chủ', () => {
    const khai: readonly TruongLoc<{ id: string; cu: string }>[] = [
      { key: 'sttCu', nhan: 'STT cũ', kieu: 'ma-cu', lay: (x) => x.cu },
    ];
    const rows = [
      { id: 'a', cu: '208' },
      { id: 'b', cu: '1208' },
      { id: 'c', cu: '8' },
    ];
    const loc = (v: string) =>
      locTheoThe(rows, [{ khoa: 'sttCu', giaTri: [v] }], khai).map((r) => r.id);
    expect(loc('2016-208')).toEqual(['a', 'b']);
    expect(loc('008')).toEqual(['a', 'b', 'c']);
  });

  it('mã thường (mã danh mục, IP): so CHỨA', () => {
    const khai: readonly TruongLoc<{ ma: string }>[] = [
      { key: 'ma', nhan: 'Mã', kieu: 'ma-thuong', lay: (x) => x.ma },
    ];
    const rows = [{ ma: 'T01' }, { ma: '192.168.1.10' }];
    expect(locTheoThe(rows, [{ khoa: 'ma', giaTri: ['t0'] }], khai)).toEqual([rows[0]]);
    expect(locTheoThe(rows, [{ khoa: 'ma', giaTri: ['192.168'] }], khai)).toEqual([rows[1]]);
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
