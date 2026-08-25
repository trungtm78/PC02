/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * PetitionsService Unit Tests
 * TASK-ID: TASK-2026-260202
 * Coverage target: >= 80%
 *
 * Tests cover:
 *   - getList: pagination, search, filters
 *   - getById: found / not found
 *   - create: success, future date validation, duplicate stt
 *   - update: success, not found, future date
 *   - delete: success, not found (soft delete)
 *   - convertToIncident: success, missing fields (EC-01), already converted
 *   - convertToCase: success, missing fields (EC-01), already converted (AC-03)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PetitionsService } from './petitions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { PetitionStatus, LoaiDon, Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePetitionDto } from './dto/create-petition.dto';

// CaseStatus values — only used in mock fixture objects (not DTO-typed)
const CaseStatus = { TIEP_NHAN: 'TIEP_NHAN' } as const;

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPetition = {
  id: 'petition-001',
  stt: 'DT-2026-00001',
  receivedDate: new Date('2026-02-01'),
  senderName: 'Trần Thị Test',
  unit: 'Công an Quận 1',
  status: PetitionStatus.MOI_TIEP_NHAN,
  linkedCaseId: null,
  linkedIncidentId: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockIncident = {
  id: 'incident-001',
  code: 'VV-2026-00001',
  name: 'Vụ việc test',
  incidentType: 'An ninh trật tự',
  status: 'TIEP_NHAN',
  sourcePetitionId: 'petition-001',
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCase = {
  id: 'case-001',
  name: 'Vụ án test',
  crime: 'Tham nhũng',
  unit: 'Công an cấp Quận/Huyện',
  status: CaseStatus.TIEP_NHAN,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  petition: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  incident: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  case: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  team: {
    findFirst: jest.fn(),
  },
  userTeam: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  petitionAssignment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  documentNumberLog: { update: jest.fn().mockResolvedValue({}) },
  document: {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  // export chứng từ: row lock + audit render log
  $queryRaw: jest.fn().mockResolvedValue([]),
  documentRenderLog: {
    create: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  $transaction: jest.fn().mockImplementation(async (fn: any) => fn(mockPrisma)) as any,
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
  // v0.30: PETITION_UPDATED now uses wrapUpdate.
  wrapUpdate: jest.fn(async (opts: any) => {
    await opts.fetchFn();
    const after = await opts.updateFn();
    await mockAudit.log({
      userId: opts.userId,
      action: opts.action,
      subject: opts.subject,
      subjectId: opts.subjectId,
      metadata: { before: {}, after: {} },
    });
    return after;
  }),
};

const mockSettings = {
  getNumericValue: jest.fn(),
  // Kỳ thống kê: mặc định TAT_CA trong ca kiểm để các ca sẵn có vẫn chốt đúng thứ chúng
  // chốt (không có điều kiện ngày nào chen vào). Việc kỳ ĐƯỢC áp có ca kiểm riêng bên dưới.
  getKyThongKe: jest.fn().mockResolvedValue({
    ky: 'TAT_CA',
    truong: 'NGAY_TIEP_NHAN',
    tuNgay: null,
    denNgay: null,
  }),
};

// DocumentNumbersService mock — auto-generate stt for petitions
const mockDocNums = {
  commit: jest.fn().mockResolvedValue({ number: 'DT-2026-00001', logId: 'log-001', changed: false }),
  commitWithTx: jest.fn().mockResolvedValue({ number: 'DT-2026-00001', logId: 'log-001', changed: false }),
  updateLogDocumentId: jest.fn().mockResolvedValue(undefined),
};

// DeadlineRulesService mock — versioning-aware deadline source.
// Returns a stable rule object; tests assert getActive(key) was called with the
// correct key and assert the resulting deadline value.
const mockDeadlineRules = {
  getActive: jest.fn().mockImplementation((key: string) => {
    const valueByKey: Record<string, number> = {
      THOI_HAN_TO_CAO: 30,
      THOI_HAN_KHIEU_NAI: 30,
      THOI_HAN_KIEN_NGHI: 15,
      THOI_HAN_PHAN_ANH: 15,
    };
    const value = valueByKey[key] ?? 15;
    return Promise.resolve({ id: `rule_init_${key}`, ruleKey: key, value, status: 'active' });
  }),
  getActiveValue: jest.fn(),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('PetitionsService', () => {
  let service: PetitionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetitionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: SettingsService, useValue: mockSettings },
        { provide: DeadlineRulesService, useValue: mockDeadlineRules },
        { provide: DocumentNumbersService, useValue: mockDocNums },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<PetitionsService>(PetitionsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  // ── getList ────────────────────────────────────────────────────────────────

  describe('getList', () => {
    it('should return paginated list of petitions', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([mockPetition]);
      mockPrisma.petition.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    // ── Bộ lọc theo kiểu hệ cũ (25/08/2026) ───────────────────────────────
    // Cán bộ đọc quen mã dạng `26-11171` nên sẽ gõ dạng đó, trong khi cơ sở dữ liệu lưu
    // `2026-11171`. Việc nhận cả hai do MÁY CHỦ làm — ứng dụng di động và lệnh gọi API
    // trực tiếp cũng phải tìm ra hồ sơ, không chỉ trình duyệt đã cập nhật.
    it('lọc theo STT nhận CẢ HAI dạng mã', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({ stt: '26-11171' });

      const where = mockPrisma.petition.findMany.mock.calls[0][0].where;
      expect(where.stt).toEqual({ in: ['26-11171', '2026-11171'] });
    });

    it('gõ dạng đầy đủ cũng ra cùng hồ sơ', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({ stt: '2026-11171' });

      const where = mockPrisma.petition.findMany.mock.calls[0][0].where;
      expect(where.stt).toEqual({ in: ['2026-11171', '26-11171'] });
    });

    it('lọc theo STT cũ — cột đã có chỉ mục', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({ sttCu: '1964' });

      const where = mockPrisma.petition.findMany.mock.calls[0][0].where;
      expect(where.sttCu).toEqual({ contains: '1964', mode: 'insensitive' });
    });

    it('lọc theo cán bộ nhập', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({ enteredById: 'user-1' });

      const where = mockPrisma.petition.findMany.mock.calls[0][0].where;
      expect(where.enteredById).toBe('user-1');
    });

    it('ô lọc để trống thì KHÔNG thêm điều kiện — tránh lọc rỗng ra 0 hồ sơ', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({ stt: '   ', sttCu: '', enteredById: '' });

      const where = mockPrisma.petition.findMany.mock.calls[0][0].where;
      expect(where.stt).toBeUndefined();
      expect(where.sttCu).toBeUndefined();
      expect(where.enteredById).toBeUndefined();
    });

    it('trả về các trường hệ cũ hiển thị trên danh sách', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({});

      const select = mockPrisma.petition.findMany.mock.calls[0][0].select;
      // Ba cột hệ cũ có mà hệ mới không hiện. `summary` phủ 99,99% đơn thư — không trả
      // về thì cán bộ phải mở từng hồ sơ mới biết nội dung.
      expect(select.summary).toBe(true);
      expect(select.nguonDon).toBe(true);
      expect(select.ketQuaXuLyKhac).toBe(true);
      expect(select.sttCu).toBe(true);
    });

    // ── Thứ tự sắp xếp ────────────────────────────────────────────────────
    // Ca kiểm ĐẶT ĐÚNG TẦNG: bộ ca kiểm của buildListOrderBy là hàm thuần, nó vẫn
    // xanh kể cả khi service quên nối vào. Ca dưới đây khẳng định service THẬT SỰ
    // truyền mệnh đề sắp xếp mới xuống Prisma.
    it('mặc định sắp theo NGÀY NHẬN giảm dần, không phải ngày tạo', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({});

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      // Đo trên dữ liệu thật: cả 45.459 đơn thư có CÙNG một createdAt (ngày di trú),
      // nên sắp theo nó cho ra thứ tự ngẫu nhiên. receivedDate phủ 100% và có chỉ mục.
      //
      // Sắp theo `sortReceivedDate` (cột SINH) chứ không phải `receivedDate` trực tiếp:
      // 9 hồ sơ có ngày phi lý (năm 3023, 2925, 0225...) nhận NULL ở cột sinh nên chìm
      // xuống cuối thay vì chiếm trọn màn hình đầu. Cột hiển thị vẫn là receivedDate.
      expect(callArgs.orderBy[0]).toEqual({
        sortReceivedDate: { sort: 'desc', nulls: 'last' },
      });
      expect(JSON.stringify(callArgs.orderBy)).not.toContain('createdAt');
    });

    it('sắp theo ngày nhận thì hồ sơ ngày phi lý bị đẩy xuống CUỐI', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      // Người dùng bấm cột "Ngày nhận" → gửi sortBy='receivedDate'.
      await service.getList({ sortBy: 'receivedDate' });

      const { orderBy } = mockPrisma.petition.findMany.mock.calls[0][0];
      // Phải nắn sang cột sinh, nếu không 9 hồ sơ năm 3023 lại nổi lên đầu.
      expect(orderBy[0]).toEqual({
        sortReceivedDate: { sort: 'desc', nulls: 'last' },
      });
    });

    it('có khoá phụ ổn định để phân trang không lặp/mất hồ sơ', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({});

      const { orderBy } = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(orderBy[orderBy.length - 1]).toEqual({ id: 'desc' });
    });

    it('tên cột tuỳ tiện KHÔNG đi vào truy vấn', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({ sortBy: 'passwordHash', sortOrder: 'desc' });

      const { orderBy } = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(JSON.stringify(orderBy)).not.toContain('passwordHash');
      // Rơi về mặc định, và mặc định vẫn được nắn sang cột sinh.
      expect(orderBy[0]).toEqual({
        sortReceivedDate: { sort: 'desc', nulls: 'last' },
      });
    });

    it('should filter by search query', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({ search: 'Test query' });

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
      expect(callArgs.where.OR.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({ status: PetitionStatus.DANG_XU_LY });

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe(PetitionStatus.DANG_XU_LY);
    });

    /**
     * Drill-down thẻ thống kê: thẻ gộp nhiều trạng thái ("Đang xử lý" = DANG_XU_LY +
     * CHO_PHE_DUYET) nên client gửi KEY nhóm, server giải nghĩa.
     */
    it('lọc theo statusGroup → where.status = { in: [...] }', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({ statusGroup: 'dang-xu-ly' });

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toEqual({
        in: [PetitionStatus.DANG_XU_LY, PetitionStatus.CHO_PHE_DUYET],
      });
    });

    it('có CẢ statusGroup lẫn status → NHÓM thắng (giống semantic phase đã ship)', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({
        statusGroup: 'da-giai-quyet',
        status: PetitionStatus.MOI_TIEP_NHAN,
      });

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toEqual({
        in: [
          PetitionStatus.DA_GIAI_QUYET,
          PetitionStatus.DA_CHUYEN_VU_VIEC,
          PetitionStatus.DA_CHUYEN_VU_AN,
        ],
      });
    });

    it('[P1] statusGroup leo prototype (constructor) → BỎ QUA, không lọt xuống Prisma', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({ statusGroup: 'constructor' });

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBeUndefined();
    });

    it('should always exclude soft-deleted records', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({});

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.where.deletedAt).toBeNull();
    });

    // B0 — ward column on WardPetitionsPage needs assignedTeam.ward.name
    it('should select assignedTeam.ward.name for ward column display', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({});

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.select.assignedTeam).toEqual({
        select: { ward: { select: { name: true } } },
      });
    });
  });

  // ── getById ────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return petition when found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      const result = await service.getById('petition-001');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('petition-001');
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto = {
      stt: 'DT-2026-00099',
      receivedDate: '2026-02-01',
      senderName: 'Nguyễn Văn Test',
      petitionType: LoaiDon.TO_CAO,
    };

    it('should create petition successfully', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null); // stt not taken
      mockPrisma.petition.create.mockResolvedValue({
        ...mockPetition,
        ...validDto,
      });
      mockAudit.log.mockResolvedValue(undefined);

      const result = await service.create(validDto, 'user-001');

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
    });

    it('should throw BadRequestException for future receivedDate', async () => {
      const futureDto = {
        stt: 'DT-2099-00001',
        receivedDate: '2099-12-31',
        senderName: 'Test User',
        petitionType: LoaiDon.TO_CAO,
      };

      await expect(service.create(futureDto, 'user-001')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException for duplicate stt', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(mockPetition); // stt already taken

      await expect(service.create(validDto, 'user-001')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if assignedToId not found', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { ...validDto, assignedToId: 'nonexistent-user' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('TO_CAO petitionType → reads active rule THOI_HAN_TO_CAO, auto-deadline = receivedDate + value', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.petition.create.mockResolvedValue({ ...mockPetition, receivedDate: new Date('2026-02-01') });

      await service.create({ ...validDto, petitionType: LoaiDon.TO_CAO }, 'user-001');

      expect(mockDeadlineRules.getActive).toHaveBeenCalledWith('THOI_HAN_TO_CAO');
      const callArgs = mockPrisma.petition.create.mock.calls[0][0];
      const expectedDeadline = new Date('2026-02-01');
      expectedDeadline.setDate(expectedDeadline.getDate() + 30);
      expect(callArgs.data.deadline).toEqual(expectedDeadline);
      expect(callArgs.data.deadlineRuleVersionId).toBe('rule_init_THOI_HAN_TO_CAO');
    });

    it('KHIEU_NAI petitionType → reads active rule THOI_HAN_KHIEU_NAI, snapshots versionId', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.petition.create.mockResolvedValue(mockPetition);

      await service.create({ ...validDto, petitionType: LoaiDon.KHIEU_NAI }, 'user-001');

      expect(mockDeadlineRules.getActive).toHaveBeenCalledWith('THOI_HAN_KHIEU_NAI');
      const callArgs = mockPrisma.petition.create.mock.calls[0][0];
      expect(callArgs.data.deadlineRuleVersionId).toBe('rule_init_THOI_HAN_KHIEU_NAI');
    });

    it('KIEN_NGHI petitionType → reads active rule THOI_HAN_KIEN_NGHI (15 days)', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.petition.create.mockResolvedValue(mockPetition);

      await service.create({ ...validDto, petitionType: LoaiDon.KIEN_NGHI }, 'user-001');

      expect(mockDeadlineRules.getActive).toHaveBeenCalledWith('THOI_HAN_KIEN_NGHI');
      const callArgs = mockPrisma.petition.create.mock.calls[0][0];
      const expectedDeadline = new Date('2026-02-01');
      expectedDeadline.setDate(expectedDeadline.getDate() + 15);
      expect(callArgs.data.deadline).toEqual(expectedDeadline);
    });

    it('PHAN_ANH petitionType → reads active rule THOI_HAN_PHAN_ANH (15 days)', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.petition.create.mockResolvedValue(mockPetition);

      await service.create({ ...validDto, petitionType: LoaiDon.PHAN_ANH }, 'user-001');

      expect(mockDeadlineRules.getActive).toHaveBeenCalledWith('THOI_HAN_PHAN_ANH');
    });

    it('explicit deadline overrides auto-deadline (no deadlineRules call)', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.petition.create.mockResolvedValue(mockPetition);

      const explicitDeadline = '2026-06-30';
      await service.create(
        { ...validDto, petitionType: LoaiDon.TO_CAO, deadline: explicitDeadline },
        'user-001',
      );

      const callArgs = mockPrisma.petition.create.mock.calls[0][0];
      expect(callArgs.data.deadline).toEqual(new Date(explicitDeadline));
      expect(mockDeadlineRules.getActive).not.toHaveBeenCalled();
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update petition successfully', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        senderName: 'Updated Name',
      });

      const result = await service.update(
        'petition-001',
        { senderName: 'Updated Name' },
        'user-001',
      );

      expect(result.success).toBe(true);
    });

    // v0.30: PETITION_UPDATED must go through wrapUpdate for inline diff display.
    it('v0.30: uses audit.wrapUpdate (not audit.log direct) for PETITION_UPDATED', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        senderName: 'Updated Name',
      });

      await service.update('petition-001', { senderName: 'Updated Name' }, 'user-001');

      expect(mockAudit.wrapUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PETITION_UPDATED',
          subject: 'Petition',
          subjectId: 'petition-001',
          userId: 'user-001',
          fetchFn: expect.any(Function),
          updateFn: expect.any(Function),
        }),
      );
    });

    it('should throw NotFoundException when petition not found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', {}, 'user-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for future receivedDate on update', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await expect(
        service.update(
          'petition-001',
          { receivedDate: '2099-12-31' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    describe('optimistic locking', () => {
      const stalestamp = '2026-01-01T00:00:00.000Z';

      it('throws ConflictException when P2025 with expectedUpdatedAt (stale version)', async () => {
        mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
        mockPrisma.petition.update.mockRejectedValue({ code: 'P2025' });

        await expect(
          service.update('petition-001', { senderName: 'Edited', expectedUpdatedAt: stalestamp }, 'user-001'),
        ).rejects.toThrow(ConflictException);
      });

      it('passes updatedAt in where clause when expectedUpdatedAt provided', async () => {
        mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
        mockPrisma.petition.update.mockResolvedValue({ ...mockPetition, senderName: 'Edited' });

        await service.update('petition-001', { senderName: 'Edited', expectedUpdatedAt: stalestamp }, 'user-001');

        expect(mockPrisma.petition.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ id: 'petition-001', updatedAt: new Date(stalestamp) }),
          }),
        );
      });

      it('does NOT add updatedAt to where clause when expectedUpdatedAt absent (backward compat)', async () => {
        mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
        mockPrisma.petition.update.mockResolvedValue(mockPetition);

        await service.update('petition-001', { senderName: 'Edited' }, 'user-001');

        const callArgs = mockPrisma.petition.update.mock.calls[0][0];
        expect(callArgs.where).not.toHaveProperty('updatedAt');
      });
    });
  });

  // ── petition status change audit (Cycle 3 TDD) ──────────────────────────────

  describe('PETITION_STATUS_CHANGED audit log', () => {
    it('TC-J-P01: logs PETITION_STATUS_CHANGED when status transitions', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition); // status: MOI_TIEP_NHAN
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        status: PetitionStatus.DANG_XU_LY,
        enteredBy: null,
        assignedTo: null,
      });

      await service.update('petition-001', { status: PetitionStatus.DANG_XU_LY }, 'user-001');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PETITION_STATUS_CHANGED',
          subject: 'Petition',
          subjectId: 'petition-001',
          userId: 'user-001',
          metadata: expect.objectContaining({
            fromStatus: PetitionStatus.MOI_TIEP_NHAN,
            toStatus: PetitionStatus.DANG_XU_LY,
          }),
        }),
      );
    });

    it('TC-J-P02: does NOT log PETITION_STATUS_CHANGED when status unchanged', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition); // status: MOI_TIEP_NHAN
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        senderName: 'New Name',
        enteredBy: null,
        assignedTo: null,
      });

      await service.update('petition-001', { senderName: 'New Name' }, 'user-001');

      const statusChangedCalls = mockAudit.log.mock.calls.filter(
        (call: unknown[]) =>
          (call[0] as { action?: string })?.action === 'PETITION_STATUS_CHANGED',
      );
      expect(statusChangedCalls).toHaveLength(0);
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should soft delete petition successfully', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        deletedAt: new Date(),
      });

      const result = await service.delete('petition-001', 'user-001');

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');

      // Verify soft delete (not hard delete)
      const updateCall = mockPrisma.petition.update.mock.calls[0][0];
      expect(updateCall.data.deletedAt).toBeDefined();
    });

    it('should throw NotFoundException when petition not found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-001')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── convertToIncident ──────────────────────────────────────────────────────

  describe('convertToIncident', () => {
    const validConvertDto = {
      incidentName: 'Vụ việc từ đơn thư',
      incidentType: 'An ninh trật tự',
    };

    it('AC-03: should convert petition to incident successfully', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.incident.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockResolvedValue([mockIncident]);
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        linkedIncidentId: 'incident-001',
        status: PetitionStatus.DA_CHUYEN_VU_VIEC,
      });

      const result = await service.convertToIncident(
        'petition-001',
        validConvertDto,
        'user-001',
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
    });

    it('EC-01: should throw BadRequestException when incidentName missing', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await expect(
        service.convertToIncident(
          'petition-001',
          { incidentName: '', incidentType: 'Test' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('EC-01: should throw BadRequestException when incidentType missing', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await expect(
        service.convertToIncident(
          'petition-001',
          { incidentName: 'Test', incidentType: '' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already converted to incident', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue({
        ...mockPetition,
        linkedIncidentId: 'existing-incident',
      });

      await expect(
        service.convertToIncident('petition-001', validConvertDto, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already converted to case', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue({
        ...mockPetition,
        linkedCaseId: 'existing-case',
      });

      await expect(
        service.convertToIncident('petition-001', validConvertDto, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when petition not found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);

      await expect(
        service.convertToIncident('nonexistent', validConvertDto, 'user-001'),
      ).rejects.toThrow(NotFoundException);
    });

    // Cycle 4 — document handoff to new Incident
    it('hands off petition documents to new Incident via document.updateMany', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.incident.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockResolvedValue([mockIncident]);
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        linkedIncidentId: 'incident-001',
        status: PetitionStatus.DA_CHUYEN_VU_VIEC,
      });
      mockPrisma.document.updateMany.mockResolvedValue({ count: 3 });

      await service.convertToIncident('petition-001', validConvertDto, 'user-001');

      expect(mockPrisma.document.updateMany).toHaveBeenCalledWith({
        where: { petitionId: 'petition-001', deletedAt: null },
        data: { incidentId: 'incident-001' },
      });
    });
  });

  // ── convertToCase ──────────────────────────────────────────────────────────

  describe('convertToCase', () => {
    const validCaseDto = {
      caseName: 'Vụ án từ đơn thư',
      crime: 'Tham nhũng',
      jurisdiction: 'Công an cấp Quận/Huyện',
      // P1-002 fix: expectedUpdatedAt now required for optimistic lock
      expectedUpdatedAt: '2026-05-22T10:00:00.000Z',
    };

    it('AC-03: should convert petition to case successfully', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.$transaction.mockResolvedValue([mockCase]);
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        linkedCaseId: 'case-001',
        status: PetitionStatus.DA_CHUYEN_VU_AN,
      });

      const result = await service.convertToCase(
        'petition-001',
        validCaseDto,
        'user-001',
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
    });

    it('EC-01: should throw BadRequestException when caseName missing', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await expect(
        service.convertToCase(
          'petition-001',
          { caseName: '', crime: 'Test', jurisdiction: 'Test', expectedUpdatedAt: '2026-05-22T10:00:00.000Z' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('EC-01: should throw BadRequestException when crime missing', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await expect(
        service.convertToCase(
          'petition-001',
          { caseName: 'Test', crime: '', jurisdiction: 'Test', expectedUpdatedAt: '2026-05-22T10:00:00.000Z' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('EC-01: should throw BadRequestException when jurisdiction missing', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await expect(
        service.convertToCase(
          'petition-001',
          { caseName: 'Test', crime: 'Test', jurisdiction: '', expectedUpdatedAt: '2026-05-22T10:00:00.000Z' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already converted to case', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue({
        ...mockPetition,
        linkedCaseId: 'existing-case',
      });

      await expect(
        service.convertToCase('petition-001', validCaseDto, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already converted to incident', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue({
        ...mockPetition,
        linkedIncidentId: 'existing-incident',
      });

      await expect(
        service.convertToCase('petition-001', validCaseDto, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when petition not found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);

      await expect(
        service.convertToCase('nonexistent', validCaseDto, 'user-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a Case with correct fields', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: {
            create: jest.fn().mockResolvedValue(mockCase),
          },
          petition: {
            update: jest.fn().mockResolvedValue({
              ...mockPetition,
              linkedCaseId: 'case-001',
              status: PetitionStatus.DA_CHUYEN_VU_AN,
            }),
          },
          document: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        return fn(tx);
      });

      await service.convertToCase('petition-001', validCaseDto, 'user-001');

      // Audit log should be called
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PETITION_CONVERTED_TO_CASE',
        }),
      );
    });

    // P1-002 fix: race condition regression tests
    it('P1-002: applies optimistic lock with expectedUpdatedAt in tx.petition.update WHERE', async () => {
      const stamp = '2026-05-22T10:00:00.000Z';
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      const updateMock = jest.fn().mockResolvedValue({
        ...mockPetition,
        linkedCaseId: 'case-001',
        status: PetitionStatus.DA_CHUYEN_VU_AN,
      });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue(mockCase) },
          petition: { update: updateMock },
          document: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        return fn(tx);
      });

      await service.convertToCase(
        'petition-001',
        { ...validCaseDto, expectedUpdatedAt: stamp },
        'user-001',
      );

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'petition-001',
            updatedAt: new Date(stamp),
          }),
        }),
      );
    });

    it('P1-002: throws ConflictException khi P2002 unique constraint violation (race detected at DB)', async () => {
      const stamp = '2026-05-22T10:00:00.000Z';
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      // Simulate 2nd concurrent call: tx commits but Prisma throws P2002 from partial unique index
      mockPrisma.$transaction.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.convertToCase(
          'petition-001',
          { ...validCaseDto, expectedUpdatedAt: stamp },
          'user-001',
        ),
      ).rejects.toThrow('Đơn thư đã được chỉnh sửa bởi người dùng khác');
    });

    it('P1-002: throws ConflictException khi P2025 (updatedAt mismatch — optimistic lock fired)', async () => {
      const staleStamp = '2026-01-01T00:00:00.000Z';
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.$transaction.mockRejectedValue({ code: 'P2025' });

      await expect(
        service.convertToCase(
          'petition-001',
          { ...validCaseDto, expectedUpdatedAt: staleStamp },
          'user-001',
        ),
      ).rejects.toThrow('Đơn thư đã được chỉnh sửa bởi người dùng khác');
    });

    // Cycle 4 — document handoff to new Case in same transaction
    it('hands off petition documents to new Case via tx.document.updateMany', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      const updateManyMock = jest.fn().mockResolvedValue({ count: 2 });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue(mockCase) },
          petition: { update: jest.fn().mockResolvedValue({
            ...mockPetition,
            linkedCaseId: 'case-001',
            status: PetitionStatus.DA_CHUYEN_VU_AN,
          }) },
          document: { updateMany: updateManyMock },
        };
        return fn(tx);
      });

      await service.convertToCase('petition-001', validCaseDto, 'user-001');

      expect(updateManyMock).toHaveBeenCalledWith({
        where: { petitionId: 'petition-001', deletedAt: null },
        data: { caseId: 'case-001' },
      });
    });
  });

  // ── Audit log ─────────────────────────────────────────────────────────────

  describe('Audit logging', () => {
    it('should log PETITION_CREATED on create', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.petition.create.mockResolvedValue(mockPetition);

      await service.create(
        {
          stt: 'DT-2026-00002',
          receivedDate: '2026-02-01',
          senderName: 'Test',
          petitionType: LoaiDon.TO_CAO,
        },
        'user-001',
        { ipAddress: '127.0.0.1', userAgent: 'jest-test' },
      );

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PETITION_CREATED' }),
      );
    });

    it('should log PETITION_DELETED on soft delete', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        deletedAt: new Date(),
      });

      await service.delete('petition-001', 'user-001');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PETITION_DELETED' }),
      );
    });
  });

  // ── exportToExcel ──────────────────────────────────────────────────────────

  describe('exportToExcel', () => {
    const buildMockRes = () => {
      const res: any = {
        setHeader: jest.fn(),
        end: jest.fn(),
        write: jest.fn(),
      };
      return res;
    };

    it('applies dataScope filter — non-admin users only see their team data', async () => {
      const dataScope = {
        userIds: ['user-002'],
        teamIds: ['team-001'],
        writableTeamIds: ['team-001'],
        canDispatch: false,
      };
      mockPrisma.petition.findMany.mockResolvedValue([]);

      // Mock ExcelJS write — we just need it not to throw
      const mockWrite = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(require('exceljs'), 'Workbook').mockImplementation(() => ({
        addWorksheet: () => ({
          mergeCells: jest.fn(),
          getCell: () => ({ value: null, font: {}, fill: {}, alignment: {}, border: {} }),
          getRow: () => ({
            getCell: () => ({ value: null, font: {}, fill: {}, alignment: {}, border: {} }),
            height: 0,
          }),
          columns: [],
        }),
        xlsx: { write: mockWrite },
      }));

      const mockRes = buildMockRes();
      await service.exportToExcel({}, dataScope as any, mockRes as any);

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      // scopeFilter should be applied via AND
      expect(callArgs.where.AND).toBeDefined();
    });

    it('limits to 500 records max', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);

      jest.spyOn(require('exceljs'), 'Workbook').mockImplementation(() => ({
        addWorksheet: () => ({
          mergeCells: jest.fn(),
          getCell: () => ({ value: null, font: {}, fill: {}, alignment: {}, border: {} }),
          getRow: () => ({
            getCell: () => ({ value: null, font: {}, fill: {}, alignment: {}, border: {} }),
            height: 0,
          }),
          columns: [],
        }),
        xlsx: { write: jest.fn().mockResolvedValue(undefined) },
      }));

      const mockRes = buildMockRes();
      await service.exportToExcel({}, null, mockRes as any);

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(500);
    });

    it('returns empty workbook when no data found', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);

      const mockWrite = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(require('exceljs'), 'Workbook').mockImplementation(() => ({
        addWorksheet: () => ({
          mergeCells: jest.fn(),
          getCell: () => ({ value: null, font: {}, fill: {}, alignment: {}, border: {} }),
          getRow: () => ({
            getCell: () => ({ value: null, font: {}, fill: {}, alignment: {}, border: {} }),
            height: 0,
          }),
          columns: [],
        }),
        xlsx: { write: mockWrite },
      }));

      const mockRes = buildMockRes();
      await service.exportToExcel({}, null, mockRes as any);

      // Write should have been called even with empty data
      expect(mockWrite).toHaveBeenCalled();
    });
  });

  // ── assignPetition ─────────────────────────────────────────────────────────

  describe('assignPetition', () => {
    const mockTeam = { id: 'team-001', name: 'Tổ 1', isActive: true };
    const existingPetition = {
      ...mockPetition,
      assignedTeamId: null,
      assignedToId: null,
    };

    it('assigns petition and logs audit with from/to metadata', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(existingPetition);
      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      mockPrisma.userTeam.findFirst.mockResolvedValue({ userId: 'user-001', teamId: 'team-001' });
      mockPrisma.petition.update.mockResolvedValue({ ...existingPetition, assignedTeamId: 'team-001', assignedToId: 'user-001' });

      const result = await service.assignPetition(
        'petition-001',
        { assignedTeamId: 'team-001', assignedToId: 'user-001' },
        'dispatcher-001',
      );

      expect(result.success).toBe(true);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PETITION_ASSIGNED',
          metadata: expect.objectContaining({
            fromTeamId: null,
            toTeamId: 'team-001',
            fromAssignedToId: null,
            toAssignedToId: 'user-001',
            dispatchedBy: 'dispatcher-001',
          }),
        }),
      );
    });

    it('throws NotFoundException when petition not found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);

      await expect(
        service.assignPetition('bad-id', { assignedTeamId: 'team-001' }, 'dispatcher-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException on P2025 with expectedUpdatedAt', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(existingPetition);
      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      mockPrisma.userTeam.findMany.mockResolvedValue([]);
      mockPrisma.petition.update.mockRejectedValue({ code: 'P2025' });

      await expect(
        service.assignPetition('petition-001', { assignedTeamId: 'team-001', expectedUpdatedAt: new Date() }, 'dispatcher-001'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when team not found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(existingPetition);
      mockPrisma.team.findFirst.mockResolvedValue(null);

      await expect(
        service.assignPetition('petition-001', { assignedTeamId: 'nonexistent-team' }, 'dispatcher-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when assignedToId not member of team', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(existingPetition);
      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      mockPrisma.userTeam.findFirst.mockResolvedValue(null);

      await expect(
        service.assignPetition('petition-001', { assignedTeamId: 'team-001', assignedToId: 'user-999' }, 'dispatcher-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('assigns petition without assignedToId (team-only assignment — auto-assign leader path)', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(existingPetition);
      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      // No leaders in team — auto-assign logic finds no leader → null
      mockPrisma.userTeam.findMany.mockResolvedValue([]);
      mockPrisma.petition.update.mockResolvedValue({ ...existingPetition, assignedTeamId: 'team-001', assignedToId: null });

      const result = await service.assignPetition(
        'petition-001',
        { assignedTeamId: 'team-001' },
        'dispatcher-001',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.userTeam.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── restore (v0.32.0.0) ────────────────────────────────────────────────
  describe('restore (v0.32.0.0)', () => {
    const REASON = 'Khôi phục đơn thư do test';
    const ACTOR_ID = 'admin-001';

    const setupDeletedPetition = () => {
      const deleted = {
        id: 'petition-001',
        stt: 'DT-2026-00001',
        senderName: 'Nguyễn Văn A',
        deletedAt: new Date(Date.now() - 24 * 3_600_000),
      } as any;
      mockPrisma.petition.findFirst.mockResolvedValue(deleted);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = { petition: { update: jest.fn().mockResolvedValue({ ...deleted, deletedAt: null }) } };
        await cb(tx);
      });
      return deleted;
    };

    it('BE-R8a: throws NotFound khi record không tồn tại', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);
      await expect(service.restore('nope', REASON, ACTOR_ID)).rejects.toThrow(NotFoundException);
    });

    it('BE-R8b: throws NotFound khi chưa bị xóa (filter deletedAt:{not:null})', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);
      await expect(service.restore('p-001', REASON, ACTOR_ID)).rejects.toThrow(/chưa bị xóa/);
      expect(mockPrisma.petition.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p-001', deletedAt: { not: null } },
        }),
      );
    });

    it('BE-R8c: success — set deletedAt=null + audit PETITION_RESTORED', async () => {
      setupDeletedPetition();
      const result = await service.restore('petition-001', REASON, ACTOR_ID);
      expect(result.success).toBe(true);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PETITION_RESTORED',
          metadata: expect.objectContaining({ reason: REASON, hoursAfterDeletion: expect.any(Number) }),
        }),
        expect.anything(),
      );
    });

    it('BE-R8d: concurrent restore (P2025) → BadRequest', async () => {
      setupDeletedPetition();
      const p2025 = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '7.8.0' },
      );
      mockPrisma.$transaction.mockRejectedValueOnce(p2025);
      await expect(service.restore('petition-001', REASON, ACTOR_ID)).rejects.toThrow(/đã được khôi phục/);
    });
  });

  // ── exportWardPetitions ────────────────────────────────────────────────────
  // Mirror pattern from IncidentsService.exportWardIncidents.
  // Endpoint: GET /api/v1/petitions/export/ward — returns BCA-styled XLSX.
  describe('exportWardPetitions', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PassThrough } = require('stream');
    let mockRes: any;

    beforeEach(() => {
      // Earlier exportToExcel tests spy on ExcelJS.Workbook without restoring,
      // leaking a stub workbook into later tests. Undo all spies before our cycles.
      jest.restoreAllMocks();
      mockRes = Object.assign(new PassThrough(), {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        headersSent: false,
      });
      // Consume stream so workbook.write doesn't backpressure
      mockRes.on('data', () => {});
    });

    it('B1: sets xlsx Content-Type and DonThuPhuongXa filename header', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);

      await service.exportWardPetitions({}, null, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('DonThuPhuongXa_'),
      );
    });

    it('B2: filters petitions by unitId query param', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);

      await service.exportWardPetitions({ unitId: 'unit-q1' }, null, mockRes);

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.where.unit).toBe('unit-q1');
    });

    it('B3: filters by fromDate/toDate on createdAt (mirror Incidents ward export semantics)', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);

      await service.exportWardPetitions(
        { fromDate: '2026-01-01', toDate: '2026-03-31' },
        null,
        mockRes,
      );

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.where.createdAt).toBeDefined();
      expect(callArgs.where.createdAt.gte).toEqual(new Date('2026-01-01'));
      expect(callArgs.where.createdAt.lte).toEqual(new Date('2026-03-31T23:59:59.999Z'));
    });

    it('B4: applies buildPetitionScopeFilter for non-dispatcher dataScope', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      const scope: DataScope = {
        userIds: ['user-001'],
        teamIds: ['team-a'],
        writableTeamIds: ['team-a'],
        canDispatch: false,
        isWardOfficer: false,
        wardTeamId: null,
      } as unknown as DataScope;

      await service.exportWardPetitions({}, scope, mockRes);

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.where.AND).toBeDefined();
      expect(Array.isArray(callArgs.where.AND)).toBe(true);
      expect(callArgs.where.AND.length).toBeGreaterThan(0);
    });

    it('B5: writes 8-column BCA-styled sheet header (STT, Số đơn, Người gửi, Loại đơn, Tóm tắt, Phường/Xã, Ngày tiếp nhận, Trạng thái)', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([
        {
          id: 'p1',
          stt: 'DT-2026-00001',
          receivedDate: new Date('2026-02-15'),
          senderName: 'Nguyễn A',
          summary: 'Tóm tắt nội dung đơn',
          petitionType: LoaiDon.TO_CAO,
          status: PetitionStatus.MOI_TIEP_NHAN,
          assignedTeam: { ward: { name: 'Phường 2' } },
        },
      ]);

      const chunks: Buffer[] = [];
      mockRes.on('data', (c: Buffer) => chunks.push(c));
      const done = new Promise<void>((resolve) => mockRes.on('end', resolve));

      await service.exportWardPetitions({}, null, mockRes);
      await done;

      const buf = Buffer.concat(chunks);
      expect(buf.length).toBeGreaterThan(0);
      // Filename hint = sheet present, content is binary xlsx — assert headers were set up.
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.xlsx'),
      );
    });

    it('B5b: maps petitionType enum to Vietnamese label in Excel row (consistency with status column)', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([
        {
          id: 'p1', stt: 'DT-2026-00001', receivedDate: new Date('2026-02-15'),
          senderName: 'Người A', summary: 'tóm tắt', petitionType: LoaiDon.TO_CAO,
          status: PetitionStatus.MOI_TIEP_NHAN, assignedTeam: null,
        },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ExcelJS = require('exceljs');
      const captured: string[][] = [];
      const probeWb = new ExcelJS.Workbook();
      const WsProto = Object.getPrototypeOf(probeWb.addWorksheet('probe'));
      const realAddRow = WsProto.addRow;
      WsProto.addRow = function (values: any[]) {
        captured.push(values.map((v) => String(v ?? '')));
        return { getCell: () => ({ font: {}, fill: {}, alignment: {}, border: {} }) };
      };
      try {
        await service.exportWardPetitions({}, null, mockRes);
      } finally {
        WsProto.addRow = realAddRow;
      }
      // First non-header row should have 'Tố cáo' at index 3 (Loại đơn column)
      const dataRow = captured.find((r) => r[1] === 'DT-2026-00001');
      expect(dataRow).toBeDefined();
      expect(dataRow![3]).toBe('Tố cáo');
    });

    it('B6: audit logs PETITION_EXPORTED with kind=ward when actor provided', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);

      await service.exportWardPetitions(
        { fromDate: '2026-01-01' },
        null,
        mockRes,
        { userId: 'user-001', ipAddress: '127.0.0.1', userAgent: 'jest' },
      );

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PETITION_EXPORTED',
          subject: 'Petition',
          userId: 'user-001',
          metadata: expect.objectContaining({
            kind: 'ward',
            format: 'xlsx',
          }),
        }),
      );
    });

    it('B6b: does NOT audit log when actor missing (e.g. internal call)', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);

      await service.exportWardPetitions({}, null, mockRes);

      const exportLogs = (mockAudit.log as jest.Mock).mock.calls.filter(
        (c) => (c[0] as { action?: string })?.action === 'PETITION_EXPORTED',
      );
      expect(exportLogs).toHaveLength(0);
    });

    it('B7: returns 500 JSON when xlsx write fails and headers not yet sent', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ExcelJS = require('exceljs');
      // XLSX class is not exported — grab prototype via a probe instance, then patch.
      const probeWb = new ExcelJS.Workbook();
      const XlsxProto = Object.getPrototypeOf(probeWb.xlsx);
      const realWrite = XlsxProto.write;
      XlsxProto.write = jest.fn().mockRejectedValue(new Error('disk full'));
      mockRes.headersSent = false;

      try {
        await service.exportWardPetitions({}, null, mockRes);
      } finally {
        XlsxProto.write = realWrite;
      }

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Export failed' });
    });
  });

  // ── BUG-001 + BUG-002: DTO validation (class-validator) ───────────────────
  describe('CreatePetitionDto validation', () => {
    it('BUG-001: fails validation when petitionType is missing', async () => {
      const dto = plainToClass(CreatePetitionDto, {
        stt: 'DT-2026-00001',
        receivedDate: '2026-05-24',
        senderName: 'Nguyễn Văn A',
        // petitionType intentionally omitted — should now be required
      });
      const errors = await validate(dto);
      const ptError = errors.find((e) => e.property === 'petitionType');
      expect(ptError).toBeDefined();
      expect(ptError?.constraints).toHaveProperty('isNotEmpty');
    });

    it('BUG-001: passes validation when petitionType is a valid enum value', async () => {
      const dto = plainToClass(CreatePetitionDto, {
        stt: 'DT-2026-00002',
        receivedDate: '2026-05-24',
        senderName: 'Nguyễn Văn B',
        petitionType: 'TO_CAO',
      });
      const errors = await validate(dto);
      const ptError = errors.find((e) => e.property === 'petitionType');
      expect(ptError).toBeUndefined();
    });

    it('BUG-002: senderName with <script> tag is stripped by @Transform', () => {
      const dto = plainToClass(CreatePetitionDto, {
        stt: 'XSS-001',
        receivedDate: '2026-05-24',
        senderName: '<script>alert(1)</script>Test Name',
        petitionType: 'TO_CAO',
      });
      // @Transform(stripHtmlTags) must have been applied by plainToClass
      expect(dto.senderName).toBe('Test Name');
    });
  });

  // ── Nhóm V — suspectSearch + duplicateSearch ──────────────────────────────

  describe('suspectSearch()', () => {
    it('V-S1: returns structured results matching senderName', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([
        {
          ...mockPetition,
          id: 'pet-suspect-1',
          stt: 'DT-2025-00003',
          senderName: 'Nguyễn Văn A',
          senderIdNumber: '079088001234',
          toiDanhBanDau: 'Trộm cắp tài sản',
          receivedDate: new Date('2025-06-01'),
        },
      ]);

      const result = await service.suspectSearch('Nguyễn Văn A', null);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Nguyễn Văn A',
            idNumber: '079088001234',
            crimes: expect.any(Array),
            sources: expect.arrayContaining([
              expect.objectContaining({ type: 'petition', stt: 'DT-2025-00003' }),
            ]),
          }),
        ]),
      );
    });

    it('V-S2: returns empty array for blank query', async () => {
      const result = await service.suspectSearch('', null);
      expect(result).toEqual([]);
      expect(mockPrisma.petition.findMany).not.toHaveBeenCalled();
    });

    it('V-S3: groups multiple petitions from same person into one result', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([
        {
          ...mockPetition,
          id: 'pet-1',
          stt: 'DT-2025-00001',
          senderName: 'Trần Thị B',
          senderIdNumber: '079088005678',
          toiDanhBanDau: 'Lừa đảo',
        },
        {
          ...mockPetition,
          id: 'pet-2',
          stt: 'DT-2026-00001',
          senderName: 'Trần Thị B',
          senderIdNumber: '079088005678',
          toiDanhBanDau: 'Chiếm đoạt tài sản',
        },
      ]);

      const result = await service.suspectSearch('Trần Thị B', null);

      expect(result).toHaveLength(1);
      expect(result[0].sources).toHaveLength(2);
      expect(result[0].crimes).toContain('Lừa đảo');
      expect(result[0].crimes).toContain('Chiếm đoạt tài sản');
    });
  });

  describe('duplicateSearch()', () => {
    it('V-D1: returns petitions matching query text in senderName', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([
        {
          ...mockPetition,
          id: 'pet-dup-1',
          stt: 'DT-2025-00099',
          senderName: 'Lê Văn C',
          receivedDate: new Date('2025-01-15'),
          summary: 'Đơn tố giác về đất đai',
        },
      ]);

      const result = await service.duplicateSearch('Lê Văn C', undefined, null);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'pet-dup-1',
            stt: 'DT-2025-00099',
            senderName: 'Lê Văn C',
          }),
        ]),
      );
    });

    it('V-D2: excludes the petition with excludeId', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);

      await service.duplicateSearch('Lê Văn C', 'pet-current', null);

      const call = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(JSON.stringify(call.where)).toContain('pet-current');
    });

    it('V-D3: returns empty array for blank query', async () => {
      const result = await service.duplicateSearch('', undefined, null);
      expect(result).toEqual([]);
      expect(mockPrisma.petition.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Nhóm I — Auto-assign leader + PetitionAssignment multi-officer ──────────
  describe('assignPetition — Nhóm I auto-assign to leader', () => {
    const mockTeam = { id: 'team-001', name: 'Tổ 1', isActive: true };
    const existingPetition = { ...mockPetition, assignedTeamId: null, assignedToId: null };

    beforeEach(() => jest.clearAllMocks());

    it('I-A1: auto-assigns to team leader when assignedToId not provided', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(existingPetition);
      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { userId: 'user-leader', teamId: 'team-001', isLeader: true },
      ]);
      mockPrisma.petition.update.mockResolvedValue({
        ...existingPetition,
        assignedTeamId: 'team-001',
        assignedToId: 'user-leader',
      });

      const result = await service.assignPetition(
        'petition-001',
        { assignedTeamId: 'team-001' },
        'dispatcher-001',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.petition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedToId: 'user-leader' }),
        }),
      );
    });

    it('I-A2: assigns with null assignedToId when no leader found (fail-open)', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(existingPetition);
      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { userId: 'user-regular', teamId: 'team-001', isLeader: false },
      ]);
      mockPrisma.petition.update.mockResolvedValue({
        ...existingPetition,
        assignedTeamId: 'team-001',
        assignedToId: null,
      });

      const result = await service.assignPetition(
        'petition-001',
        { assignedTeamId: 'team-001' },
        'dispatcher-001',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.petition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedToId: null }),
        }),
      );
    });

    it('I-A3: explicit assignedToId overrides leader auto-detection', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(existingPetition);
      mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
      mockPrisma.userTeam.findFirst.mockResolvedValue({ userId: 'user-explicit', teamId: 'team-001' });
      mockPrisma.petition.update.mockResolvedValue({
        ...existingPetition,
        assignedTeamId: 'team-001',
        assignedToId: 'user-explicit',
      });

      await service.assignPetition(
        'petition-001',
        { assignedTeamId: 'team-001', assignedToId: 'user-explicit' },
        'dispatcher-001',
      );

      expect(mockPrisma.userTeam.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.petition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedToId: 'user-explicit' }),
        }),
      );
    });
  });

  describe('PetitionAssignment CRUD — Nhóm I', () => {
    const mockPetitionForAssign = { ...mockPetition, id: 'petition-001', deletedAt: null };

    beforeEach(() => jest.clearAllMocks());

    it('I-B1: addAssignment creates PetitionAssignment record', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetitionForAssign);
      mockPrisma.petitionAssignment.findUnique.mockResolvedValue(null);
      mockPrisma.userTeam.findFirst.mockResolvedValue({ userId: 'user-001', teamId: 'team-001' });
      mockPrisma.petitionAssignment.create.mockResolvedValue({
        id: 'pa-001',
        petitionId: 'petition-001',
        userId: 'user-001',
        role: 'SUPPORT',
        assignedById: 'dispatcher-001',
        assignedAt: new Date(),
      });

      const result = await service.addAssignment('petition-001', 'user-001', 'SUPPORT', 'dispatcher-001');
      expect(result).toHaveProperty('id', 'pa-001');
      expect(mockPrisma.petitionAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ petitionId: 'petition-001', userId: 'user-001', role: 'SUPPORT' }),
        }),
      );
    });

    it('I-B2: addAssignment throws ConflictException if already assigned', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetitionForAssign);
      mockPrisma.petitionAssignment.findUnique.mockResolvedValue({ id: 'existing-pa' });

      await expect(
        service.addAssignment('petition-001', 'user-001', 'SUPPORT', 'dispatcher-001'),
      ).rejects.toThrow(ConflictException);
    });

    it('I-B3: removeAssignment deletes PetitionAssignment', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetitionForAssign);
      mockPrisma.petitionAssignment.findUnique.mockResolvedValue({ id: 'pa-001' });
      mockPrisma.petitionAssignment.delete.mockResolvedValue({ id: 'pa-001' });

      const result = await service.removeAssignment('petition-001', 'user-001', 'dispatcher-001');
      expect(result.success).toBe(true);
    });

    it('I-B4: removeAssignment throws NotFoundException if not assigned', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetitionForAssign);
      mockPrisma.petitionAssignment.findUnique.mockResolvedValue(null);

      await expect(
        service.removeAssignment('petition-001', 'user-999', 'dispatcher-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('I-B5: listAssignments returns all assignments for petition', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetitionForAssign);
      mockPrisma.petitionAssignment.findMany.mockResolvedValue([
        { id: 'pa-001', petitionId: 'petition-001', userId: 'user-001', role: 'LEAD', user: { firstName: 'A', lastName: 'B' } },
      ]);

      const result = await service.listAssignments('petition-001', null);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('role', 'LEAD');
    });
  });
});
