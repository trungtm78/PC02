import { banGocTuAnhEm, type KhoBang } from './ban-goc-anh-em';

const bang = (rows: unknown[]) => ({ findMany: jest.fn().mockResolvedValue(rows) });

describe('banGocTuAnhEm — lấy bản gốc từ thực thể anh em', () => {
  it('hồ sơ thiếu bản gốc thì lấy được từ vụ án cùng khoá nguồn', async () => {
    const kho = {
      petition: bang([{ legacySourceId: 'ho_so_doi_1:9' }]),
      case: bang([{ legacySourceId: 'ho_so_doi_1:9', legacyRaw: { tinh_trang: 'Đang xử lý' } }]),
      incident: bang([]),
    } as unknown as KhoBang;

    const map = await banGocTuAnhEm(kho, 'petition');
    expect(map.get('ho_so_doi_1:9')).toEqual({ tinh_trang: 'Đang xử lý' });
  });

  /** Không hồ sơ nào thiếu thì đừng quét hai bảng còn lại — đó là hai lần quét toàn bảng. */
  it('không ai thiếu thì không hỏi bảng anh em lần nào', async () => {
    const kho = {
      petition: bang([]),
      case: bang([]),
      incident: bang([]),
    } as unknown as KhoBang;

    const map = await banGocTuAnhEm(kho, 'petition');
    expect(map.size).toBe(0);
    expect((kho.case.findMany as jest.Mock)).not.toHaveBeenCalled();
    expect((kho.incident.findMany as jest.Mock)).not.toHaveBeenCalled();
  });

  it('không tự hỏi chính mình', async () => {
    const kho = {
      petition: bang([{ legacySourceId: 'k1' }]),
      case: bang([]),
      incident: bang([]),
    } as unknown as KhoBang;

    await banGocTuAnhEm(kho, 'petition');
    // Đúng một lời gọi: lời gọi tìm hồ sơ thiếu. Không có lời gọi thứ hai lên chính bảng ấy.
    expect((kho.petition.findMany as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('anh em cũng trống thì trả bảng rỗng, không ném lỗi', async () => {
    const kho = {
      petition: bang([{ legacySourceId: 'k1' }]),
      case: bang([{ legacySourceId: 'k1', legacyRaw: null }]),
      incident: bang([]),
    } as unknown as KhoBang;

    expect((await banGocTuAnhEm(kho, 'petition')).size).toBe(0);
  });
});
