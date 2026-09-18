import { decomposeLegacyRecord, type LegacyRecord } from './legacy-mapper';

/**
 * Bấm thử bộ lọc 18/09/2026: lọc Vụ việc theo "Cán bộ nhập" luôn ra 0 dòng, cột "Người nhập" trắng.
 * Đo prod (chỉ đọc): 4.725 vụ việc, `canBoNhapId` có ở 6 bản (đều tạo mới), `createdById` có ở 4.607.
 * Cột, bộ lọc và thẻ tìm "Người nhập" của Vụ việc đều đọc `canBoNhap` — mà bộ nạp hệ cũ không ghi ô ấy.
 *
 * Hệ cũ chỉ có MỘT người: `nguoi_them` — bộ nạp tra ra rồi gắn cho cả người nhập, người tạo, điều tra
 * viên (`attachOwnership`). Vụ việc phải nhận người ấy vào ô "Cán bộ nhập", như Đơn thư nhận vào
 * `enteredById` và Vụ án đọc `createdBy`.
 */
const vuViec = (ghiDe: Partial<LegacyRecord>): LegacyRecord => ({
  id: 87541,
  __sourceCollection: 'ho_so_doi_1',
  nam: 2026,
  stt: 11732,
  loai: 'vu_viec',
  phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau',
  ten_ca_nhan_co_quan_to_chuc_cung_cap: 'Kha Tử Thạnh',
  tom_tat_noi_dung: 'Trình báo mất tài sản',
  ...ghiDe,
});

describe('decomposeLegacyRecord — Cán bộ nhập của Vụ việc', () => {
  it('người thêm ở hệ cũ → CẢ ô Cán bộ nhập lẫn người tạo', () => {
    const d = decomposeLegacyRecord(
      vuViec({ __createdById: 'u-nguoi-them', __enteredById: 'u-nguoi-them' }),
    );
    expect(d.incident).toBeDefined();
    expect(d.incident?.canBoNhapId).toBe('u-nguoi-them');
    expect(d.incident?.createdById).toBe('u-nguoi-them');
  });

  it('hệ cũ không ghi người thêm → không bịa người nhập', () => {
    const d = decomposeLegacyRecord(vuViec({}));
    expect(d.incident).toBeDefined();
    expect(d.incident && 'canBoNhapId' in d.incident).toBe(false);
  });
});
