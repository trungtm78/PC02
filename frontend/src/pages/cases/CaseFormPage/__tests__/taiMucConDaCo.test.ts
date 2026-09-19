import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

import { taiMucConDaCo } from '../taiMucConDaCo';

/** Form sửa vụ án nạp mục con ĐÃ CÓ để hiện chỉ-xem — đọc đúng điểm cuối, đúng vụ án, nhãn tiếng Việt. */
describe('taiMucConDaCo', () => {
  beforeEach(() => get.mockReset());

  it('đọc đối tượng theo vụ án (kể cả nhân chứng) và vật chứng của vụ án', async () => {
    get.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/subjects'
          ? { data: { data: [{ id: 's1', fullName: 'Nguyễn Văn A', type: 'WITNESS', idNumber: '0123' }] } }
          : { data: { data: [{ id: 'e1', code: 'VC-1', name: 'Dao', quantity: 2, unit: 'cái' }] } },
      ),
    );
    const kq = await taiMucConDaCo('c1');
    expect(get).toHaveBeenCalledWith('/subjects', { params: { caseId: 'c1', limit: 100 } });
    expect(get).toHaveBeenCalledWith('/cases/c1/evidences');
    expect(kq.doiTuong).toEqual([{ id: 's1', chinh: 'Nguyễn Văn A', phu: 'Nhân chứng · CCCD 0123' }]);
    expect(kq.vatChung).toEqual([{ id: 'e1', chinh: 'VC-1 · Dao', phu: '2 cái' }]);
  });

  it('một nguồn lỗi thì nguồn kia vẫn hiện; nguồn lỗi trả null (không giả là "chưa có")', async () => {
    get.mockImplementation((url: string) =>
      url === '/subjects' ? Promise.reject(new Error('x')) : Promise.resolve({ data: { data: [] } }),
    );
    const kq = await taiMucConDaCo('c1');
    expect(kq.doiTuong).toBeNull();
    expect(kq.vatChung).toEqual([]);
  });
});
