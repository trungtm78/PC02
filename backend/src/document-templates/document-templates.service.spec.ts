import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';
import PizZip from 'pizzip';
import { DocumentTemplatesService } from './document-templates.service';
import { PrismaService } from '../prisma/prisma.service';

function docx(text: string): Buffer {
  const z = new PizZip();
  z.file('word/document.xml', `<w:body><w:t>${text}</w:t></w:body>`);
  return z.generate({ type: 'nodebuffer' });
}

const mockPrisma = {
  documentTemplate: {
    create: jest.fn((a: any) => Promise.resolve({ id: 't1', ...a.data })),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data })),
  },
};

describe('DocumentTemplatesService', () => {
  let svc: DocumentTemplatesService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [DocumentTemplatesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    svc = mod.get(DocumentTemplatesService);
    jest.clearAllMocks();
  });

  it('create: tính sha + phân loại biến (catalog=auto, ngoài catalog=manual) + lưu bytes + createdById', async () => {
    const buf = docx('Số {soVuAn} {hoTenBiCan}');
    await svc.create(
      { code: 'QD-KTVA', name: 'QĐ khởi tố', entityType: 'VU_AN', category: 'Quyết định' } as any,
      { buffer: buf, originalname: 'a.docx' },
      'u1',
    );
    const data = mockPrisma.documentTemplate.create.mock.calls[0][0].data;
    expect(data.fileSha).toBe(createHash('sha256').update(buf).digest('hex'));
    expect(data.variables).toEqual([
      // soVuAn thuộc catalog VU_AN → auto-điền; hoTenBiCan ngoài catalog → nhập tay.
      // required:false mặc định (admin bật sau qua update.requiredVariables) — PR2.
      { name: 'soVuAn', source: 'auto', label: 'soVuAn', required: false },
      { name: 'hoTenBiCan', source: 'manual', label: 'hoTenBiCan', required: false },
    ]);
    expect(data.createdById).toBe('u1');
    expect(data.fileBytes).toBe(buf);
  });

  it('create: needsNumber bật mà thiếu numberSeriesId → BadRequest (không lưu)', async () => {
    await expect(
      svc.create(
        { code: 'C', name: 'N', entityType: 'VU_AN', category: 'Khác', needsNumber: true } as any,
        { buffer: docx('x'), originalname: 'a.docx' },
        'u1',
      ),
    ).rejects.toThrow();
    expect(mockPrisma.documentTemplate.create).not.toHaveBeenCalled();
  });

  it('create: code trùng (P2002) → Conflict thân thiện', async () => {
    mockPrisma.documentTemplate.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(
      svc.create(
        { code: 'DUP', name: 'N', entityType: 'VU_AN', category: 'Khác' } as any,
        { buffer: docx('x'), originalname: 'a.docx' },
        'u1',
      ),
    ).rejects.toThrow(/đã tồn tại/);
  });

  it('list: lọc entityType + status, loại deletedAt, sort sortOrder asc', async () => {
    await svc.list({ entityType: 'VU_AN', status: 'active' });
    expect(mockPrisma.documentTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, entityType: 'VU_AN', status: 'active' },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  });

  it('[codex P2] create: buffer không phải docx hợp lệ → BadRequest (không lưu)', async () => {
    await expect(
      svc.create(
        { code: 'C', name: 'N', entityType: 'VU_AN', category: 'Khác' } as any,
        { buffer: Buffer.from('không phải docx'), originalname: 'fake.docx' },
        'u1',
      ),
    ).rejects.toThrow();
    expect(mockPrisma.documentTemplate.create).not.toHaveBeenCalled();
  });

  it('getById: không thấy → NotFound', async () => {
    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);
    await expect(svc.getById('x')).rejects.toThrow();
  });

  it('update: requiredVariables → set cờ required đúng biến, giữ name/source/label', async () => {
    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
      id: 't1',
      variables: [
        { name: 'tenVuAn', source: 'auto', label: 'Tên', required: false },
        { name: 'toiDanh', source: 'auto', label: 'Tội danh', required: true },
      ],
    });
    await svc.update('t1', { requiredVariables: ['tenVuAn'] } as any);
    const arg = mockPrisma.documentTemplate.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 't1' });
    expect(arg.data.variables).toEqual([
      { name: 'tenVuAn', source: 'auto', label: 'Tên', required: true },
      { name: 'toiDanh', source: 'auto', label: 'Tội danh', required: false },
    ]);
    // requiredVariables KHÔNG được spread thành cột Prisma.
    expect(arg.data.requiredVariables).toBeUndefined();
  });

  it('update: DON_THU + requiredVariables → BadRequest (readiness chỉ VU_AN/VU_VIEC)', async () => {
    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
      id: 'd1', entityType: 'DON_THU', variables: [{ name: 'x', source: 'manual', label: 'x' }],
    });
    await expect(svc.update('d1', { requiredVariables: ['x'] } as any)).rejects.toThrow();
  });

  it('softDelete: set deletedAt', async () => {
    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({ id: 't1' });
    await svc.softDelete('t1');
    const arg = mockPrisma.documentTemplate.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 't1' });
    expect(arg.data.deletedAt).toBeInstanceOf(Date);
  });
});
