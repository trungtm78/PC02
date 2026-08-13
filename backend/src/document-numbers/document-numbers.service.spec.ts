import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
// `?raw` không có ở jest; đọc package.json qua require để kiểm tên script thật.
const pkgJson: string = JSON.stringify(
  jest.requireActual('../../package.json'),
);
import { DocumentNumbersService } from './document-numbers.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ResolutionContext } from './types';

const TEMPLATE_ID = 'tpl-001';
const USER_ID = 'user-001';

const mockTemplate = {
  id: TEMPLATE_ID,
  name: 'Mã vụ việc',
  documentType: 'INCIDENT',
  isActive: true,
  separator: '-',
  inputMode: 'AUTO',
  segments: [
    { type: 'LITERAL', value: 'VV' },
    { type: 'FORMULA', fn: 'FORMAT', source: 'NOW', pattern: 'YYYY' },
    { type: 'COUNTER' },
  ],
  counterConfig: {
    resetPeriod: 'YEARLY',
    minValue: 1,
    maxValue: 99999,
    padding: 5,
  },
};

const mockPrisma = {
  documentNumberTemplate: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  documentNumberCounter: {
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  documentNumberLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
  // v0.66.2 defensive drift check uses queryRawUnsafe.
  $queryRawUnsafe: jest.fn().mockResolvedValue([{ max_suffix: 0 }]),
} as any;

const ctx: ResolutionContext = {
  userId: USER_ID,
  workId: 'CB-042',
};

describe('DocumentNumbersService', () => {
  let service: DocumentNumbersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentNumbersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DocumentNumbersService>(DocumentNumbersService);
    jest.clearAllMocks();
  });

  describe('draft()', () => {
    it('returns preview number without acquiring lock', async () => {
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrisma.documentNumberCounter.findUnique.mockResolvedValue({
        currentValue: 5,
      });
      mockPrisma.documentNumberLog.create.mockResolvedValue({ id: 'log-001' });

      const result = await service.draft('INCIDENT', ctx);

      expect(result.previewNumber).toMatch(/^VV-\d{4}-\d{5}$/);
      expect(result.isDraft).toBe(true);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns next = 1 when no counter exists yet (cold start)', async () => {
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrisma.documentNumberCounter.findUnique.mockResolvedValue(null);
      mockPrisma.documentNumberLog.create.mockResolvedValue({ id: 'log-001' });

      const result = await service.draft('INCIDENT', ctx);
      expect(result.previewNumber).toMatch(/^VV-\d{4}-00001$/);
    });

    it('reports missing config as 503 with the fix, not 404', async () => {
      // ND-28. Trước đây là 404 kèm câu tiếng Anh. Cả ba nơi gọi đều đang SINH
      // SỐ ĐỂ TẠO hồ sơ, nên 404 nói rằng thứ đang tạo không tồn tại — vô
      // nghĩa. Cái thiếu là cấu hình hệ thống. Người vận hành gặp lỗi này lúc
      // dựng máy mới, nên thông điệp phải nói ra cách sửa.
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(null);

      await expect(service.draft('INCIDENT', ctx)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await expect(service.draft('INCIDENT', ctx)).rejects.toThrow(
        /npm run db:seed:doc-templates/,
      );
    });

    it('gọi đúng tên script seed có thật trong package.json', () => {
      // Một chỉ dẫn sai còn tệ hơn không chỉ dẫn: người vận hành gõ theo rồi
      // nhận "Missing script". Tên đúng là `db:seed:doc-templates`, KHÔNG phải
      // `db:seed:document-templates` như tên file gợi ý.
      const scripts = (
        JSON.parse(pkgJson) as { scripts: Record<string, string> }
      ).scripts;
      expect(scripts).toHaveProperty('db:seed:doc-templates');
    });
  });

  describe('commit()', () => {
    it('runs inside a transaction with FOR UPDATE lock', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn(mockPrisma),
      );
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'counter-001' }]);
      mockPrisma.documentNumberCounter.findUnique.mockResolvedValue({
        currentValue: 5,
      });
      mockPrisma.documentNumberCounter.update.mockResolvedValue({
        currentValue: 6,
      });
      mockPrisma.documentNumberLog.create.mockResolvedValue({ id: 'log-001' });

      const result = await service.commit('INCIDENT', ctx);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1); // cold-start upsert
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1); // FOR UPDATE
      expect(result.number).toMatch(/^VV-\d{4}-\d{5}$/);
      expect(result.logId).toBe('log-001');
    });

    it('returns changed=true when final number differs from draft preview', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn(mockPrisma),
      );
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'counter-001' }]);
      mockPrisma.documentNumberCounter.findUnique.mockResolvedValue({
        currentValue: 99,
      });
      mockPrisma.documentNumberCounter.update.mockResolvedValue({
        currentValue: 100,
      });
      mockPrisma.documentNumberLog.create.mockResolvedValue({ id: 'log-002' });

      const result = await service.commit('INCIDENT', ctx, {
        draftPreview: 'VV-2026-00005',
      });
      expect(result.changed).toBe(true);
    });

    it('returns changed=false when final number matches draft preview', async () => {
      const year = new Date().getUTCFullYear();
      const expectedNumber = `VV-${year}-00006`;

      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn(mockPrisma),
      );
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'counter-001' }]);
      mockPrisma.documentNumberCounter.findUnique.mockResolvedValue({
        currentValue: 5,
      });
      mockPrisma.documentNumberCounter.update.mockResolvedValue({
        currentValue: 6,
      });
      mockPrisma.documentNumberLog.create.mockResolvedValue({ id: 'log-003' });

      const result = await service.commit('INCIDENT', ctx, {
        draftPreview: expectedNumber,
      });
      expect(result.changed).toBe(false);
    });

    it('throws when counter exceeds maxValue and resetPeriod is not MAX_NUMBER', async () => {
      const cappedTemplate = {
        ...mockTemplate,
        counterConfig: {
          resetPeriod: 'YEARLY',
          minValue: 1,
          maxValue: 5,
          padding: 5,
        },
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn(mockPrisma),
      );
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        cappedTemplate,
      );
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'counter-001' }]);
      mockPrisma.documentNumberCounter.findUnique.mockResolvedValue({
        currentValue: 5,
      });

      await expect(service.commit('INCIDENT', ctx)).rejects.toThrow(
        'Đã hết số trong kỳ này',
      );
    });

    it('wraps counter back to minValue when resetPeriod is MAX_NUMBER', async () => {
      const wrapTemplate = {
        ...mockTemplate,
        counterConfig: {
          resetPeriod: 'MAX_NUMBER',
          minValue: 1,
          maxValue: 5,
          padding: 5,
        },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn(mockPrisma),
      );
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        wrapTemplate,
      );
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'counter-001' }]);
      mockPrisma.documentNumberCounter.findUnique.mockResolvedValue({
        currentValue: 5,
      });
      mockPrisma.documentNumberCounter.update.mockResolvedValue({
        currentValue: 1,
      });
      mockPrisma.documentNumberLog.create.mockResolvedValue({ id: 'log-wrap' });

      const result = await service.commit('INCIDENT', ctx);

      expect(mockPrisma.documentNumberCounter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentValue: 1 }),
        }),
      );
      expect(result.number).toMatch(/^VV-\d{4}-00001$/);
    });
  });

  describe('preview()', () => {
    it('returns preview number without creating a log entry', async () => {
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrisma.documentNumberCounter.findUnique.mockResolvedValue({
        currentValue: 10,
      });

      const result = await service.preview(TEMPLATE_ID, ctx);

      expect(result.previewNumber).toMatch(/^VV-\d{4}-\d{5}$/);
      expect(mockPrisma.documentNumberLog.create).not.toHaveBeenCalled();
    });
  });

  describe('updateLogDocumentId()', () => {
    it('updates log record with documentId', async () => {
      mockPrisma.documentNumberLog.update.mockResolvedValue({ id: 'log-001' });

      await service.updateLogDocumentId('log-001', 'doc-001');

      expect(mockPrisma.documentNumberLog.update).toHaveBeenCalledWith({
        where: { id: 'log-001' },
        data: { documentId: 'doc-001' },
      });
    });
  });

  describe('commitWithTx()', () => {
    it('uses passed tx and does NOT call this.prisma.$transaction', async () => {
      const mockTx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'counter-001' }]),
        documentNumberCounter: {
          findUnique: jest.fn().mockResolvedValue({ currentValue: 5 }),
          update: jest.fn().mockResolvedValue({ currentValue: 6 }),
        },
        documentNumberLog: {
          create: jest.fn().mockResolvedValue({ id: 'log-tx-001' }),
        },
      };
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );

      const result = await service.commitWithTx('INCIDENT', ctx, mockTx);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
      // v0.66.2: 2 calls = FOR UPDATE lock + drift-check max(code) query.
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(result.number).toMatch(/^VV-\d{4}-\d{5}$/);
      expect(result.logId).toBe('log-tx-001');
    });

    it('creates log with documentId when provided in options', async () => {
      const mockTx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'counter-001' }]),
        documentNumberCounter: {
          findUnique: jest.fn().mockResolvedValue({ currentValue: 2 }),
          update: jest.fn().mockResolvedValue({ currentValue: 3 }),
        },
        documentNumberLog: {
          create: jest.fn().mockResolvedValue({ id: 'log-tx-002' }),
        },
      };
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );

      await service.commitWithTx('INCIDENT', ctx, mockTx, {
        documentId: 'doc-abc',
      });

      expect(mockTx.documentNumberLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ documentId: 'doc-abc' }),
        }),
      );
    });

    it('returns changed=true when final number differs from draftPreview', async () => {
      const mockTx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'counter-001' }]),
        documentNumberCounter: {
          findUnique: jest.fn().mockResolvedValue({ currentValue: 99 }),
          update: jest.fn().mockResolvedValue({ currentValue: 100 }),
        },
        documentNumberLog: {
          create: jest.fn().mockResolvedValue({ id: 'log-tx-003' }),
        },
      };
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );

      const result = await service.commitWithTx('INCIDENT', ctx, mockTx, {
        draftPreview: 'VV-2026-00005',
      });
      expect(result.changed).toBe(true);
    });

    it('throws when counter exceeds maxValue and resetPeriod is not MAX_NUMBER', async () => {
      const cappedTemplate = {
        ...mockTemplate,
        counterConfig: {
          resetPeriod: 'YEARLY',
          minValue: 1,
          maxValue: 5,
          padding: 5,
        },
      };
      const mockTx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'counter-001' }]),
        documentNumberCounter: {
          findUnique: jest.fn().mockResolvedValue({ currentValue: 5 }),
          update: jest.fn(),
        },
        documentNumberLog: { create: jest.fn() },
      };
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        cappedTemplate,
      );

      await expect(
        service.commitWithTx('INCIDENT', ctx, mockTx),
      ).rejects.toThrow('Đã hết số trong kỳ này');
    });

    it('wraps counter back to minValue when resetPeriod is MAX_NUMBER', async () => {
      const wrapTemplate = {
        ...mockTemplate,
        counterConfig: {
          resetPeriod: 'MAX_NUMBER',
          minValue: 1,
          maxValue: 5,
          padding: 5,
        },
      };
      const mockTx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'counter-001' }]),
        documentNumberCounter: {
          findUnique: jest.fn().mockResolvedValue({ currentValue: 5 }),
          update: jest.fn().mockResolvedValue({ currentValue: 1 }),
        },
        documentNumberLog: {
          create: jest.fn().mockResolvedValue({ id: 'log-wrap-tx' }),
        },
      };
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        wrapTemplate,
      );

      const result = await service.commitWithTx('INCIDENT', ctx, mockTx);

      expect(mockTx.documentNumberCounter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentValue: 1 }),
        }),
      );
      expect(result.number).toMatch(/^VV-\d{4}-00001$/);
    });

    it('throws ServiceUnavailableException when no active template found', async () => {
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(null);
      const mockTx = {
        $executeRaw: jest.fn(),
        $queryRaw: jest.fn(),
        documentNumberCounter: {},
        documentNumberLog: {},
      };

      await expect(
        service.commitWithTx('INCIDENT', ctx, mockTx),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('v0.66.2 drift fix: bumps nextValue past DB max when counter is behind', async () => {
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      const mockTx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest
          .fn()
          // 1st call: FOR UPDATE lock
          .mockResolvedValueOnce([{ id: 'counter-001' }])
          // 2nd call: drift check returns 145 (DB ahead)
          .mockResolvedValueOnce([{ max_suffix: 145 }]),
        documentNumberCounter: {
          findUnique: jest.fn().mockResolvedValue({ currentValue: 124 }),
          update: jest.fn().mockResolvedValue({ currentValue: 146 }),
        },
        documentNumberLog: {
          create: jest.fn().mockResolvedValue({ id: 'log-drift-001' }),
        },
      };

      const result = await service.commitWithTx('INCIDENT', ctx, mockTx);

      // Counter should be bumped to 146 (DB max 145 + 1), not 125 (counter 124 + 1).
      expect(mockTx.documentNumberCounter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentValue: 146 }),
        }),
      );
      expect(result.number).toMatch(/^VV-\d{4}-00146$/);
    });

    it('v0.66.2 drift fix PETITION: bumps nextValue past DB max for petitions table', async () => {
      const petitionTemplate = {
        ...mockTemplate,
        documentType: 'PETITION',
        segments: [
          { type: 'LITERAL', value: 'DT' },
          { type: 'FORMULA', fn: 'FORMAT', source: 'NOW', pattern: 'YYYY' },
          { type: 'COUNTER' },
        ],
      };
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        petitionTemplate,
      );
      const mockTx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest
          .fn()
          // 1st call: FOR UPDATE lock
          .mockResolvedValueOnce([{ id: 'counter-001' }])
          // 2nd call: petition drift check (stt FROM petitions) returns 199
          .mockResolvedValueOnce([{ max_suffix: 199 }]),
        documentNumberCounter: {
          findUnique: jest.fn().mockResolvedValue({ currentValue: 0 }),
          update: jest.fn().mockResolvedValue({ currentValue: 200 }),
        },
        documentNumberLog: {
          create: jest.fn().mockResolvedValue({ id: 'log-petition-drift-001' }),
        },
      };

      const result = await service.commitWithTx('PETITION', ctx, mockTx);

      // Counter phải được bump tới 200 (DB max 199 + 1), không phải 1 (counter 0 + 1)
      expect(mockTx.documentNumberCounter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentValue: 200 }),
        }),
      );
      expect(result.number).toMatch(/^DT-\d{4}-00200$/);
    });
  });

  describe('getTemplates()', () => {
    it('returns all templates ordered by creation date descending', async () => {
      mockPrisma.documentNumberTemplate.findMany.mockResolvedValue([
        mockTemplate,
      ]);

      const result = await service.getTemplates();

      expect(result).toHaveLength(1);
      expect(mockPrisma.documentNumberTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('createTemplate()', () => {
    it('persists template with createdById from userId param', async () => {
      const dto = {
        name: 'Mã vụ việc',
        documentType: 'INCIDENT',
        segments: mockTemplate.segments,
        counterConfig: mockTemplate.counterConfig,
      };
      const created = { id: 'new-tpl', ...dto, createdById: USER_ID };
      mockPrisma.documentNumberTemplate.create.mockResolvedValue(created);

      const result = await service.createTemplate(dto as any, USER_ID);

      expect(result.id).toBe('new-tpl');
      expect(mockPrisma.documentNumberTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ createdById: USER_ID }),
      });
    });
  });

  describe('updateTemplate()', () => {
    it('updates template fields by id', async () => {
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrisma.documentNumberTemplate.update.mockResolvedValue({
        ...mockTemplate,
        name: 'Updated',
      });

      const result = await service.updateTemplate(TEMPLATE_ID, {
        name: 'Updated',
      } as any);

      expect(result.name).toBe('Updated');
      expect(mockPrisma.documentNumberTemplate.update).toHaveBeenCalledWith({
        where: { id: TEMPLATE_ID },
        data: { name: 'Updated' },
      });
    });

    it('throws NotFoundException when template does not exist', async () => {
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTemplate('no-such-id', {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTemplate()', () => {
    it('deletes template by id', async () => {
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrisma.documentNumberTemplate.delete.mockResolvedValue(mockTemplate);

      await service.deleteTemplate(TEMPLATE_ID);

      expect(mockPrisma.documentNumberTemplate.delete).toHaveBeenCalledWith({
        where: { id: TEMPLATE_ID },
      });
    });

    it('throws NotFoundException when template does not exist', async () => {
      mockPrisma.documentNumberTemplate.findFirst.mockResolvedValue(null);

      await expect(service.deleteTemplate('no-such-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getLogs()', () => {
    it('returns paginated log entries with total count', async () => {
      mockPrisma.documentNumberLog.findMany.mockResolvedValue([]);
      mockPrisma.documentNumberLog.count.mockResolvedValue(0);

      const result = await service.getLogs({ page: 1, pageSize: 20 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total', 0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('filters by templateId when provided', async () => {
      mockPrisma.documentNumberLog.findMany.mockResolvedValue([]);
      mockPrisma.documentNumberLog.count.mockResolvedValue(0);

      await service.getLogs({ templateId: TEMPLATE_ID, page: 1, pageSize: 10 });

      expect(mockPrisma.documentNumberLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ templateId: TEMPLATE_ID }),
        }),
      );
    });

    it('filters by date range when fromDate and toDate provided', async () => {
      const from = new Date('2026-01-01');
      const to = new Date('2026-12-31');
      mockPrisma.documentNumberLog.findMany.mockResolvedValue([]);
      mockPrisma.documentNumberLog.count.mockResolvedValue(0);

      await service.getLogs({
        fromDate: from,
        toDate: to,
        page: 1,
        pageSize: 20,
      });

      expect(mockPrisma.documentNumberLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: from, lte: to },
          }),
        }),
      );
    });
  });
});
