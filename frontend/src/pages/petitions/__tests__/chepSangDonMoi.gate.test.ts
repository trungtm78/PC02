import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHEP_NOI_DUNG,
  DAT_HOM_NAY,
  DAT_LAI_MOC_HO_SO,
  chepSangDonMoi,
} from '../PetitionFormPage/chepSangDonMoi';
import { INITIAL_PETITION_FORM, type PetitionFormData } from '../PetitionFormPage/types';

function sourceWithDistinctValues(): PetitionFormData {
  const source = structuredClone(INITIAL_PETITION_FORM);
  for (const key of Object.keys(source) as (keyof PetitionFormData)[]) {
    const value = source[key];
    if (key === 'legacyExtra') continue;
    Object.assign(source, {
      [key]: typeof value === 'boolean' ? !value : `SOURCE-${String(key)}`,
    });
  }
  source.legacyExtra = {
    nhanXet: 'Nhận xét hệ cũ',
    ngayVietDon: '2024-03-01',
    ketQuaXuLy: '',
  };
  return source;
}

describe('Tạo đơn mới từ đơn này — hợp đồng trường', () => {
  it('mọi trường form thuộc đúng MỘT trong ba nhóm: chép, đặt lại, đặt hôm nay', () => {
    const nhom: Record<string, Set<string>> = {
      chep: new Set<string>(CHEP_NOI_DUNG),
      datLai: new Set<string>(DAT_LAI_MOC_HO_SO),
      homNay: new Set<string>(DAT_HOM_NAY),
    };
    const keys = Object.keys(INITIAL_PETITION_FORM);

    const khongNhom = keys.filter((k) => !Object.values(nhom).some((n) => n.has(k)));
    const nhieuNhom = keys.filter((k) => Object.values(nhom).filter((n) => n.has(k)).length > 1);
    const laTruong = [...Object.values(nhom).flatMap((n) => [...n])].filter((k) => !(k in INITIAL_PETITION_FORM));

    expect(khongNhom).toEqual([]);
    expect(nhieuNhom).toEqual([]);
    expect(laTruong).toEqual([]);
  });

  it('sao chép nguyên mọi giá trị người dùng nhập, kể cả chuỗi rỗng và 10 tab hệ cũ', () => {
    const source = sourceWithDistinctValues();
    const cloned = chepSangDonMoi(source);

    for (const key of CHEP_NOI_DUNG) expect(cloned[key]).toEqual(source[key]);
    expect(cloned.legacyExtra).toEqual(source.legacyExtra);
    expect(cloned.legacyExtra).not.toBe(source.legacyExtra);
    expect(cloned.ngayVietDonEdtf).toBe(source.ngayVietDonEdtf);
    expect(cloned.nhanThay).toBe(source.nhanThay);
    expect(cloned.ketQuaXuLyKhac).toBe(source.ketQuaXuLyKhac);
  });

  it('chỉ đặt lại định danh, phân công, xác nhận trùng và hạn giải quyết', () => {
    const source = sourceWithDistinctValues();
    const cloned = chepSangDonMoi(source);

    for (const key of DAT_LAI_MOC_HO_SO) {
      expect(cloned[key]).toEqual(INITIAL_PETITION_FORM[key]);
    }
  });

  it('không sửa hồ sơ nguồn', () => {
    const source = sourceWithDistinctValues();
    const snapshot = structuredClone(source);
    chepSangDonMoi(source);
    expect(source).toEqual(snapshot);
  });

  describe('quy tắc 08/10/2026: ngày của đơn mới là HÔM NAY, hạn giải quyết tính lại', () => {
    afterEach(() => vi.useRealTimers());

    it('Ngày tiếp nhận, Ngày/Tháng/Năm đề xuất và Ngày tiếp nhận nguồn tin đặt thành hôm nay, không chép ngày đơn cũ', () => {
      vi.useFakeTimers();
      // 03:00 UTC = 10:00 giờ Việt Nam ngày 09/10/2026.
      vi.setSystemTime(new Date('2026-10-09T03:00:00Z'));
      const source = sourceWithDistinctValues();
      source.receivedDate = '2024-01-05';
      source.ngayDeXuat = '2024-01-06';
      source.ngayTiepNhanNguonTin = '2024-01-05';
      const cloned = chepSangDonMoi(source);

      expect(cloned.receivedDate).toBe('2026-10-09');
      expect(cloned.ngayDeXuat).toBe('2026-10-09');
      expect(cloned.ngayTiepNhanNguonTin).toBe('2026-10-09');
      expect([...DAT_HOM_NAY].sort()).toEqual(['ngayDeXuat', 'ngayTiepNhanNguonTin', 'receivedDate']);
    });

    it('tính ngày LÚC CHÉP, không lúc nạp mô-đun: tab mở qua đêm vẫn ra đúng ngày mới', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-08T16:00:00Z')); // 23:00 ngày 08/10 giờ VN
      expect(chepSangDonMoi(sourceWithDistinctValues()).receivedDate).toBe('2026-10-08');
      vi.setSystemTime(new Date('2026-10-08T18:00:00Z')); // 01:00 ngày 09/10 giờ VN
      const sau = chepSangDonMoi(sourceWithDistinctValues());
      expect(sau.receivedDate).toBe('2026-10-09');
      expect(sau.ngayDeXuat).toBe('2026-10-09');
    });

    it('hạn giải quyết của đơn cũ KHÔNG được chép (rỗng để máy chủ tính lại theo ngày tiếp nhận mới)', () => {
      const source = sourceWithDistinctValues();
      source.deadline = '2024-03-05';
      expect(chepSangDonMoi(source).deadline).toBe('');
      expect(DAT_LAI_MOC_HO_SO).toContain('deadline');
    });

    it('phần còn lại giữ đúng quy tắc 29/09: kết quả xử lý, ngày viết đơn, nhận xét vẫn được chép', () => {
      const source = sourceWithDistinctValues();
      const cloned = chepSangDonMoi(source);
      expect(cloned.ketQuaXuLyKhac).toBe(source.ketQuaXuLyKhac);
      expect(cloned.petitionDate).toBe(source.petitionDate);
      expect(cloned.ngayVietDonChu).toBe(source.ngayVietDonChu);
      expect(cloned.nhanThay).toBe(source.nhanThay);
    });
  });
});
