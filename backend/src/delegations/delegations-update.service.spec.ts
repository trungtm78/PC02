/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DelegationsService } from './delegations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

const mockPrisma = {
  delegation: {
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({ id: 'd1' }),
  },
};

/**
 * Form sửa cho đổi Số ủy thác và Ngày ủy thác, nhưng `update` từng bỏ qua hai trường này — cán bộ bấm Lưu,
 * không lỗi gì, giá trị không đổi (rà mã 17/09/2026).
 */
describe('DelegationsService.update — lưu đủ các trường form cho sửa', () => {
  let service: DelegationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.delegation.findFirst.mockResolvedValue({
      id: 'd1',
      createdById: 'u1',
      relatedCase: null,
      status: 'PENDING',
      assignedToId: null,
    });
    const module = await Test.createTestingModule({
      providers: [
        DelegationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: DocumentNumbersService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(DelegationsService);
  });

  it('ghi Số ủy thác và Ngày ủy thác khi gửi lên', async () => {
    await service.update(
      'd1',
      { delegationNumber: 'UT-010/2026', delegationDate: '2026-09-05' },
      'u1',
      undefined,
      null,
    );
    const data = mockPrisma.delegation.update.mock.calls[0][0].data;
    expect(data.delegationNumber).toBe('UT-010/2026');
    expect(data.delegationDate).toEqual(new Date('2026-09-05'));
  });

  it('không gửi thì không đụng', async () => {
    await service.update(
      'd1',
      { content: 'Nội dung mới đủ dài' },
      'u1',
      undefined,
      null,
    );
    const data = mockPrisma.delegation.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('delegationNumber');
    expect(data).not.toHaveProperty('delegationDate');
  });
});
