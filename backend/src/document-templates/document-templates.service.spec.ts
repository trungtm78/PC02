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
    const buf = docx('Số {soVuAn} {khongCoTrongDanhMuc}');
    await svc.create(
      { code: 'QD-KTVA', name: 'QĐ khởi tố', entityType: 'VU_AN', category: 'Quyết định' } as any,
      { buffer: buf, originalname: 'a.docx' },
      'u1',
    );
    const data = mockPrisma.documentTemplate.create.mock.calls[0][0].data;
    expect(data.fileSha).toBe(createHash('sha256').update(buf).digest('hex'));
    expect(data.variables).toEqual([
      // soVuAn thuộc danh mục VU_AN → tự điền (field=name suy ra); tên ngoài danh mục → nhập tay.
      // required:false mặc định (admin bật sau qua update.requiredVariables) — PR2.
      //
      // Ví dụ trước đây dùng `hoTenBiCan` làm biến "ngoài danh mục", nhưng 28/08/2026 nó đã
      // thành khoá TỰ ĐIỀN (vụ án có bảng bị can), nên đổi sang một tên chắc chắn không có.
      { name: 'soVuAn', source: 'auto', label: 'soVuAn', field: 'soVuAn', required: false },
      { name: 'khongCoTrongDanhMuc', source: 'manual', label: 'khongCoTrongDanhMuc', required: false },
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

  it('update: DON_THU + requiredVariables → set required (đã bỏ chặn, Đơn thư vào hệ động)', async () => {
    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
      id: 'd1', entityType: 'DON_THU', variables: [{ name: 'x', source: 'manual', label: 'x' }],
    });
    await svc.update('d1', { requiredVariables: ['x'] } as any);
    const arg = mockPrisma.documentTemplate.update.mock.calls[0][0];
    expect(arg.data.variables).toEqual([{ name: 'x', source: 'manual', label: 'x', required: true }]);
  });

  it('create: delimiter tùy chỉnh [[ ]] + admin variables mapping → lưu đúng', async () => {
    await svc.create(
      {
        code: 'C', name: 'N', entityType: 'DON_THU', category: 'Khác',
        delimStart: '[[', delimEnd: ']]',
        variables: [{ name: 'Họ tên', source: 'auto', field: 'ghiTen' }],
      } as any,
      { buffer: docx('Kính gửi [[Họ tên]]'), originalname: 'a.docx' },
      'u1',
    );
    const data = mockPrisma.documentTemplate.create.mock.calls[0][0].data;
    expect(data.delimStart).toBe('[[');
    expect(data.delimEnd).toBe(']]');
    expect(data.variables).toEqual([
      { name: 'Họ tên', label: 'Họ tên', source: 'auto', field: 'ghiTen', required: false },
    ]);
  });

  it('create: admin map field NGOÀI catalog → BadRequest (whitelist)', async () => {
    await expect(
      svc.create(
        {
          code: 'C', name: 'N', entityType: 'DON_THU', category: 'Khác',
          variables: [{ name: 'x', source: 'auto', field: 'hackField' }],
        } as any,
        { buffer: docx('a {x}'), originalname: 'a.docx' },
        'u1',
      ),
    ).rejects.toThrow();
    expect(mockPrisma.documentTemplate.create).not.toHaveBeenCalled();
  });

  it('create: placeholder trong file bị bỏ khỏi variables → BadRequest', async () => {
    await expect(
      svc.create(
        {
          code: 'C', name: 'N', entityType: 'DON_THU', category: 'Khác',
          variables: [{ name: 'ghiTen', source: 'auto', field: 'ghiTen' }],
        } as any,
        { buffer: docx('{ghiTen} và {diaChi}'), originalname: 'a.docx' }, // diaChi bị bỏ
        'u1',
      ),
    ).rejects.toThrow();
  });

  it('create: variable không có trong file → BadRequest', async () => {
    await expect(
      svc.create(
        {
          code: 'C', name: 'N', entityType: 'DON_THU', category: 'Khác',
          variables: [{ name: 'ghiTen', source: 'auto', field: 'ghiTen' }, { name: 'khongCo', source: 'manual' }],
        } as any,
        { buffer: docx('{ghiTen}'), originalname: 'a.docx' },
        'u1',
      ),
    ).rejects.toThrow();
  });

  it('create: delimStart === delimEnd → BadRequest', async () => {
    await expect(
      svc.create(
        { code: 'C', name: 'N', entityType: 'VU_AN', category: 'Khác', delimStart: '|', delimEnd: '|' } as any,
        { buffer: docx('x'), originalname: 'a.docx' },
        'u1',
      ),
    ).rejects.toThrow();
  });

  it('replaceFile: giữ mapping cũ (label/required) cho biến trùng tên', async () => {
    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
      id: 't1', entityType: 'VU_AN', delimStart: '{', delimEnd: '}',
      variables: [{ name: 'soVuAn', source: 'auto', field: 'soVuAn', label: 'Số VA tuỳ chỉnh', required: true }],
    });
    await svc.replaceFile('t1', { buffer: docx('{soVuAn} {tenVuAn}'), originalname: 'b.docx' }, 'u1');
    const vars = mockPrisma.documentTemplate.update.mock.calls[0][0].data.variables;
    const soVuAn = vars.find((v: any) => v.name === 'soVuAn');
    expect(soVuAn).toMatchObject({ label: 'Số VA tuỳ chỉnh', required: true });
    // biến mới tenVuAn auto-suy
    expect(vars.find((v: any) => v.name === 'tenVuAn')).toMatchObject({ source: 'auto', field: 'tenVuAn' });
  });

  it('softDelete: set deletedAt', async () => {
    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({ id: 't1' });
    await svc.softDelete('t1');
    const arg = mockPrisma.documentTemplate.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 't1' });
    expect(arg.data.deletedAt).toBeInstanceOf(Date);
  });
});
