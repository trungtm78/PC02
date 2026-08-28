import { describe, it, expect } from 'vitest';
import {
  apDungBoCuc,
  ganViTri,
  boCucTuLocalStorage,
  khoaDaChuyen,
} from '../boCucCot';
import type { ColumnDef } from '../Table';

type Row = { id: string };
const cot = (key: string, o: Partial<ColumnDef<Row>> = {}): ColumnDef<Row> => ({
  key,
  header: key,
  render: () => key,
  ...o,
});

/**
 * Bố cục cột của người dùng chồng lên bộ cột khai trong mã. Ba luật bất di bất dịch, kế thừa
 * nguyên từ `useColumnVisibility.ts:82-89`:
 *
 *   • lọc TỪ danh sách cột trong mã, không dựng danh sách từ khoá lưu — khoá lưu có thể còn
 *     tên cột đã bị xoá khỏi mã sau một lần cập nhật
 *   • cột vắng mặt trong bố cục = lấy theo `optional` khai trong mã, KHÔNG phải "đã tắt"
 *   • cột mới thêm vào mã sau này phải nằm đúng chỗ khai, không nhảy xuống cuối
 */
describe('Áp bố cục người dùng lên bộ cột trong mã', () => {
  const COT = [
    cot('actions'),
    cot('stt', { optional: 'show' }),
    cot('tomTat', { optional: 'show', width: '20rem' }),
    cot('nguon', { optional: 'hide' }),
  ];

  it('không có bố cục thì y hệt mặc định trong mã', () => {
    const ra = apDungBoCuc(COT, {});
    expect(ra.map((c) => c.key)).toEqual(['actions', 'stt', 'tomTat']);
  });

  it('bề rộng người dùng đè lên bề rộng khai trong mã', () => {
    const ra = apDungBoCuc(COT, { tomTat: { width: 480 } });
    expect(ra.find((c) => c.key === 'tomTat')?.width).toBe('480px');
  });

  it('cột không có ghi đè giữ nguyên bề rộng khai trong mã', () => {
    const ra = apDungBoCuc(COT, { stt: { width: 200 } });
    expect(ra.find((c) => c.key === 'tomTat')?.width).toBe('20rem');
  });

  it('ẩn/hiện theo bố cục người dùng', () => {
    expect(apDungBoCuc(COT, { tomTat: { hidden: true } }).map((c) => c.key)).toEqual([
      'actions',
      'stt',
    ]);
    expect(apDungBoCuc(COT, { nguon: { hidden: false } }).map((c) => c.key)).toEqual([
      'actions',
      'stt',
      'tomTat',
      'nguon',
    ]);
  });

  /** Cột định danh (không khai `optional`) luôn hiện — người dùng không được tắt nhầm cột Thao tác. */
  it('cột không khai `optional` KHÔNG ẩn được, kể cả khi bố cục bảo ẩn', () => {
    expect(apDungBoCuc(COT, { actions: { hidden: true } }).map((c) => c.key)).toContain('actions');
  });

  describe('thứ tự', () => {
    /**
     * `position` áp CHỈ TRONG NHÓM cột đổi-chỗ-được. `actions` không khai `optional` nên là
     * cột định danh: nó giữ CHỖ KHAI trong mã và không bị đẩy đi.
     *
     * Cho `position` áp lên toàn bảng thì một lần kéo có thể đẩy cột Thao tác ra giữa bảng —
     * cột mà cán bộ bấm nhiều nhất, và là cột được cố ý đưa lên đầu ngày 25/08/2026.
     */
    it('vị trí áp trong nhóm đổi-chỗ-được, cột định danh giữ chỗ', () => {
      const ra = apDungBoCuc(COT, { tomTat: { position: 0 } });
      expect(ra.map((c) => c.key)).toEqual(['actions', 'tomTat', 'stt']);
    });

    it('cột định danh KHÔNG bị đẩy đi dù bố cục đặt vị trí cho nó', () => {
      const ra = apDungBoCuc(COT, { actions: { position: 9 }, tomTat: { position: 0 } });
      expect(ra[0].key).toBe('actions');
    });

    /**
     * Cột ghim neo cứng ở mép trái, nên nó phải đứng đầu. Cho nó rời chỗ là hỏng cả cơ chế
     * ghim khi cuộn ngang (`Table.tsx` — `sticky left-10`).
     */
    it('cột ghim KHÔNG bị đẩy khỏi vị trí đầu', () => {
      // Cột ghim phải khai LUÔN CẢ `optional`, nếu không phép kiểm chỉ chạm luật "cột định
      // danh" và bảo vệ cột ghim thành cổng vô dụng — gỡ `!c.sticky` ra vẫn xanh. Đã kiểm
      // ngược 28/08/2026.
      const cotGhim = [
        cot('actions', { sticky: true, optional: 'show' }),
        cot('a', { optional: 'show' }),
      ];
      const ra = apDungBoCuc(cotGhim, { a: { position: 0 }, actions: { position: 1 } });
      expect(ra[0].key).toBe('actions');
    });

    /** Đây là cách làm sai kinh điển: cột mới thêm vào mã nhảy xuống cuối bảng. */
    /**
     * Cột mới thêm vào mã KHÔNG có ghi đè, nên nó lấp vào khe trống theo thứ tự khai — không
     * nhảy xuống cuối bảng. Đây là cách làm sai kinh điển của tính năng này: lưu một mảng
     * "thứ tự người dùng bấm" thì cột mới luôn rơi xuống cuối và không ai hiểu vì sao.
     *
     * Khai `moi` ở GIỮA để phép kiểm có nghĩa — khai cuối thì nó ở cuối dù luật đúng hay sai.
     */
    it('cột MỚI thêm vào mã lấp đúng khe, không nhảy xuống cuối', () => {
      const cotMoi = [
        cot('actions'),
        cot('stt', { optional: 'show' }),
        cot('moi', { optional: 'show' }),
        cot('tomTat', { optional: 'show' }),
      ];
      const ra = apDungBoCuc(cotMoi, { tomTat: { position: 0 } });
      expect(ra.map((c) => c.key)).toEqual(['actions', 'tomTat', 'stt', 'moi']);
    });

    /** Hai cột cùng một vị trí (bố cục cũ, hoặc sửa tay) — không được làm mất cột nào. */
    it('vị trí trùng nhau thì đẩy xuống khe kế tiếp, không mất cột', () => {
      const ra = apDungBoCuc(COT, { stt: { position: 0 }, tomTat: { position: 0 } });
      expect(ra.map((c) => c.key)).toHaveLength(3);
      expect(ra.map((c) => c.key)).toContain('stt');
      expect(ra.map((c) => c.key)).toContain('tomTat');
    });

    it('tên cột đã bị xoá khỏi mã thì bỏ qua, cột còn lại vẫn đúng', () => {
      const ra = apDungBoCuc(COT, { cotDaXoa: { position: 0, width: 100 } });
      expect(ra.map((c) => c.key)).toEqual(['actions', 'stt', 'tomTat']);
    });
  });
});

/**
 * Kéo thả sinh ra vị trí mới cho NHIỀU cột cùng lúc. Tính ở một chỗ để giao diện chỉ việc gửi
 * kết quả lên máy chủ, và để kiểm được mà không cần dựng chuột giả.
 */
describe('Gán vị trí sau khi kéo thả', () => {
  it('dời một cột lên trước', () => {
    expect(ganViTri(['a', 'b', 'c', 'd'], 'c', 1)).toEqual({
      a: { position: 0 },
      c: { position: 1 },
      b: { position: 2 },
      d: { position: 3 },
    });
  });

  it('dời một cột xuống sau', () => {
    const ra = ganViTri(['a', 'b', 'c'], 'a', 2);
    expect(Object.entries(ra).sort((x, y) => x[1].position - y[1].position).map(([k]) => k)).toEqual(
      ['b', 'c', 'a'],
    );
  });

  it('dời tới chính chỗ cũ thì thứ tự không đổi', () => {
    const ra = ganViTri(['a', 'b', 'c'], 'b', 1);
    expect(ra['b'].position).toBe(1);
  });

  it('vị trí ngoài biên bị kẹp, không sinh vị trí âm', () => {
    expect(ganViTri(['a', 'b'], 'b', -5)['b'].position).toBe(0);
    expect(ganViTri(['a', 'b'], 'a', 99)['a'].position).toBe(1);
  });
});

/**
 * Lựa chọn ẩn/hiện của cán bộ hôm nay nằm ở `localStorage` khoá `<trang>_columns`. Không đọc
 * lên thì lần đầu mở bản mới, mọi cột họ đã tắt hiện lại hết — và họ phải tắt lại từ đầu trên
 * từng máy. Đây là bước bắt buộc, không phải tuỳ chọn.
 */
describe('Đọc lựa chọn cũ trong trình duyệt để chuyển lên máy chủ', () => {
  it('đổi bản ghi đè boolean cũ sang dạng bố cục mới', () => {
    localStorage.setItem('petitions_columns', JSON.stringify({ tomTat: false, nguon: true }));
    expect(boCucTuLocalStorage('petitions')).toEqual({
      tomTat: { hidden: true },
      nguon: { hidden: false },
    });
  });

  it('không có khoá cũ thì trả null — phân biệt với "có nhưng rỗng"', () => {
    localStorage.removeItem('cases_columns');
    expect(boCucTuLocalStorage('cases')).toBeNull();
  });

  it('khoá hỏng định dạng thì trả null, không ném lỗi', () => {
    localStorage.setItem('cases_columns', '{khong-phai-json');
    expect(boCucTuLocalStorage('cases')).toBeNull();
  });

  it('bỏ giá trị không phải boolean', () => {
    localStorage.setItem('cases_columns', JSON.stringify({ a: 'x', b: true }));
    expect(boCucTuLocalStorage('cases')).toEqual({ b: { hidden: false } });
  });

  /**
   * `localStorage` NÉM LỖI ở chế độ riêng tư và khi trình duyệt chặn dữ liệu trang — không
   * bọc thì cả trang danh sách trắng xoá vì một bước chuyển dữ liệu chạy một lần.
   */
  it('localStorage ném lỗi thì trả null, không vỡ trang', () => {
    const cu = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new DOMException('SecurityError');
    };
    expect(boCucTuLocalStorage('cases')).toBeNull();
    Storage.prototype.getItem = cu;
  });

  it('có cờ đã chuyển thì KHÔNG đọc lại — chuyển một lần, không đè bố cục mới', () => {
    localStorage.setItem('petitions_columns', JSON.stringify({ tomTat: false }));
    localStorage.setItem(khoaDaChuyen('petitions'), '1');
    expect(boCucTuLocalStorage('petitions')).toBeNull();
    localStorage.removeItem(khoaDaChuyen('petitions'));
  });
});

/**
 * CỔNG (Codex vòng 2, 28/08/2026): ca "cột mới không nhảy xuống cuối" trước đây kiểm ở trạng
 * thái KHÔNG THỰC TẾ — chỉ một cột có `position`.
 *
 * Thực tế: `ganViTri` gán `position` cho MỌI cột ngay lần đổi chỗ đầu tiên. Nên cột lập trình
 * viên thêm vào mã sau đó luôn là cột DUY NHẤT không có `position`. Nếu luật là "cột không có
 * vị trí dồn xuống cuối" thì mọi cột mới đều rơi ra rìa phải — chỗ phải cuộn ngang mới thấy —
 * với tất cả cán bộ đã từng đổi chỗ một lần.
 */
describe('Cột mới thêm vào mã, SAU khi người dùng đã đổi chỗ', () => {
  const cot = (key: string, o: Partial<ColumnDef<Row>> = {}): ColumnDef<Row> => ({
    key,
    header: key,
    render: () => key,
    optional: 'show',
    ...o,
  });

  /** Trạng thái thật sau một lần kéo thả: mọi cột đổi-chỗ-được đều mang `position`. */
  const SAU_KHI_DOI_CHO = { c: { position: 0 }, a: { position: 1 }, b: { position: 2 } };

  it('cột mới khai GIỮA hai cột nằm đúng khu vực ấy, không rơi xuống cuối', () => {
    const cotMoi = [cot('a'), cot('moi'), cot('b'), cot('c')];
    const ra = apDungBoCuc(cotMoi, SAU_KHI_DOI_CHO).map((x) => x.key);
    // Thứ tự người dùng đặt: c, a, b. `moi` khai ngay sau `a` trong mã → nằm ngay sau `a`.
    expect(ra).toEqual(['c', 'a', 'moi', 'b']);
  });

  it('cột mới khai ĐẦU danh sách vẫn ra trước, không rơi xuống cuối', () => {
    const cotMoi = [cot('moi'), cot('a'), cot('b'), cot('c')];
    const ra = apDungBoCuc(cotMoi, SAU_KHI_DOI_CHO).map((x) => x.key);
    expect(ra.indexOf('moi')).toBeLessThan(ra.indexOf('b'));
  });

  it('không cột nào bị mất khi thêm cột mới', () => {
    const cotMoi = [cot('a'), cot('moi'), cot('b'), cot('c')];
    expect(apDungBoCuc(cotMoi, SAU_KHI_DOI_CHO)).toHaveLength(4);
  });

  /** Thêm cột mới KHÔNG được làm xáo thứ tự người dùng đã đặt cho các cột cũ. */
  it('thứ tự người dùng đặt cho cột cũ giữ nguyên', () => {
    const cotMoi = [cot('a'), cot('moi'), cot('b'), cot('c')];
    const ra = apDungBoCuc(cotMoi, SAU_KHI_DOI_CHO).map((x) => x.key);
    const chiCotCu = ra.filter((k) => k !== 'moi');
    expect(chiCotCu).toEqual(['c', 'a', 'b']);
  });
});
