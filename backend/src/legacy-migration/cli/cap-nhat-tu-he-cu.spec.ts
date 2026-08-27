import { mocDaCoTrongHeMoi, kichThuocLo } from './cap-nhat-tu-he-cu';

/**
 * `mocDaCoTrongHeMoi` quyết định hồ sơ nào được coi là "đã có" và mốc thời gian của nó. Lấy
 * hụt một bảng là hồ sơ ở bảng ấy bị coi như chưa có và bị nạp đè; lấy mốc cũ hơn thực tế
 * cũng vậy.
 */
function khoGia(theoBang: Record<string, { legacySourceId: string | null; legacyRaw: unknown }[]>) {
  const kho: Record<string, unknown> = {};
  for (const [bang, rows] of Object.entries(theoBang)) {
    kho[bang] = { findMany: jest.fn(async () => rows) };
  }
  // Bảng không khai trả `undefined` — đúng như Prisma khi lược đồ chưa có model ấy.
  return kho as never;
}

describe('mocDaCoTrongHeMoi — gom mốc thời gian của hồ sơ đã di trú', () => {
  it('gom khoá từ MỌI bảng đích, không riêng ba bảng chính', async () => {
    const moc = await mocDaCoTrongHeMoi(
      khoGia({
        petition: [{ legacySourceId: 'ho_so_doi_1:1', legacyRaw: { _update_time: 100 } }],
        guidanceRecord: [{ legacySourceId: 'ho_so_doi_1:2', legacyRaw: { _update_time: 200 } }],
        exchange: [{ legacySourceId: 'ho_so_doi_1:3', legacyRaw: { _update_time: 300 } }],
        proposal: [{ legacySourceId: 'ho_so_doi_1:4', legacyRaw: { _update_time: 400 } }],
        lawyer: [{ legacySourceId: 'ho_so_doi_1:5', legacyRaw: { _update_time: 500 } }],
      }),
    );
    expect([...moc.keys()].sort()).toEqual([
      'ho_so_doi_1:1',
      'ho_so_doi_1:2',
      'ho_so_doi_1:3',
      'ho_so_doi_1:4',
      'ho_so_doi_1:5',
    ]);
  });

  /**
   * Một hồ sơ hệ cũ sinh ra nhiều thực thể là chuyện thường (vụ việc rồi khởi tố thành vụ án
   * — đo trên máy thật: 169 khoá dùng ở hai bảng). Giữ mốc CŨ hơn thì lần cập nhật sau coi
   * hồ sơ ấy là "đã sửa" và nạp đè, dù hệ cũ không đổi gì.
   */
  it('một khoá ở hai bảng thì giữ mốc MỚI NHẤT', async () => {
    const moc = await mocDaCoTrongHeMoi(
      khoGia({
        incident: [{ legacySourceId: 'ho_so_doi_1:9', legacyRaw: { _update_time: 100 } }],
        case: [{ legacySourceId: 'ho_so_doi_1:9', legacyRaw: { _update_time: 900 } }],
      }),
    );
    expect(moc.get('ho_so_doi_1:9')).toBe(900);
  });

  it('bản ghi không có mốc vẫn được ghi nhận là ĐÃ CÓ, mốc 0', async () => {
    const moc = await mocDaCoTrongHeMoi(
      khoGia({ petition: [{ legacySourceId: 'ho_so_doi_1:7', legacyRaw: {} }] }),
    );
    expect(moc.has('ho_so_doi_1:7')).toBe(true);
    expect(moc.get('ho_so_doi_1:7')).toBe(0);
  });

  it('bỏ qua bản ghi không có khoá di trú', async () => {
    const moc = await mocDaCoTrongHeMoi(
      khoGia({ petition: [{ legacySourceId: null, legacyRaw: { _update_time: 5 } }] }),
    );
    expect(moc.size).toBe(0);
  });

  /** Thiếu một bảng ở lược đồ thì bỏ qua bảng ấy, không làm hỏng cả lần chạy. */
  it('bảng chưa có trong lược đồ thì bỏ qua, không ném', async () => {
    const moc = await mocDaCoTrongHeMoi(
      khoGia({ petition: [{ legacySourceId: 'ho_so_doi_1:1', legacyRaw: { _update_time: 1 } }] }),
    );
    expect(moc.size).toBe(1);
  });

  /**
   * Nuốt một lỗi đọc THẬT là coi cả bảng ấy rỗng — và mọi hồ sơ chỉ nằm ở đó bị coi là chưa
   * có rồi nạp đè lên bản cán bộ đang dùng. Thà dừng cả lần cập nhật.
   */
  it('lỗi đọc thật thì NÉM, không coi là bảng rỗng', async () => {
    const kho = {
      petition: {
        findMany: async () => {
          throw new Error('mất kết nối cơ sở dữ liệu');
        },
      },
    } as never;
    await expect(mocDaCoTrongHeMoi(kho)).rejects.toThrow('mất kết nối');
  });
});

describe('kichThuocLo — chặn giá trị làm treo lần cập nhật', () => {
  it('không truyền thì dùng mặc định', () => {
    expect(kichThuocLo(undefined)).toBe(100);
  });

  it('số nguyên dương thì nhận', () => {
    expect(kichThuocLo('250')).toBe(250);
  });

  /** `--batch 0` làm vòng lặp đứng im mãi mãi, số âm thì chạy lùi — cả hai treo giữa chừng. */
  it.each(['0', '-1', '1.5', 'abc', ''])('từ chối %p', (v) => {
    expect(() => kichThuocLo(v)).toThrow('số nguyên dương');
  });
});
