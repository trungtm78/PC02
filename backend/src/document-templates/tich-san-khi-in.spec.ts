import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';
import { DocumentTemplatesService } from './document-templates.service';
import { DynamicExportService } from './dynamic-export.service';

/**
 * Cờ "tích sẵn khi in" — mẫu nào được tích sẵn ở popup In chứng từ.
 *
 * ── Vì sao có cờ này ──
 *
 * Popup vốn tích sẵn MỌI mẫu đủ điều kiện. Đo trên máy thật 28/08/2026: Đơn thư có 14 mẫu đang
 * bật, nên mỗi lần bấm xuất là ra 14 tệp Word — trong đó có `Sổ đăng ký bào chữa (mẫu hệ cũ)`
 * vốn in ra tờ TRẮNG. Muốn lấy đúng một phiếu thì phải bỏ tích 13 lần.
 *
 * Cờ mặc định TẮT: popup mở ra trống, cán bộ tích đúng thứ cần; admin bật sẵn mẫu hay dùng.
 */
describe('Cờ tích sẵn khi in — DTO', () => {
  /**
   * Form gửi bằng multipart nên boolean tới dạng CHUỖI. `@Type(() => Boolean)` sai ở đây vì
   * `Boolean('false') === true` — chuỗi rỗng mới là false. Phải parse tường minh, đúng lối
   * `needsNumber` đã dùng.
   */
  it.each([
    ['true', true],
    [true, true],
    ['false', false],
    [false, false],
  ])('multipart `%p` → %p', (vao, ra) => {
    const dto = plainToInstance(CreateDocumentTemplateDto, {
      code: 'X',
      name: 'X',
      entityType: 'DON_THU',
      category: 'Khác',
      selectedByDefault: vao,
    });
    expect(validateSync(dto, { skipMissingProperties: true })).toHaveLength(0);
    expect(dto.selectedByDefault).toBe(ra);
  });

  it('không gửi thì để trống, không tự thành false', () => {
    const dto = plainToInstance(CreateDocumentTemplateDto, {
      code: 'X',
      name: 'X',
      entityType: 'DON_THU',
      category: 'Khác',
    });
    expect(dto.selectedByDefault).toBeUndefined();
  });

  /** DTO sửa kế thừa từ DTO tạo — khai một lần là có cả hai đường. */
  it('DTO sửa nhận được cờ', () => {
    const dto = plainToInstance(UpdateDocumentTemplateDto, { selectedByDefault: 'true' });
    expect(dto.selectedByDefault).toBe(true);
  });
});

describe('Cờ tích sẵn khi in — lưu và đọc', () => {
  function dungService() {
    const prisma: any = {
      documentTemplate: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 't1', ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 't1', ...data })),
        findFirst: jest.fn().mockResolvedValue({ id: 't1', variables: [] }),
      },
    };
    return { prisma, svc: new DocumentTemplatesService(prisma) };
  }

  const tepDocx = () => ({
    originalname: 'x.docx',
    buffer: docxGia(),
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }) as any;

  /** .docx tối thiểu để `create` bóc được biến mà không cần tệp thật trên đĩa. */
  function docxGia(): Buffer {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PizZip = require('pizzip');
    const zip = new PizZip();
    zip.file(
      'word/document.xml',
      '<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>{tenHoSo}</w:t></w:r></w:p></w:body></w:document>',
    );
    return zip.generate({ type: 'nodebuffer' }) as Buffer;
  }

  /**
   * Khối `create` liệt kê TƯỜNG MINH từng cột. Quên một dòng ở đó thì giá trị admin gửi bị nuốt
   * im lặng — form báo lưu thành công mà cột vẫn mang giá trị mặc định.
   */
  it('`create` ghi đúng cờ admin gửi', async () => {
    const { prisma, svc } = dungService();
    await svc.create(
      { code: 'A', name: 'A', entityType: 'DON_THU', category: 'Khác', selectedByDefault: true } as any,
      tepDocx(),
      'u1',
    );
    expect(prisma.documentTemplate.create.mock.calls[0][0].data.selectedByDefault).toBe(true);
  });

  it('`create` không gửi cờ thì mặc định TẮT', async () => {
    const { prisma, svc } = dungService();
    await svc.create(
      { code: 'A', name: 'A', entityType: 'DON_THU', category: 'Khác' } as any,
      tepDocx(),
      'u1',
    );
    expect(prisma.documentTemplate.create.mock.calls[0][0].data.selectedByDefault).toBe(false);
  });

  it('`update` đổi được cờ', async () => {
    const { prisma, svc } = dungService();
    await svc.update('t1', { selectedByDefault: true } as any);
    expect(prisma.documentTemplate.update.mock.calls[0][0].data.selectedByDefault).toBe(true);
  });
});

/**
 * CỔNG: bộ nạp của popup phải TRẢ VỀ cờ.
 *
 * Popup lấy mẫu qua `GET /:entity/export-templates` → `listExportableTemplates`, và hàm ấy dùng
 * một danh sách `select` VIẾT TAY. Thêm cột mà quên khai ở đó thì popup không bao giờ thấy cờ —
 * mọi ca kiểm khác vẫn xanh, admin bật công tắc mà popup không đổi gì.
 *
 * Đúng lớp lỗi đã trả giá ngày 28/08/2026: bản vá `${ten_ngan}` qua 3.781 ca kiểm và hai vòng
 * soát độc lập rồi lên máy thật KHÔNG có tác dụng, chỉ vì ba bộ nạp không khai cột.
 */
describe('Cổng: bộ nạp popup In chứng từ trả về cờ tích sẵn', () => {
  it('`listExportableTemplates` select có `selectedByDefault`', async () => {
    const prisma: any = { documentTemplate: { findMany: jest.fn().mockResolvedValue([]) } };
    const svc = new DynamicExportService(prisma, {} as any, {} as any);
    await svc.listExportableTemplates('DON_THU');
    const arg = prisma.documentTemplate.findMany.mock.calls[0][0];
    expect(arg.select.selectedByDefault).toBe(true);
  });
});
