import { Test, TestingModule } from '@nestjs/testing';
import { CrimesService } from './crimes.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  crime: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('CrimesService', () => {
  let service: CrimesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrimesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CrimesService>(CrimesService);
    jest.clearAllMocks();
    mockPrisma.crime.findMany.mockResolvedValue([]);
    mockPrisma.crime.count.mockResolvedValue(0);
  });

  describe('findAll', () => {
    it('mặc định chỉ trả tội danh PC02 + isActive', async () => {
      await service.findAll({});
      const where = mockPrisma.crime.findMany.mock.calls[0][0].where;
      expect(where.pc02Relevant).toBe(true);
      expect(where.isActive).toBe(true);
    });

    it('pc02Only=false → KHÔNG lọc pc02Relevant', async () => {
      await service.findAll({ pc02Only: false });
      const where = mockPrisma.crime.findMany.mock.calls[0][0].where;
      expect(where.pc02Relevant).toBeUndefined();
    });

    it('khi search → BỎ lọc pc02 (tìm trên toàn bộ) + OR code/name', async () => {
      await service.findAll({ search: 'giết' });
      const where = mockPrisma.crime.findMany.mock.calls[0][0].where;
      expect(where.pc02Relevant).toBeUndefined();
      expect(where.OR).toEqual([
        { code: { contains: 'giết', mode: 'insensitive' } },
        { name: { contains: 'giết', mode: 'insensitive' } },
      ]);
    });

    it('lọc theo chapter khi truyền', async () => {
      await service.findAll({ chapter: 'XIV', pc02Only: false });
      const where = mockPrisma.crime.findMany.mock.calls[0][0].where;
      expect(where.chapter).toBe('XIV');
    });

    it('sắp theo order asc và trả shape {data,total,limit,offset}', async () => {
      mockPrisma.crime.findMany.mockResolvedValue([{ code: 'D123' }]);
      mockPrisma.crime.count.mockResolvedValue(1);
      const res = await service.findAll({ limit: 10, offset: 0 });
      expect(mockPrisma.crime.findMany.mock.calls[0][0].orderBy).toEqual({
        order: 'asc',
      });
      expect(res).toEqual({ data: [{ code: 'D123' }], total: 1, limit: 10, offset: 0 });
    });
  });
});
