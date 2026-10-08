/**
 * CỔNG ĐỒNG BỘ (R-C5): giá trị hợp lệ + mặc định của cấu hình "bấm vào dòng" nằm ở BA nơi — máy chủ, migration,
 * giao diện. Lệch một chữ là cấu hình admin lặng lẽ không có tác dụng, nên đọc thẳng tệp máy chủ để so.
 *
 * Gieo lỗi (đã thử tay): đổi 'XEM_HAI_CHAM' ở một bên → ca "giá trị hợp lệ khớp" đỏ; đổi mặc định một màn → ca
 * "mặc định khớp" đỏ; bỏ một khoá khỏi migration → ca "migration" đỏ.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  BAM_DONG_MAC_DINH,
  BAM_DONG_OPTIONS,
  KHOA_BAM_DONG,
  MAN_BAM_DONG,
  gopCauHinhBamDong,
} from '../giaoDienSettings';
import { LUA_CHON_THEO_KHOA, MAC_DINH_THEO_KHOA, sapXepCaiDat } from '../thongKeSettings';

const GOC = path.resolve(__dirname, '../../../..');
const maychu = fs.readFileSync(path.join(GOC, 'backend/src/common/constants/giao-dien.constants.ts'), 'utf-8');
const migration = fs.readFileSync(
  path.join(GOC, 'backend/prisma/migrations/20261008090000_bam_dong_settings/migration.sql'),
  'utf-8',
);

function giaTriMayChu(): string[] {
  const khoi = /export const BAM_DONG_GIA_TRI = \{([\s\S]*?)\} as const;/.exec(maychu);
  expect(khoi, 'không đọc được BAM_DONG_GIA_TRI ở máy chủ').not.toBeNull();
  return [...khoi![1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
}

function macDinhMayChu(): Record<string, string> {
  const khoi = /export const BAM_DONG_MAC_DINH[^=]*= \{([\s\S]*?)\};/.exec(maychu);
  expect(khoi, 'không đọc được BAM_DONG_MAC_DINH ở máy chủ').not.toBeNull();
  return Object.fromEntries([...khoi![1].matchAll(/(BAM_DONG_[A-Z_]+): '([A-Z_]+)'/g)].map((m) => [m[1], m[2]]));
}

describe('cổng đồng bộ cấu hình bấm vào dòng (máy chủ ↔ migration ↔ giao diện)', () => {
  it('giá trị hợp lệ khớp từng chữ, đúng thứ tự', () => {
    expect(BAM_DONG_OPTIONS.map((o) => o.value)).toEqual(giaTriMayChu());
  });

  it('bộ khoá khớp: 7 khoá, giao diện = máy chủ', () => {
    const md = macDinhMayChu();
    expect(Object.keys(md).sort()).toEqual([...KHOA_BAM_DONG].sort());
    expect(KHOA_BAM_DONG).toHaveLength(7);
    expect(Object.values(MAN_BAM_DONG).sort()).toEqual([...KHOA_BAM_DONG].sort());
  });

  it('mặc định khớp từng màn', () => {
    expect(macDinhMayChu()).toEqual(BAM_DONG_MAC_DINH);
  });

  it('migration gieo ĐÚNG 7 khoá với đúng mặc định', () => {
    for (const k of KHOA_BAM_DONG) {
      expect(migration, k).toContain(`'${k}', '${BAM_DONG_MAC_DINH[k]}'`);
    }
    const khoa = [...migration.matchAll(/'(BAM_DONG_[A-Z_]+)'/g)].map((m) => m[1]);
    expect(new Set(khoa)).toEqual(new Set(KHOA_BAM_DONG));
  });

  it('trang Cài đặt có ô CHỌN + nút "Về mặc định" cho cả 7 khoá, và xếp chúng LIỀN NHAU', () => {
    for (const k of KHOA_BAM_DONG) {
      expect(LUA_CHON_THEO_KHOA[k]?.map((o) => o.value), k).toEqual(BAM_DONG_OPTIONS.map((o) => o.value));
      expect(MAC_DINH_THEO_KHOA[k], k).toBe(BAM_DONG_MAC_DINH[k]);
    }
    const sapXep = sapXepCaiDat([
      { key: 'TEN_TRUONG_PHONG' },
      ...[...KHOA_BAM_DONG].reverse().map((key) => ({ key })),
      { key: 'THONG_KE_KY' },
    ]).map((x) => x.key);
    const dau = sapXep.indexOf(KHOA_BAM_DONG[0]);
    expect(sapXep.slice(dau, dau + 7)).toEqual([...KHOA_BAM_DONG]);
  });

  describe('gopCauHinhBamDong', () => {
    it('dữ liệu rác / thiếu → mặc định, không ném lỗi', () => {
      for (const thô of [null, undefined, 5, 'x', [], {}, { BAM_DONG_DON_THU: 123 }, { BAM_DONG_DON_THU: 'RAC' }]) {
        expect(gopCauHinhBamDong(thô)).toEqual(BAM_DONG_MAC_DINH);
      }
    });

    it('giữ giá trị hợp lệ, bỏ khoá lạ', () => {
      const r = gopCauHinhBamDong({ BAM_DONG_VU_AN: 'SUA', TWO_FA_ENABLED: 'true' });
      expect(r.BAM_DONG_VU_AN).toBe('SUA');
      expect(Object.keys(r).sort()).toEqual([...KHOA_BAM_DONG].sort());
    });
  });
});
