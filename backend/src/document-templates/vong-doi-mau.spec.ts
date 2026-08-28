import { BadRequestException, NotFoundException } from '@nestjs/common';
import PizZip from 'pizzip';
import { DocumentTemplatesService } from './document-templates.service';
import {
  TRANG_THAI_MAU,
  TRANG_THAI_MAC_DINH_KHI_TAO,
  chuyenDuocSang,
} from './document-template.constants';

/**
 * VÒNG ĐỜI mẫu chứng từ: nháp → ban hành → thu hồi.
 *
 * ── Vì sao dựng ──
 *
 * Ngày 28/08/2026 một đợt kiểm bảo mật để lại ba mẫu `TPL_MALICIOUS` / `TPL_XXE` /
 * `TPL_NORMAL_baseline` trên MÁY THẬT. Chúng ở trạng thái `active` nên **hiện thẳng trong popup
 * In chứng từ của mọi cán bộ** ở màn Vụ việc — anh phát hiện vì thấy "mẫu chứng từ lạ".
 *
 * Gốc rễ không phải ba hàng rác ấy, mà là: **mẫu vừa tải lên đã thành `active` ngay lập tức**.
 * Không có bước nào giữa "một người tải tệp lên" và "toàn bộ cán bộ nhìn thấy nó".
 *
 * ── Thiết kế ──
 *
 * Đây là lối quản trị chuẩn của các hệ quản lý biểu mẫu (DocuSign, Conga, M-Files): không gì tới
 * tay người dùng cuối khi chưa được BAN HÀNH tường minh, và nghỉ hưu một mẫu là thu hồi chứ
 * không xoá — lịch sử in đã phát hành vẫn phải tra được.
 *
 * Popup in vốn đã lọc `status: 'active'`, nên nháp và đã-thu-hồi tự động vô hình. Không phải sửa
 * một dòng nào ở đường in — đó là chỗ thiết kế này gọn.
 */
describe('Vòng đời mẫu chứng từ', () => {
  describe('bảng trạng thái', () => {
    it('khai đủ ba trạng thái', () => {
      expect([...TRANG_THAI_MAU].sort()).toEqual(['active', 'archived', 'draft']);
    });

    /**
     * Tải lên là NHÁP, không phải phát hành. Đây là dòng chặn cả lớp sự cố 28/08: một tệp thử
     * nghiệm tải lên không còn tự đi thẳng tới cán bộ.
     */
    it('mẫu mới tạo là NHÁP', () => {
      expect(TRANG_THAI_MAC_DINH_KHI_TAO).toBe('draft');
    });

    it.each([
      ['draft', 'active', true],
      ['active', 'archived', true],
      ['archived', 'active', true],
      ['draft', 'archived', true],
    ])('cho phép %s → %s', (tu, sang, duoc) => {
      expect(chuyenDuocSang(tu, sang)).toBe(duoc);
    });

    /** Chuyển sang chính nó là thao tác thừa — chặn để nhật ký không đầy bản ghi vô nghĩa. */
    it.each([['draft'], ['active'], ['archived']])('chặn %s → chính nó', (tt) => {
      expect(chuyenDuocSang(tt, tt)).toBe(false);
    });

    it('chặn trạng thái lạ', () => {
      expect(chuyenDuocSang('active', 'bịa')).toBe(false);
      expect(chuyenDuocSang('bịa', 'active')).toBe(false);
    });
  });

  describe('service', () => {
    function docxGia(): Buffer {
      const zip = new PizZip();
      zip.file(
        'word/document.xml',
        '<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>{tenHoSo}</w:t></w:r></w:p></w:body></w:document>',
      );
      return zip.generate({ type: 'nodebuffer' }) as Buffer;
    }
    const tep = () =>
      ({
        originalname: 'x.docx',
        buffer: docxGia(),
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }) as any;

    function dung(trangThaiHienTai = 'draft') {
      const prisma: any = {
        documentTemplate: {
          create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 't1', ...data })),
          update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 't1', ...data })),
          findFirst: jest.fn().mockResolvedValue({ id: 't1', code: 'A', status: trangThaiHienTai, variables: [] }),
        },
      };
      return { prisma, svc: new DocumentTemplatesService(prisma) };
    }

    it('tải mẫu mới lên thì nó là NHÁP, không tới tay cán bộ', async () => {
      const { prisma, svc } = dung();
      await svc.create(
        { code: 'A', name: 'A', entityType: 'DON_THU', category: 'Khác' } as any,
        tep(),
        'u1',
      );
      expect(prisma.documentTemplate.create.mock.calls[0][0].data.status).toBe('draft');
    });

    it('ban hành đưa nháp thành đang dùng', async () => {
      const { prisma, svc } = dung('draft');
      await svc.doiTrangThai('t1', 'active');
      expect(prisma.documentTemplate.update.mock.calls[0][0].data.status).toBe('active');
    });

    it('thu hồi đưa đang dùng thành đã thu hồi', async () => {
      const { prisma, svc } = dung('active');
      await svc.doiTrangThai('t1', 'archived');
      expect(prisma.documentTemplate.update.mock.calls[0][0].data.status).toBe('archived');
    });

    /** Thu hồi rồi ban hành lại được — nghỉ hưu một mẫu phải là việc hoàn tác được. */
    it('ban hành lại được mẫu đã thu hồi', async () => {
      const { prisma, svc } = dung('archived');
      await svc.doiTrangThai('t1', 'active');
      expect(prisma.documentTemplate.update.mock.calls[0][0].data.status).toBe('active');
    });

    it('chuyển sang chính trạng thái đang có thì từ chối', async () => {
      const { prisma, svc } = dung('active');
      await expect(svc.doiTrangThai('t1', 'active')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.documentTemplate.update).not.toHaveBeenCalled();
    });

    it('trạng thái lạ thì từ chối', async () => {
      const { prisma, svc } = dung('draft');
      await expect(svc.doiTrangThai('t1', 'bịa' as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.documentTemplate.update).not.toHaveBeenCalled();
    });

    it('mẫu không tồn tại thì báo rõ', async () => {
      const { prisma, svc } = dung();
      prisma.documentTemplate.findFirst.mockResolvedValue(null);
      await expect(svc.doiTrangThai('lung-tung', 'active')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
