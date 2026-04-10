import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MasterClassService } from './master-class.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const mockPrisma = {
  masterClass: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

const FAKE = {
  id: 'mc-001',
  type: '00',
  code: 'NAM',
  name: 'Nam',
  order: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('MasterClassService', () => {
  let service: MasterClassService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterClassService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(MasterClassService);
    jest.clearAllMocks();
  });

  describe('getTypes', () => {
    it('trả về 9 type codes', () => {
      const result = service.getTypes();
      expect(result.data).toHaveLength(9);
      expect(result.data[0]).toEqual({ code: '00', name: 'Giới tính' });
    });
  });

  describe('getList', () => {
    it('trả về danh sách với filter type', async () => {
      mockPrisma.masterClass.findMany.mockResolvedValue([FAKE]);
      mockPrisma.masterClass.count.mockResolvedValue(1);

      const result = await service.getList({ type: '00' });

      expect(result.data).toEqual([FAKE]);
      expect(result.total).toBe(1);
      expect(mockPrisma.masterClass.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: '00' } }),
      );
    });

    it('search theo code hoặc name', async () => {
      mockPrisma.masterClass.findMany.mockResolvedValue([]);
      mockPrisma.masterClass.count.mockResolvedValue(0);

      await service.getList({ search: 'Nam' });

      expect(mockPrisma.masterClass.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { code: { contains: 'Nam', mode: 'insensitive' } },
              { name: { contains: 'Nam', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('trả về bản ghi khi tìm thấy', async () => {
      mockPrisma.masterClass.findUnique.mockResolvedValue(FAKE);
      const result = await service.getById('mc-001');
      expect(result.data).toEqual(FAKE);
    });

    it('throw NotFoundException khi không tìm thấy', async () => {
      mockPrisma.masterClass.findUnique.mockResolvedValue(null);
      await expect(service.getById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('tạo thành công', async () => {
      mockPrisma.masterClass.findUnique.mockResolvedValue(null);
      mockPrisma.masterClass.create.mockResolvedValue(FAKE);

      const result = await service.create(
        { type: '00', code: 'NAM', name: 'Nam' },
        'user-1',
      );

      expect(result.data).toEqual(FAKE);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MASTER_CLASS_CREATED' }),
      );
    });

    it('throw ConflictException khi trùng type+code', async () => {
      mockPrisma.masterClass.findUnique.mockResolvedValue(FAKE);

      await expect(
        service.create({ type: '00', code: 'NAM', name: 'Nam' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throw BadRequestException khi type không hợp lệ', async () => {
      await expect(
        service.create({ type: '99', code: 'X', name: 'X' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('cập nhật thành công', async () => {
      mockPrisma.masterClass.findUnique.mockResolvedValue(FAKE);
      mockPrisma.masterClass.update.mockResolvedValue({ ...FAKE, name: 'Nam giới' });

      const result = await service.update('mc-001', { name: 'Nam giới' }, 'user-1');

      expect(result.data.name).toBe('Nam giới');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MASTER_CLASS_UPDATED' }),
      );
    });

    it('throw NotFoundException khi không tìm thấy', async () => {
      mockPrisma.masterClass.findUnique.mockResolvedValue(null);
      await expect(service.update('bad', { name: 'X' }, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throw ConflictException khi đổi code bị trùng', async () => {
      mockPrisma.masterClass.findUnique
        .mockResolvedValueOnce(FAKE)
        .mockResolvedValueOnce({ ...FAKE, id: 'mc-999' });

      await expect(
        service.update('mc-001', { code: 'NU' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('xóa thành công', async () => {
      mockPrisma.masterClass.findUnique.mockResolvedValue(FAKE);
      mockPrisma.masterClass.delete.mockResolvedValue(FAKE);

      const result = await service.delete('mc-001', 'user-1');

      expect(result.message).toContain('thành công');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MASTER_CLASS_DELETED' }),
      );
    });

    it('throw NotFoundException khi không tìm thấy', async () => {
      mockPrisma.masterClass.findUnique.mockResolvedValue(null);
      await expect(service.delete('bad', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
