import { describe, it, expect } from 'vitest';
import {
  PETITION_LEGACY_LAYOUT,
  PETITION_LEGACY_SPEC,
  dichLuu,
} from '../legacy-form-binding';
import { LEGACY_FORM_LAYOUT } from '@/features/cases/legacy-form-layout.def';
import { INITIAL_PETITION_FORM } from '@/pages/petitions/PetitionFormPage/types';
import { ownedColumns } from '@/features/legacy-form/types';

/**
 * CỔNG: mọi ô của bố cục hệ cũ đều phải có chỗ lưu trên Đơn thư.
 *
 * Ô hiện trên màn hình mà không có chỗ lưu là kiểu hỏng tệ nhất: cán bộ gõ, bấm Lưu, hệ thống
 * báo thành công, dữ liệu biến mất. Không có thông báo nào, và chỉ lộ ra khi ai đó mở lại hồ
 * sơ hàng tuần sau.
 */
describe('Mọi ô hệ cũ trên form Đơn thư đều có chỗ lưu', () => {
  const KHOA_FORM = new Set(Object.keys(INITIAL_PETITION_FORM));

  it('bố cục Đơn thư giữ NGUYÊN số ô và thứ tự của bố cục hệ cũ', () => {
    for (const tab of Object.keys(LEGACY_FORM_LAYOUT)) {
      const goc = LEGACY_FORM_LAYOUT[tab as keyof typeof LEGACY_FORM_LAYOUT];
      const donThu = PETITION_LEGACY_LAYOUT[tab as keyof typeof PETITION_LEGACY_LAYOUT];
      expect(donThu.map((i) => i.caption)).toEqual(goc.map((i) => i.caption));
      expect(donThu.map((i) => i.span)).toEqual(goc.map((i) => i.span));
    }
  });

  it('mọi ô trỏ tới một khoá form CÓ THẬT, hoặc vào nhánh phụ', () => {
    const hong: string[] = [];
    for (const items of Object.values(PETITION_LEGACY_LAYOUT)) {
      for (const it of items) {
        if (it.field.startsWith('legacyExtra.')) continue;
        if (!KHOA_FORM.has(it.field)) hong.push(`${it.caption} → ${it.field}`);
      }
    }
    expect(hong).toEqual([]);
  });

  /**
   * Hai ô hệ cũ khác nhau trỏ cùng một chỗ lưu thì sửa ô này đổi luôn ô kia. Trừ TRƯỜNG GƯƠNG
   * — hệ cũ cố ý hiện lại một ô ở nhiều tab, và đồng bộ tức thì là đúng ý.
   */
  it('hai ô khác nghĩa không trỏ chung một chỗ lưu', () => {
    const theoDich = new Map<string, Set<string>>();
    for (const items of Object.values(PETITION_LEGACY_LAYOUT)) {
      for (const it of items) {
        if (!theoDich.has(it.field)) theoDich.set(it.field, new Set());
        theoDich.get(it.field)!.add(it.caption);
      }
    }
    const dungChung = [...theoDich.entries()]
      .filter(([, caps]) => caps.size > 1)
      .map(([dich, caps]) => `${dich}: ${[...caps].join(' | ')}`);
    expect(dungChung).toEqual([]);
  });

  it('ô của nhánh thống kê bên Vụ án không mang theo tiền tố cũ', () => {
    expect(dichLuu('statistic.ngayThongKe')).toBe('legacyExtra.ngayThongKe');
    expect(dichLuu('statistic.soTienBiThietHai')).toBe('soTienBiThietHai');
  });

  /**
   * Panel "Thông tin nghiệp vụ bổ sung" không được dựng ô thứ hai cho cột form đã sở hữu —
   * panel gộp vào payload SAU form nên panel thắng, cán bộ mất thứ vừa gõ.
   */
  it('bảng đổi ô-với-cột nhận ra đúng những cột form đã sở hữu', () => {
    const soHuu = ownedColumns(PETITION_LEGACY_SPEC);
    for (const cot of ['senderName', 'detailContent', 'nguonDon', 'baoCaoBanGiamDocText']) {
      expect(soHuu.has(cot)).toBe(true);
    }
    // Ô nằm ở nhánh phụ không phải cột của bảng chính.
    expect(soHuu.has('legacyExtra.ngayThongKe')).toBe(false);
  });
});

describe('Đọc và ghi qua đặc tả Đơn thư', () => {
  it('ghi vào khoá thường và đọc lại đúng', () => {
    const sau = PETITION_LEGACY_SPEC.write(INITIAL_PETITION_FORM, 'senderName', 'Nguyễn Văn A');
    expect(PETITION_LEGACY_SPEC.read(sau, 'senderName')).toBe('Nguyễn Văn A');
  });

  it('ghi vào nhánh phụ và đọc lại đúng, không đụng khoá khác', () => {
    const sau = PETITION_LEGACY_SPEC.write(
      INITIAL_PETITION_FORM,
      'legacyExtra.soQuyetDinhKhoiTo',
      '12/QĐ-KTVA',
    );
    expect(PETITION_LEGACY_SPEC.read(sau, 'legacyExtra.soQuyetDinhKhoiTo')).toBe('12/QĐ-KTVA');
    expect(sau.senderName).toBe(INITIAL_PETITION_FORM.senderName);
  });
});
