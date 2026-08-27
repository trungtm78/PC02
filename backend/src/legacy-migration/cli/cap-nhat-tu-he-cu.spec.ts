import { mocDaCoTrongHeMoi } from './cap-nhat-tu-he-cu';

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
  // Bảng không khai thì ném — đúng như Prisma khi gọi model không tồn tại.
  return new Proxy(kho, {
    get: (t, k: string) =>
      k in t
        ? (t as Record<string, unknown>)[k]
        : {
            findMany: async () => {
              throw new Error('không có model ' + k);
            },
          },
  }) as never;
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
});
