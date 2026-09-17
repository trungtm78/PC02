/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowService } from './workflow.service';
import { CasesService } from '../cases/cases.service';
import { IncidentsService } from '../incidents/incidents.service';
import { PetitionsService } from '../petitions/petitions.service';
import { TRAN_GOP_MOI_NGUON } from './chuyen-tra.types';

const vuAn = {
  getList: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'c1',
        caseCode: '2026-11171',
        name: 'Trộm cắp',
        status: 'DANG_DIEU_TRA',
        ngayDeXuat: new Date('2026-09-01T00:00:00Z'),
        assignedTeam: { id: 't1', name: 'Đội 2' },
        investigator: { firstName: 'Văn A', lastName: 'Nguyễn' },
      },
    ],
    total: 3179,
  }),
};
const vuViec = {
  getList: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'i1',
        code: '2026-9706',
        name: 'Mất trộm',
        status: 'TIEP_NHAN',
        ngayDeXuat: new Date('2026-09-05T00:00:00Z'),
        assignedTeam: { id: 't2', name: 'Tổ 3' },
      },
    ],
    total: 4141,
  }),
};
const donThu = {
  getList: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'p1',
        stt: '2026-1',
        detailContent: 'Đơn tố giác',
        status: 'MOI_TIEP_NHAN',
        ngayDeXuat: new Date('2026-08-01T00:00:00Z'),
        assignedTeam: { id: 't1', name: 'Đội 2' },
        assignedTo: { firstName: 'Bình', lastName: 'Trần' },
      },
    ],
    total: 36476,
  }),
};

/**
 * Màn Chuyển đội / Trả hồ sơ gộp ba bảng. Trước 18/09/2026 trình duyệt tự gộp: xin `limit = trang × 20`
 * mỗi nguồn (DTO chặn 100 → trang 6 là 400 cả màn) và lấy K dòng đầu của ba nguồn ĐANG SẮP THEO STT rồi
 * sắp lại theo ngày — hồ sơ ngày mới mà STT nhỏ không bao giờ hiện.
 */
describe('WorkflowService.listChuyenTra — gộp ba nguồn ở máy chủ', () => {
  let service: WorkflowService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: CasesService, useValue: vuAn },
        { provide: IncidentsService, useValue: vuViec },
        { provide: PetitionsService, useValue: donThu },
      ],
    }).compile();
    service = module.get(WorkflowService);
  });

  it('hỏi ba nguồn theo ĐÚNG thứ tự của bảng gộp (ngày đề xuất giảm dần) và lấy tới hết trang', async () => {
    await service.listChuyenTra({ limit: 20, offset: 40 } as never, null);
    for (const nguon of [vuAn, vuViec, donThu]) {
      const q = nguon.getList.mock.calls[0][0] as {
        sortBy: string;
        sortOrder: string;
        limit: number;
        offset: number;
      };
      expect(q.sortBy).toBe('ngayDeXuat');
      expect(q.sortOrder).toBe('desc');
      expect(q.limit).toBe(60);
      expect(q.offset).toBe(0);
    }
  });

  it('gộp theo ngày đề xuất giảm dần, tổng = tổng ba nguồn', async () => {
    const kq = await service.listChuyenTra({} as never, null);
    expect(kq.data.map((d) => d.id)).toEqual(['i1', 'c1', 'p1']);
    expect(kq.total).toBe(3179 + 4141 + 36476);
  });

  it('cột đọc trường thật: mã hồ sơ từng loại, tên tổ, người phụ trách', async () => {
    const kq = await service.listChuyenTra({} as never, null);
    expect(kq.data.map((d) => d.ma)).toEqual([
      '2026-9706',
      '2026-11171',
      '2026-1',
    ]);
    expect(kq.data.map((d) => d.toTen)).toEqual(['Tổ 3', 'Đội 2', 'Đội 2']);
    expect(kq.data.find((d) => d.id === 'c1')?.nguoiPhuTrach).toBe(
      'Nguyễn Văn A',
    );
    expect(kq.data.find((d) => d.id === 'p1')?.nguoiPhuTrach).toBe('Trần Bình');
  });

  it('Vụ việc nhận khoảng ngày qua tên tham số riêng của nó', async () => {
    await service.listChuyenTra(
      { fromDate: '2026-01-01', toDate: '2026-02-01' } as never,
      null,
    );
    expect(vuViec.getList.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        fromDateRange: '2026-01-01',
        toDateRange: '2026-02-01',
      }),
    );
    expect(vuAn.getList.mock.calls[0][0]).toEqual(
      expect.objectContaining({ fromDate: '2026-01-01', toDate: '2026-02-01' }),
    );
  });

  it('lọc một loại thì KHÔNG hỏi hai nguồn kia', async () => {
    await service.listChuyenTra({ loai: 'Vụ án' } as never, null);
    expect(vuAn.getList).toHaveBeenCalled();
    expect(vuViec.getList).not.toHaveBeenCalled();
    expect(donThu.getList).not.toHaveBeenCalled();
  });

  it('phạm vi dữ liệu truyền xuống từng nguồn', async () => {
    const pham = { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: [] };
    await service.listChuyenTra({} as never, pham as never);
    for (const nguon of [vuAn, vuViec, donThu]) {
      expect(nguon.getList.mock.calls[0][1]).toBe(pham);
    }
  });

  it('lật quá trần gộp → 400 nói rõ, không trả trang thiếu', async () => {
    await expect(
      service.listChuyenTra(
        { limit: 20, offset: TRAN_GOP_MOI_NGUON } as never,
        null,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
