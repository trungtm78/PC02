import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';

// Mock fs module
jest.mock('fs');

// Mock path module with specific implementations
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  extname: jest.fn((filename) => {
    const match = filename.match(/\.[^.]+$/);
    return match ? match[0] : '';
  }),
}));

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prismaService: PrismaService;
  let auditService: AuditService;

  const mockPrismaService = {
    document: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    case: {
      findFirst: jest.fn(),
    },
    incident: {
      findFirst: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    prismaService = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);

    // Clear mocks before each test
    jest.clearAllMocks();
  });

  describe('getList', () => {
    it('should return paginated list of documents', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Test Document',
          originalName: 'test.pdf',
          size: 1024,
          documentType: DocumentType.VAN_BAN,
          case: { id: 'case-1', name: 'Test Case' },
          uploadedBy: { id: 'user-1', fullName: 'Test User', username: 'testuser' },
        },
      ];

      mockPrismaService.document.findMany.mockResolvedValue(mockDocuments);
      mockPrismaService.document.count.mockResolvedValue(1);

      const result = await service.getList({
        limit: 20,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDocuments);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          take: 20,
          skip: 0,
        }),
      );
    });

    it('should filter documents by search query', async () => {
      const searchQuery = 'test';
      
      mockPrismaService.document.findMany.mockResolvedValue([]);
      mockPrismaService.document.count.mockResolvedValue(0);

      await service.getList({ search: searchQuery });

      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            OR: expect.arrayContaining([
              expect.objectContaining({ title: expect.any(Object) }),
              expect.objectContaining({ description: expect.any(Object) }),
              expect.objectContaining({ originalName: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });

    it('should filter documents by caseId', async () => {
      const caseId = 'case-123';
      
      mockPrismaService.document.findMany.mockResolvedValue([]);
      mockPrismaService.document.count.mockResolvedValue(0);

      await service.getList({ caseId });

      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            caseId,
          }),
        }),
      );
    });

    it('should filter documents by documentType', async () => {
      mockPrismaService.document.findMany.mockResolvedValue([]);
      mockPrismaService.document.count.mockResolvedValue(0);

      await service.getList({ documentType: DocumentType.HINH_ANH });

      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            documentType: DocumentType.HINH_ANH,
          }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('should return document by id', async () => {
      const mockDocument = {
        id: 'doc-1',
        title: 'Test Document',
        originalName: 'test.pdf',
        case: { id: 'case-1', name: 'Test Case' },
        incident: null,
        uploadedBy: { id: 'user-1', fullName: 'Test User', username: 'testuser' },
      };

      mockPrismaService.document.findFirst.mockResolvedValue(mockDocument);

      const result = await service.getById('doc-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDocument);
    });

    it('should throw NotFoundException for non-existent document', async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(null);

      await expect(service.getById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const validDto = {
      title: 'Test Document',
      description: 'Test Description',
      documentType: DocumentType.VAN_BAN,
      caseId: 'case-1',
      incidentId: undefined,
      fileName: '1234567890-abcdef.pdf',
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      filePath: '/uploads/documents/1234567890-abcdef.pdf',
    };

    it('should create document successfully', async () => {
      const mockCase = { id: 'case-1', name: 'Test Case' };
      const mockCreatedDoc = {
        id: 'doc-1',
        ...validDto,
        case: mockCase,
        incident: null,
        uploadedBy: { id: 'user-1', fullName: 'Test User', username: 'testuser' },
      };

      mockPrismaService.case.findFirst.mockResolvedValue(mockCase);
      mockPrismaService.document.create.mockResolvedValue(mockCreatedDoc);

      const result = await service.create(validDto, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedDoc);
      expect(result.message).toBe('Upload tài liệu thành công');
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException when caseId does not exist', async () => {
      mockPrismaService.case.findFirst.mockResolvedValue(null);

      await expect(service.create(validDto, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when incidentId does not exist', async () => {
      const dtoWithIncident = { ...validDto, incidentId: 'non-existent' };
      mockPrismaService.case.findFirst.mockResolvedValue({ id: 'case-1' });
      mockPrismaService.incident.findFirst.mockResolvedValue(null);

      await expect(service.create(dtoWithIncident, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file info is missing', async () => {
      const invalidDto = { ...validDto, fileName: undefined };

      await expect(service.create(invalidDto as any, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should create document without caseId', async () => {
      const dtoWithoutCase = { ...validDto, caseId: undefined };
      const mockCreatedDoc = {
        id: 'doc-1',
        ...dtoWithoutCase,
        case: null,
        incident: null,
        uploadedBy: { id: 'user-1', fullName: 'Test User', username: 'testuser' },
      };

      mockPrismaService.document.create.mockResolvedValue(mockCreatedDoc);

      const result = await service.create(dtoWithoutCase, 'user-1');

      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    const existingDoc = {
      id: 'doc-1',
      title: 'Old Title',
      caseId: 'case-1',
      incidentId: null,
      deletedAt: null,
    };

    it('should update document successfully', async () => {
      const updateDto = { title: 'New Title' };
      const mockUpdatedDoc = {
        ...existingDoc,
        ...updateDto,
        case: { id: 'case-1', name: 'Test Case' },
        incident: null,
        uploadedBy: { id: 'user-1', fullName: 'Test User', username: 'testuser' },
      };

      mockPrismaService.document.findFirst.mockResolvedValue(existingDoc);
      mockPrismaService.document.update.mockResolvedValue(mockUpdatedDoc);

      const result = await service.update('doc-1', updateDto, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('New Title');
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent document', async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(null);

      await expect(service.update('non-existent', { title: 'New' }, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should validate new caseId when provided', async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(existingDoc);
      mockPrismaService.case.findFirst.mockResolvedValue(null);

      await expect(service.update('doc-1', { caseId: 'invalid-case' }, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate new incidentId when provided', async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(existingDoc);
      mockPrismaService.case.findFirst.mockResolvedValue({ id: 'case-1' });
      mockPrismaService.incident.findFirst.mockResolvedValue(null);

      await expect(
        service.update('doc-1', { incidentId: 'invalid-incident' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow clearing caseId by setting to empty string', async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(existingDoc);
      mockPrismaService.document.update.mockResolvedValue({
        ...existingDoc,
        caseId: null,
        case: null,
      });

      const result = await service.update('doc-1', { caseId: '' }, 'user-1');

      expect(result.success).toBe(true);
    });
  });

  describe('delete', () => {
    it('should soft delete document successfully', async () => {
      const existingDoc = {
        id: 'doc-1',
        title: 'Test Document',
        originalName: 'test.pdf',
        deletedAt: null,
      };

      mockPrismaService.document.findFirst.mockResolvedValue(existingDoc);
      mockPrismaService.document.update.mockResolvedValue({ ...existingDoc, deletedAt: new Date() });

      const result = await service.delete('doc-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Xóa tài liệu thành công');
      expect(mockPrismaService.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent document', async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(null);

      await expect(service.delete('non-existent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDownloadInfo', () => {
    it('should return download info for existing file', async () => {
      const mockDocument = {
        id: 'doc-1',
        fileName: '1234567890-abcdef.pdf',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        deletedAt: null,
      };

      mockPrismaService.document.findFirst.mockResolvedValue(mockDocument);

      // Mock fs.existsSync to return true
      const fs = require('fs');
      fs.existsSync = jest.fn().mockReturnValue(true);

      const result = await service.getDownloadInfo('doc-1');

      expect(result.success).toBe(true);
      expect(result.data.originalName).toBe('test.pdf');
      expect(result.data.mimeType).toBe('application/pdf');
    });

    it('should throw NotFoundException for non-existent document', async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(null);

      await expect(service.getDownloadInfo('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when file not found on disk', async () => {
      const mockDocument = {
        id: 'doc-1',
        fileName: 'missing.pdf',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        deletedAt: null,
      };

      mockPrismaService.document.findFirst.mockResolvedValue(mockDocument);

      // Mock fs.existsSync to return false
      const fs = require('fs');
      fs.existsSync = jest.fn().mockReturnValue(false);

      await expect(service.getDownloadInfo('doc-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateFileName', () => {
    it('should generate unique filename with timestamp and random', () => {
      const originalName = 'document.pdf';
      const fileName = service.generateFileName(originalName);

      expect(fileName).toMatch(/^\d+-[a-z0-9]+\.pdf$/);
      expect(fileName).not.toBe(originalName);
    });

    it('should preserve file extension', () => {
      const testCases = [
        { input: 'file.pdf', ext: '.pdf' },
        { input: 'image.jpg', ext: '.jpg' },
        { input: 'document.docx', ext: '.docx' },
      ];

      testCases.forEach(({ input, ext }) => {
        const fileName = service.generateFileName(input);
        expect(fileName.endsWith(ext)).toBe(true);
      });
    });
  });
});
