import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import PizZip from 'pizzip';
import {
  chayVoi,
  duongXuatHeMoi,
  soDinhDang,
  thucTheChoDuong,
  type DongGhepCap,
} from './cap-ban-in';
import { dinhDangDoan } from './so-ban-in';

/**
 * Bộ ghép cặp bản in: một hồ sơ, hai hệ, đặt cạnh nhau.
 *
 * Vòng đối chiếu 28/08 tự dựng lại phép render của hệ mới thay vì gọi đường xuất thật, và
 * lệch với máy chủ ở năm chỗ (đọc mẫu từ đĩa chứ không từ CSDL, đánh mọi biến là `auto`,
 * không truyền người in, không truyền ô thủ công, chỉ so theo một thực thể). Ở đây bản hệ mới
 * là thứ máy chủ THẬT trả về, nên năm chỗ ấy biến mất theo định nghĩa.
 */
describe('duongXuatHeMoi', () => {
  it('mỗi thực thể có đúng đường xuất của nó', () => {
    expect(duongXuatHeMoi('DON_THU', 'abc')).toBe('/api/v1/petitions/abc/export-documents');
    expect(duongXuatHeMoi('VU_VIEC', 'abc')).toBe('/api/v1/incidents/abc/export-documents');
    expect(duongXuatHeMoi('VU_AN', 'abc')).toBe('/api/v1/cases/abc/export-documents');
  });

  /**
   * Bảng nào cũng phải đi kèm cách đọc ngược, nếu không hai bảng sẽ trôi khỏi nhau.
   * `thucTheChoDuong` là chiều ngược của `duongXuatHeMoi` — dùng khi đọc bản ghi ở hệ mới.
   */
  it('đọc ngược từ tên bảng của hệ mới về thực thể', () => {
    expect(thucTheChoDuong('petition')).toBe('DON_THU');
    expect(thucTheChoDuong('incident')).toBe('VU_VIEC');
    expect(thucTheChoDuong('case')).toBe('VU_AN');
  });
});

function docxDinhDang(doan: { chu: string; canLe?: string; thut?: number }[]): Buffer {
  const than = doan
    .map((d) => {
      const pPr =
        d.canLe || d.thut
          ? `<w:pPr>${d.canLe ? `<w:jc w:val="${d.canLe}"/>` : ''}${
              d.thut ? `<w:ind w:firstLine="${d.thut}"/>` : ''
            }</w:pPr>`
          : '';
      return `<w:p>${pPr}<w:r><w:t>${d.chu}</w:t></w:r></w:p>`;
    })
    .join('');
  const zip = new PizZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document><w:body>${than}</w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

describe('soDinhDang', () => {
  it('hai bản cùng định dạng → không lệch', () => {
    const a = dinhDangDoan(docxDinhDang([{ chu: 'x', canLe: 'both', thut: 720 }]));

    expect(soDinhDang(a, a)).toEqual([]);
  });

  /**
   * Đây chính là khác biệt hệ cũ ↔ hệ mới trên ô nhiều dòng: hệ cũ căn đều + thụt đầu dòng,
   * hệ mới để mặc định. Chữ giống hệt nhau nên phép so CHỮ mãi mãi không thấy.
   */
  it('cùng chữ nhưng khác căn lề/thụt dòng → BÁO lệch, kèm số thứ tự đoạn', () => {
    const cu = dinhDangDoan(docxDinhDang([{ chu: 'a' }, { chu: 'b', canLe: 'both', thut: 720 }]));
    const moi = dinhDangDoan(docxDinhDang([{ chu: 'a' }, { chu: 'b' }]));

    expect(soDinhDang(cu, moi)).toEqual([
      { doanSo: 2, heCu: 'canLe=both thut=720', heMoi: 'canLe=mặc định thut=0' },
    ]);
  });

  it('lệch SỐ đoạn cũng phải báo, không lặng lẽ so phần đầu rồi thôi', () => {
    const cu = dinhDangDoan(docxDinhDang([{ chu: 'a' }, { chu: 'b' }, { chu: 'c' }]));
    const moi = dinhDangDoan(docxDinhDang([{ chu: 'a' }]));

    expect(soDinhDang(cu, moi)).toHaveLength(2);
  });
});

/**
 * MỘT CẶP HỎNG KHÔNG ĐƯỢC LÀM MẤT CẢ LƯỢT.
 *
 * Lượt chạy thật đầu tiên (09/09/2026) đâm vào giới hạn 5 lượt/phút ở cặp thứ 8 rồi ném ra
 * ngoài, nên báo cáo của bảy cặp đã tải xong và đã đo KHÔNG BAO GIỜ được ghi. Mất công tải,
 * mất công đo, và người đọc không có gì trong tay — đúng thứ mà `hong` trong bảng ngăn lại.
 */
describe('chayVoi — chịu được một cặp hỏng', () => {
  const thuMuc = path.join(os.tmpdir(), `cap-ban-in-${Date.now()}`);
  const ghep: DongGhepCap[] = [
    { mau: 'don_thu_mau.docx', legacyId: 1, idHeMoi: 'a', thucThe: 'DON_THU' },
    { mau: 'huong_dan_mau.docx', legacyId: 2, idHeMoi: 'b', thucThe: 'DON_THU' },
    { mau: 'tra_ho_so_mau.docx', legacyId: 3, idHeMoi: 'c', thucThe: 'DON_THU' },
  ];

  afterAll(() => fs.rmSync(thuMuc, { recursive: true, force: true }));

  it('cặp giữa lỗi thì hai cặp kia vẫn ra báo cáo, và cặp lỗi vào cột riêng', async () => {
    const kq = await chayVoi(
      ghep,
      thuMuc,
      async (g) => {
        if (g.legacyId === 2) throw new Error('ThrottlerException: Too Many Requests');
        const b = docxDinhDang([{ chu: 'x' }]);
        return { banCu: b, banMoi: b };
      },
      0,
    );

    expect(kq.cap.map((c) => c.legacyId)).toEqual([1, 3]);
    expect(kq.hong).toEqual([
      { maMau: 'HE_CU_HUONG_DAN', legacyId: 2, loi: 'ThrottlerException: Too Many Requests' },
    ]);

    const bang = fs.readFileSync(path.join(thuMuc, 'bang-lech.md'), 'utf8');
    expect(bang).toContain('KHÔNG LẤY ĐƯỢC');
    expect(bang).toContain('HE_CU_DON_THU');
  });
});
