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

  it('create: tính sha + detect biến (source auto) + lưu bytes + createdById', async () => {
    const buf = docx('Số {soVuAn} {hoTenBiCan}');
    await svc.create(
      { code: 'QD-KTVA', name: 'QĐ khởi tố', entityType: 'VU_AN', category: 'Quyết định' } as any,
      { buffer: buf, originalname: 'a.docx' },
      'u1',
    );
    const data = mockPrisma.documentTemplate.create.mock.calls[0][0].data;
    expect(data.fileSha).toBe(createHash('sha256').update(buf).digest('hex'));
    expect(data.variables).toEqual([
      { name: 'soVuAn', source: 'auto', label: 'soVuAn' },
      { name: 'hoTenBiCan', source: 'auto', label: 'hoTenBiCan' },
    ]);
    expect(data.createdById).toBe('u1');
    expect(data.fileBytes).toBe(buf);
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

  it('getById: không thấy → NotFound', async () => {
    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);
    await expect(svc.getById('x')).rejects.toThrow();
  });

  it('softDelete: set deletedAt', async () => {
    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({ id: 't1' });
    await svc.softDelete('t1');
    const arg = mockPrisma.documentTemplate.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 't1' });
    expect(arg.data.deletedAt).toBeInstanceOf(Date);
  });
});
