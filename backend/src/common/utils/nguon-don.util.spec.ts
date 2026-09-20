import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { khoaNguonDon, laNguonTrucTiep } from './nguon-don.util';

/**
 * "Nguồn đơn/Đơn vị giao" là ô chữ tự do trên hệ cũ. Đo trên bản chạy thật 20/09/2026:
 * 47.456/47.488 đơn có giá trị, **1.431 cách viết**, gộp theo khoá đơn vị còn 972 nhóm.
 * Nhiều nhất: Bưu điện 14.758 · Trực tiếp 10.656 · "trực tiếp" 956 · PC01 CA TP.HCM ~6.700.
 * 2.162 dòng ở dạng NFD — trông giống hệt dòng NFC nhưng khác byte.
 */
describe('khoaNguonDon — khoá gộp', () => {
  it('gộp hoa/thường và khoảng trắng thừa', () => {
    expect(khoaNguonDon('Trực tiếp')).toBe(khoaNguonDon('trực tiếp'));
    expect(khoaNguonDon('  Bưu   điện ')).toBe(khoaNguonDon('Bưu điện'));
  });

  it('gộp chữ dựng sẵn (NFC) với chữ gõ tổ hợp (NFD) — 2.162 dòng prod ở dạng NFD', () => {
    expect(khoaNguonDon('Trực tiếp'.normalize('NFD'))).toBe(
      khoaNguonDon('Trực tiếp'.normalize('NFC')),
    );
  });

  it('gộp biến thể dấu câu và viết tắt đơn vị', () => {
    expect(khoaNguonDon('PC01 CA TP.HCM')).toBe(
      khoaNguonDon('PC01 CA TP. Hồ Chí Minh'),
    );
  });

  it('rỗng/null ra chuỗi rỗng, không nổ', () => {
    expect(khoaNguonDon(null)).toBe('');
    expect(khoaNguonDon(undefined)).toBe('');
    expect(khoaNguonDon('   ')).toBe('');
  });
});

/**
 * Cờ "Trực tiếp" quyết định nhóm thông tin định danh nguyên đơn có bung ra hay không, và
 * quyết định SĐT nguyên đơn có bắt buộc hay không.
 *
 * Suy từ TÊN đã chuẩn hoá, KHÔNG đọc cơ sở dữ liệu: hàm thuần chạy y hệt ở máy chủ lẫn trình
 * duyệt, và mục danh mục do cán bộ tạo nhanh tự mang cờ — không ai quên gắn được.
 */
describe('laNguonTrucTiep', () => {
  it.each([
    'Trực tiếp',
    'trực tiếp',
    'TRỰC TIẾP',
    '  Trực tiếp  ',
    'Trực tiếp'.normalize('NFD'),
    'Nộp trực tiếp',
    'Nộp trực tiếp tại trụ sở',
    'Công dân trực tiếp đến',
  ])('nhận "%s" là trực tiếp', (ten) => {
    expect(laNguonTrucTiep(ten)).toBe(true);
  });

  it.each([
    'Bưu điện',
    'PC01 Công an TP.HCM',
    'Trại tạm giam Chí Hòa',
    'Công an phường Bàn Cờ',
    '',
    null,
    undefined,
  ])('KHÔNG nhận "%s" là trực tiếp', (ten) => {
    expect(laNguonTrucTiep(ten as string)).toBe(false);
  });

  it('không cắt vào giữa chữ — "gián tiếp" không phải "trực tiếp"', () => {
    expect(laNguonTrucTiep('Gián tiếp qua bưu điện')).toBe(false);
  });
});

/**
 * CỔNG HAI ĐẦU: máy chủ và trình duyệt phải cho CÙNG kết quả.
 *
 * Luật này quyết định hai thứ cán bộ nhìn thấy — nhóm thông tin định danh có tự bung không,
 * và Số điện thoại nguyên đơn có bắt buộc không. Lệch nhau nghĩa là form cho Lưu còn máy chủ
 * trả 400, hoặc ngược lại form chặn thứ máy chủ nhận. Cả hai đều là hỏng im lặng với cán bộ.
 *
 * Một nguồn sự thật: `frontend/src/shared/nguon-don/truc-tiep.corpus.json`. Bản trình duyệt
 * chấm chính nó trên tệp ấy ở `truc-tiep.test.ts`; bản máy chủ chấm ở đây. Bên nào trôi thì
 * cổng của bên ấy đỏ. Không dựng bộ sinh mã riêng cho một hàm sáu dòng.
 */
interface BoTenChuan {
  truc_tiep: string[];
  khong_truc_tiep: string[];
  _khoa_gop_phai_KHAC_nhau: [string, string][];
  _khoa_gop_phai_GIONG_nhau: [string, string][];
}

const DUONG_CORPUS = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'frontend',
  'src',
  'shared',
  'nguon-don',
  'truc-tiep.corpus.json',
);

const boTen = JSON.parse(readFileSync(DUONG_CORPUS, 'utf8')) as BoTenChuan;

describe('laNguonTrucTiep (máy chủ) — chấm trên bộ tên chuẩn dùng chung với trình duyệt', () => {
  it('đọc được bộ tên chuẩn và nó không rỗng', () => {
    // Đổi đường dẫn tệp mà quên sửa đây thì cổng quét 0 mẫu và vẫn xanh — mệnh đề này chặn.
    expect(boTen.truc_tiep.length).toBeGreaterThan(5);
    expect(boTen.khong_truc_tiep.length).toBeGreaterThan(5);
  });

  it('nhận đúng MỌI tên trong nhóm trực tiếp', () => {
    const sai = boTen.truc_tiep.filter((t) => !laNguonTrucTiep(t));
    expect(sai).toEqual([]);
  });

  it('KHÔNG nhận nhầm tên nào trong nhóm không-trực-tiếp', () => {
    const sai = boTen.khong_truc_tiep.filter((t) => laNguonTrucTiep(t));
    expect(sai).toEqual([]);
  });
});

/**
 * Khoá gộp: hai giá trị khác nghĩa KHÔNG được về cùng một mục danh mục.
 *
 * Bản đầu dùng lại `khoaDonVi` — hàm ấy bỏ tiền tố "phòng"/"bch" theo ngữ pháp tên ĐƠN VỊ.
 * Đo trên chính nó: "Phòng 1" → "1", "Phòng 2" → "2" (khoá rút còn một chữ số),
 * "Phòng Tiếp công dân" → "tiep cong dan" (gộp một đơn vị với một kênh tiếp nhận),
 * "Phòng chống tệ nạn xã hội" → "chong te nan xa hoi" (cắt nửa từ ghép). Gộp nhầm là một
 * trong hai nghĩa BIẾN MẤT khỏi danh mục, vì tên chuẩn lấy theo bên đông hồ sơ hơn.
 */
describe('khoaNguonDon — không gộp nhầm hai nghĩa khác nhau', () => {
  it.each(boTen._khoa_gop_phai_KHAC_nhau)(
    '"%s" và "%s" phải là HAI mục',
    (a, b) => {
      expect(khoaNguonDon(a)).not.toBe(khoaNguonDon(b));
    },
  );

  it.each(boTen._khoa_gop_phai_GIONG_nhau)(
    '"%s" và "%s" phải là MỘT mục',
    (a, b) => {
      expect(khoaNguonDon(a)).toBe(khoaNguonDon(b));
    },
  );

  it('khoá KHÔNG bao giờ rút xuống một chữ số — "Phòng 1" không được thành "1"', () => {
    expect(khoaNguonDon('Phòng 1')).not.toBe('1');
    expect(khoaNguonDon('Phòng 1')).toContain('phong');
  });
});
