import { hoSoLoaiDonThu } from './bu-don-thu-lech-loai';

/** Chọn đúng hồ sơ hệ cũ xếp ở danh sách Đơn thư (`loai`) mà đang nằm ở Vụ án/Vụ việc. */
describe('hoSoLoaiDonThu', () => {
  it('chỉ lấy bản thô có loai là đơn thư (mọi cách viết hệ cũ dùng)', () => {
    const kq = hoSoLoaiDonThu([
      {
        legacySourceId: 'ho_so_doi_1:1',
        legacyRaw: { id: 1, loai: 'don_thu' },
      },
      {
        legacySourceId: 'ho_so_doi_1:2',
        legacyRaw: { id: 2, loai: ' Don-Thu ' },
      },
      {
        legacySourceId: 'ho_so_doi_1:3',
        legacyRaw: { id: 3, loai: 'vu_an_da_phan_loai' },
      },
      { legacySourceId: 'ho_so_doi_1:4', legacyRaw: null },
      { legacySourceId: null, legacyRaw: { id: 5, loai: 'don_thu' } },
      { legacySourceId: 'ho_so_doi_1:6', legacyRaw: { id: 6 } },
    ]);
    expect(kq.map((r) => r.id)).toEqual([1, 2]);
  });
});
