import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import { buildTemplatePlaceholders } from './entity-placeholders';
import { resolveRenderer } from './renderers';
import { detectDocxVariables, DEFAULT_DELIMITERS } from './docx-variables.util';

/**
 * Ca kiểm HIỆN VẬT: render THẬT tệp `.docx` rồi bóc chữ ra đọc.
 *
 * Mọi ca kiểm khác trong thư mục này chốt bộ giải trị — tức là chốt một hàm. Ca kiểm ở đây
 * chốt thứ cán bộ thật sự cầm trên tay. Bốn lớp nằm giữa hai thứ đó, và cả bốn đều đã từng
 * hỏng lặng lẽ: bộ dò biến của bộ nạp mẫu, phép ghép run của docxtemplater, cách xuống dòng,
 * và chính tệp `.docx`.
 *
 * Lỗi anh báo ngày 09/09/2026 ("Kính gửi trống", "Nơi nhận thiếu thông tin") KHÔNG một ca kiểm
 * nào bắt được, vì không ca nào mở một bản in ra đọc.
 *
 * Đặt `GHI_BAN_IN=<thư mục>` để ghi tệp ra xem bằng mắt.
 */

const MAU = path.join(__dirname, '../../prisma/seed-assets/petition-docx/PHIEU_DE_XUAT.docx');

const HO_SO = {
  stt: '2026-123',
  senderName: 'Nguyễn Thị Hồng',
  diaChi: '2 đường 54, phường Tân Hưng',
  nguonDon: 'Bưu điện',
  detailContent: 'Nội dung đơn trình báo.',
  nhanThay: 'Đã kiểm tra hồ sơ.',
  ngayTiepNhanNguonTin: new Date('2026-08-09'),
  petitionDate: new Date('2026-07-15'),
  receivedDate: new Date('2026-08-09'),
  donViGiaiQuyet: 'Tổ công tác số 6',
  canBoDeXuat: { firstName: 'Văn', lastName: 'Phạm Thanh', rank: 'Đại úy' },
};

/** Người đang đăng nhập — KHÁC cán bộ đề xuất, để thấy rõ dòng "Lưu:" theo ai. */
const CTX = {
  actor: { firstName: 'Huy', lastName: 'Nguyễn Văn', rank: 'Thiếu tá', teamName: 'Tổ 5' },
};

function inRa(huongXuLy: string | null): string {
  const bytes = fs.readFileSync(MAU);
  const bien = detectDocxVariables(bytes).map((n) => ({ name: n, source: 'auto' as const, field: n }));
  const ph = buildTemplatePlaceholders(
    'DON_THU',
    bien,
    { ...HO_SO, huongXuLy },
    {},
    undefined,
    CTX,
  );
  const ra = resolveRenderer('DOCX').render({
    buffer: bytes,
    data: ph,
    delimiters: DEFAULT_DELIMITERS,
    kieuXuongDong: 'mem',
  });

  const thuMuc = process.env['GHI_BAN_IN'];
  if (thuMuc) {
    fs.mkdirSync(thuMuc, { recursive: true });
    fs.writeFileSync(path.join(thuMuc, `de-xuat-${huongXuLy ?? 'CHUA-CHON'}.docx`), ra);
  }

  const xml = new PizZip(ra).file('word/document.xml')!.asText();
  // Ngắt dòng mềm phải thành xuống dòng khi đọc, nếu không bốn dòng "Nơi nhận" dính làm một.
  return xml
    .replace(/<w:br\s*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '');
}

/**
 * Ba ô của HÀNG ĐẦU trong bảng chữ ký cuối trang, theo đúng thứ tự trái → phải.
 *
 * Phải đọc theo Ô chứ không theo chữ: `toContain('Đại uý Phạm Thanh Văn')` vẫn xanh khi tên
 * nằm nhầm cột "PHÊ DUYỆT CỦA BAN CHỈ HUY PHÒNG" — đúng lỗi anh chụp ảnh ngày 10/09/2026.
 */
function oKhoiKy(huongXuLy: string | null): string[] {
  const bytes = fs.readFileSync(MAU);
  const bien = detectDocxVariables(bytes).map((n) => ({ name: n, source: 'auto' as const, field: n }));
  const ph = buildTemplatePlaceholders('DON_THU', bien, { ...HO_SO, huongXuLy }, {}, undefined, CTX);
  const ra = resolveRenderer('DOCX').render({
    buffer: bytes,
    data: ph,
    delimiters: DEFAULT_DELIMITERS,
    kieuXuongDong: 'mem',
  });
  const xml = new PizZip(ra).file('word/document.xml')!.asText();
  const bang = xml.slice(xml.lastIndexOf('<w:tbl>'));
  const hang = bang.slice(0, bang.indexOf('</w:tr>'));
  return hang
    .split('<w:tc>')
    .slice(1)
    .map((o) =>
      o
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .trim(),
    );
}

describe('bản in Phiếu đề xuất THẬT — đọc chữ ra khỏi tệp .docx', () => {
  it('Giao đơn: Kính gửi hai dòng Ban chỉ huy, câu Đề xuất khuôn Giao', () => {
    const chu = inRa('GIAO_DON');
    expect(chu).toContain('- Ban chỉ huy PC02;');
    expect(chu).toContain('- Ban chỉ huy Tổ công tác số 6.');
    expect(chu).toContain('Giao Tổ công tác số 6 tiếp nhận kiểm tra, xác minh');
  });

  it('Chuyển đơn: Kính gửi CHỈ đơn vị giải quyết, câu Đề xuất khuôn Chuyển', () => {
    const chu = inRa('CHUYEN_DON');
    expect(chu).toContain('- Tổ công tác số 6.');
    expect(chu).not.toContain('- Ban chỉ huy PC02;');
    expect(chu).toContain('Chuyển Tổ công tác số 6 để xem xét, giải quyết theo quy định');
  });

  it('Trả đơn/Lưu đơn: câu Đề xuất chỉ còn tên đơn vị', () => {
    const chu = inRa('TRA_LUU_DON');
    expect(chu).toContain('Đề xuất: Tổ công tác số 6./.');
  });

  /**
   * Đây là ô anh chụp ảnh gửi lại. Bốn dòng, và dòng "Lưu:" phải mang TỔ của người đang đăng
   * nhập (Tổ 5) cùng tên viết tắt của chính người ấy (V.Huy) — không phải "Tổ 2" ghi cứng và
   * không phải cán bộ đề xuất chọn trên form (T.Văn).
   */
  it('khối Nơi nhận đủ bốn dòng, dòng Lưu mang tổ và tên người ĐANG ĐĂNG NHẬP', () => {
    const chu = inRa('GIAO_DON');
    expect(chu).toContain('Nơi nhận:');
    expect(chu).toContain('- Như trên;');
    expect(chu).toContain('- Đ/c Trưởng phòng (thay báo cáo);');
    expect(chu).toContain('- Bưu điện (thay báo cáo);');
    expect(chu.match(/\(thay báo cáo\)/g)).toHaveLength(2);
    expect(chu).toContain('- Lưu: PC02-Đ1 (Tổ 5), V.Huy.');
    // "Tổ 2" từng ghi CỨNG trong tệp Word — in một lần thì trông vẫn đúng, chỉ lộ khi hồ sơ
    // thuộc tổ khác. Người in ở đây thuộc Tổ 5.
    expect(chu).not.toContain('(Tổ 2)');
    // Dòng "Lưu:" theo NGƯỜI IN, không theo cán bộ đề xuất chọn trên form (T.Văn).
    expect(chu).not.toContain('T.Văn');
  });

  it('hồ sơ không có nguồn đơn: BỎ HẲN dòng, không in gạch đầu dòng cụt', () => {
    const bytes = fs.readFileSync(MAU);
    const bien = detectDocxVariables(bytes).map((n) => ({ name: n, source: 'auto' as const, field: n }));
    const ph = buildTemplatePlaceholders(
      'DON_THU',
      bien,
      { ...HO_SO, nguonDon: null, huongXuLy: 'GIAO_DON' },
      {},
      undefined,
      CTX,
    );
    const ra = resolveRenderer('DOCX').render({
      buffer: bytes,
      data: ph,
      delimiters: DEFAULT_DELIMITERS,
      kieuXuongDong: 'mem',
    });
    const chu = new PizZip(ra)
      .file('word/document.xml')!
      .asText()
      .replace(/<w:br\s*\/>/g, '\n')
      .replace(/<[^>]+>/g, '');
    // Không có gạch đầu dòng RỖNG kiểu "-  (thay báo cáo);" — dấu gạch phải luôn có chữ theo sau.
    expect(chu).not.toMatch(/-\s+\(thay báo cáo\)/);
    // Đúng HAI dòng "(thay báo cáo)" khi có nguồn đơn, MỘT dòng khi không — đếm cho chắc, vì
    // "không chứa" không phân biệt được thiếu dòng với thừa dòng.
    expect(chu.match(/\(thay báo cáo\)/g)).toHaveLength(1);
    expect(chu).toContain('- Lưu: PC02-Đ1 (Tổ 5), V.Huy.');
  });

  /**
   * CHỐNG HỒI QUY: hồ sơ chưa có hướng phải in ra ĐÚNG như trước khi có tính năng này — đã đo
   * khớp hệ cũ 22/22 mục ngày 09/09/2026.
   */
  it('hồ sơ chưa chọn hướng: câu Đề xuất và Kính gửi giữ nguyên khuôn cũ', () => {
    const chu = inRa(null);
    expect(chu).toContain('Giao Tổ công tác số 6 tiếp nhận kiểm tra, xác minh');
    expect(chu).toContain('- Ban chỉ huy PC02;');
  });

  /**
   * Khung đỏ thứ nhất anh vẽ: dòng chức danh trộn HOA với thường. Mẫu hệ cũ ghi cứng
   * "PHÓ ĐỘI TRƯỞNG ĐỘI 1".
   */
  it('dòng chức danh viết HOA cả cụm, kể cả tên đội', () => {
    const [, giua] = oKhoiKy('GIAO_DON');
    expect(giua).toContain('PHÓ ĐỘI TRƯỞNG ĐỘI 1');
    expect(giua).not.toContain('PHÓ ĐỘI TRƯỞNG Đội 1');
  });

  /**
   * Khung đỏ thứ hai: tên cán bộ đề xuất in ra dưới cột "PHÊ DUYỆT CỦA BAN CHỈ HUY PHÒNG".
   * Chốt theo Ô — mỗi tên phải nằm ĐÚNG dưới chức danh của mình, và ô phê duyệt phải trống
   * để chỉ huy ký tay.
   */
  it('tên cán bộ đề xuất nằm trong Ô "CÁN BỘ ĐỀ XUẤT", không lệch sang ô phê duyệt', () => {
    const [pheDuyet, giua, canBo] = oKhoiKy('GIAO_DON');
    expect(canBo).toContain('CÁN BỘ ĐỀ XUẤT');
    expect(canBo).toContain('Đại úy Phạm Thanh Văn');
    expect(pheDuyet).toContain('PHÊ DUYỆT');
    expect(pheDuyet).not.toContain('Phạm Thanh Văn');
    expect(giua).not.toContain('Phạm Thanh Văn');
  });

  /**
   * Hai tên phải cùng một dòng ngang. Ô giữa có thêm dòng "Ngày … tháng …" nên số đoạn trống
   * hai bên khác nhau — đếm đoạn mới thấy, nhìn chữ thì không.
   */
  it('tên cán bộ và tên phó đội trưởng nằm cùng một dòng ngang', () => {
    // Đo trên CHÍNH tệp mẫu: bản render không dùng được vì {tenPhoDoiTruong} của hồ sơ mẫu
    // rỗng (chưa có tổ trưởng), dòng trống thì không so vị trí được.
    const xml = new PizZip(fs.readFileSync(MAU)).file('word/document.xml')!.asText();
    const bang = xml.slice(xml.lastIndexOf('<w:tbl>'));
    const o = bang
      .slice(0, bang.indexOf('</w:tr>'))
      .split('<w:tc>')
      .slice(1)
      .map((c) => c.split('</w:p>').map((p) => p.replace(/<[^>]+>/g, '')));
    expect(o[2].findIndex((d) => d.includes('{tenCanBoDeXuat}'))).toBe(
      o[1].findIndex((d) => d.includes('{tenPhoDoiTruong}')),
    );
  });

  it('không còn ô nào in ra tên biến chưa thay', () => {
    for (const huong of ['GIAO_DON', 'CHUYEN_DON', 'TRA_LUU_DON', null]) {
      expect(inRa(huong)).not.toMatch(/\{[a-zA-Z]+\}/);
    }
  });
});
