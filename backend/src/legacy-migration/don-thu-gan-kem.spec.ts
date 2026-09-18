import { Test, TestingModule } from '@nestjs/testing';
import { LegacyMigrationService } from './legacy-migration.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decomposeLegacyRecord, type LegacyRecord } from './legacy-mapper';

/**
 * Anh báo 18/09/2026: "Lê Nguyễn Yến Thanh" (26-11129) hệ cũ có ở danh sách Đơn thư, hệ mới tìm không
 * ra. Hệ cũ xếp danh sách theo `loai` (nơi hồ sơ ĐANG nằm = don_thu); bộ nạp chọn thực thể theo
 * `phan_loai_nguon_tin_ban_dau` (vụ án/luật sư) → chỉ tạo Vụ án. Đo prod: 61 vụ án + 25 vụ việc như
 * vậy, không có đơn thư nào.
 *
 * Anh chốt: tạo THÊM một đơn thư gắn kèm (như khi cán bộ chuyển đơn sang vụ án), trạng thái "Đã chuyển
 * vụ án/vụ việc", nối tới vụ án/vụ việc — CHỈ THÊM, không sửa vụ án/vụ việc.
 */
const hoSo = (ghiDe: Partial<LegacyRecord>): LegacyRecord => ({
  id: 86938,
  __sourceCollection: 'ho_so_doi_1',
  nam: 2026,
  stt: 11129,
  loai: 'don_thu',
  phan_loai_nguon_tin_ban_dau: 'vu-an-ban-dau',
  ten_ca_nhan_co_quan_to_chuc_cung_cap: 'Lê Nguyễn Yến Thanh',
  tom_tat_noi_dung: 'Gửi hồ sơ của luật sư Nguyễn Văn Tiến',
  ngay_tiep_nhan_nguon_tin: '24/08/2026',
  ...ghiDe,
});

describe('decomposeLegacyRecord — đơn thư gắn kèm hồ sơ lệch loại', () => {
  it('loai=don_thu nhưng phân loại ra VỤ ÁN → thêm đơn thư gắn kèm vụ án', () => {
    const d = decomposeLegacyRecord(hoSo({}));
    expect(d.case).toBeDefined();
    expect(d.petition).toBeDefined();
    expect(d.petitionGanKem).toBe('CASE');
    expect(d.petition?.senderName).toBe('Lê Nguyễn Yến Thanh');
    // Một bản thô duy nhất, ở vụ án — đơn là vỏ liên kết (bù mã mượn bản thô anh em).
    expect(d.case?.legacyRaw).toBeDefined();
    expect(d.petition && 'legacyRaw' in d.petition).toBe(false);
  });

  it('loai=don_thu nhưng phân loại ra VỤ VIỆC → thêm đơn thư gắn kèm vụ việc', () => {
    const d = decomposeLegacyRecord(
      hoSo({ phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau' }),
    );
    expect(d.incident).toBeDefined();
    expect(d.petitionGanKem).toBe('INCIDENT');
  });

  it('loai=don_thu và phân loại là đơn → đơn thư thường, KHÔNG gắn kèm', () => {
    const d = decomposeLegacyRecord(
      hoSo({ phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau' }),
    );
    expect(d.petition).toBeDefined();
    expect(d.petitionGanKem).toBeUndefined();
  });

  it('loai khác don_thu (vd vu_an_da_phan_loai) → KHÔNG thêm đơn', () => {
    const d = decomposeLegacyRecord(hoSo({ loai: 'vu_an_da_phan_loai' }));
    expect(d.case).toBeDefined();
    expect(d.petition).toBeUndefined();
  });

  it('thiếu ngày tiếp nhận nhưng có ngày đề xuất → theo đúng luật đơn thư thường (dùng ngày đề xuất)', () => {
    const d = decomposeLegacyRecord(
      hoSo({ ngay_tiep_nhan_nguon_tin: undefined, ngay_de_xuat: '20/08/2026' }),
    );
    expect(d.petitionGanKem).toBe('CASE');
    expect(d.petition?.receivedDate).toBeInstanceOf(Date);
  });

  it('không có ngày nào → KHÔNG thêm đơn (không bịa ngày), vụ án vẫn nạp, có cảnh báo', () => {
    const d = decomposeLegacyRecord(
      hoSo({ ngay_tiep_nhan_nguon_tin: undefined, ngay_de_xuat: undefined }),
    );
    expect(d.case).toBeDefined();
    expect(d.petition).toBeUndefined();
    expect(d.warnings.join(' ')).toMatch(/đơn thư gắn kèm/);
  });
});

function bangGia(): BangGia {
  return {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  };
}
/** Đối số lần gọi thứ `i` của một hàm giả Prisma. */
function goi(
  m: jest.Mock,
  i = 0,
): { data: Record<string, unknown>; where?: unknown } {
  return (
    m.mock.calls[i] as [{ data: Record<string, unknown>; where?: unknown }]
  )[0];
}
type BangGia = Record<'findFirst' | 'create' | 'update' | 'upsert', jest.Mock>;
const mockTx: Record<string, Partial<BangGia>> & {
  petition: BangGia;
  incident: BangGia;
  case: BangGia;
  lawyer: BangGia;
  crime: Pick<BangGia, 'findFirst'>;
} = {
  petition: bangGia(),
  incident: bangGia(),
  case: bangGia(),
  caseStatistic: { upsert: jest.fn() },
  lawyer: bangGia(),
  crime: { findFirst: jest.fn() },
};
const mockPrisma = {
  crime: { findFirst: jest.fn() },
  directory: { findMany: jest.fn() },
  $transaction: jest.fn(),
};
const mockAudit = { log: jest.fn() };

describe('LegacyMigrationService — ghi đơn thư gắn kèm', () => {
  let service: LegacyMigrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegacyMigrationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(LegacyMigrationService);
    jest.clearAllMocks();
    mockPrisma.directory.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(mockTx),
    );
    for (const bang of ['petition', 'incident', 'case', 'lawyer'] as const) {
      mockTx[bang].findFirst.mockResolvedValue(null);
    }
    mockTx.petition.create.mockResolvedValue({ id: 'p1' });
    mockTx.incident.create.mockResolvedValue({ id: 'i1' });
    mockTx.case.create.mockResolvedValue({ id: 'c1' });
    mockTx.crime.findFirst.mockResolvedValue(null);
    mockPrisma.crime.findFirst.mockResolvedValue(null);
  });

  it('nạp mới: vụ án GIỮ nguồn gốc cũ (không đổi thành FROM_PETITION), đơn tạo SAU và nối tới vụ án', async () => {
    const kq = await service.commit([hoSo({})], 'actor');
    expect(kq.errors).toEqual([]);
    const taoVuAn = goi(mockTx.case.create).data;
    expect(taoVuAn.caseProvenance).toBe('TRANSFERRED');
    expect(taoVuAn.linkedPetition).toBeUndefined();
    const taoDon = goi(mockTx.petition.create).data;
    expect(taoDon.linkedCaseId).toBe('c1');
    expect(taoDon.status).toBe('DA_CHUYEN_VU_AN');
    expect(taoDon.stt).toBe('DT-LEGACY-ho_so_doi_1:86938');
    expect(kq.created.petitions).toBe(1);
  });

  it('nạp mới vụ việc: đơn nối tới vụ việc, trạng thái Đã chuyển vụ việc', async () => {
    await service.commit(
      [hoSo({ phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau' })],
      'actor',
    );
    const taoDon = goi(mockTx.petition.create).data;
    expect(taoDon.linkedIncidentId).toBe('i1');
    expect(taoDon.status).toBe('DA_CHUYEN_VU_VIEC');
  });

  it('nạp lại (hệ cũ sửa): cập nhật đúng đơn gắn kèm đã có, KHÔNG tạo đơn thứ hai, KHÔNG đè trạng thái', async () => {
    mockTx.case.findFirst.mockResolvedValue({ id: 'c9', metadata: null });
    mockTx.case.update.mockResolvedValue({ id: 'c9' });
    // Đơn gắn kèm đã nối vụ án từ lần nạp trước; cán bộ có thể đã đổi trạng thái.
    mockTx.petition.findFirst.mockResolvedValue({
      id: 'p9',
      loaiThongTin: null,
      petitionType: null,
      linkedCaseId: 'c9',
      linkedIncidentId: null,
      status: 'DA_GIAI_QUYET',
    });
    await service.commit([hoSo({})], 'actor');
    expect(mockTx.petition.create).not.toHaveBeenCalled();
    const suaDon = goi(mockTx.petition.update);
    expect(suaDon.where).toEqual({ id: 'p9' });
    expect(suaDon.data.status).toBeUndefined();
    expect(suaDon.data.linkedCaseId).toBe('c9');
    expect(goi(mockTx.case.update).data.caseProvenance).toBe('TRANSFERRED');
  });

  it('đơn THƯỜNG cũ nay mới được nối (hệ cũ đổi phân loại) → đặt Đã chuyển vụ án', async () => {
    mockTx.petition.findFirst.mockResolvedValue({
      id: 'p9',
      loaiThongTin: null,
      petitionType: null,
      linkedCaseId: null,
      linkedIncidentId: null,
      status: 'MOI_TIEP_NHAN',
    });
    await service.commit([hoSo({})], 'actor');
    const suaDon = goi(mockTx.petition.update);
    expect(suaDon.data.linkedCaseId).toBe('c1');
    expect(suaDon.data.status).toBe('DA_CHUYEN_VU_AN');
  });

  it('đơn thường cũ cán bộ ĐÃ chốt (Đã giải quyết) → nối nhưng GIỮ trạng thái', async () => {
    mockTx.petition.findFirst.mockResolvedValue({
      id: 'p9',
      loaiThongTin: null,
      petitionType: null,
      linkedCaseId: null,
      linkedIncidentId: null,
      status: 'DA_GIAI_QUYET',
    });
    await service.commit([hoSo({})], 'actor');
    const suaDon = goi(mockTx.petition.update);
    expect(suaDon.data.linkedCaseId).toBe('c1');
    expect(suaDon.data.status).toBeUndefined();
  });

  it('bù cho hồ sơ ĐÃ CÓ: chỉ thêm đơn gắn kèm, KHÔNG ghi vào vụ án', async () => {
    mockTx.case.findFirst.mockResolvedValue({ id: 'c9' });
    const kq = await service.ganDonThuKemChoHoSoDaCo([hoSo({})], false);
    expect(kq.daTao).toEqual([
      { legacyId: 'ho_so_doi_1:86938', loai: 'CASE', dichId: 'c9' },
    ]);
    expect(mockTx.case.update).not.toHaveBeenCalled();
    expect(mockTx.case.create).not.toHaveBeenCalled();
    const taoDon = goi(mockTx.petition.create).data;
    expect(taoDon.linkedCaseId).toBe('c9');
    expect(taoDon.status).toBe('DA_CHUYEN_VU_AN');
  });

  it('bù cho hồ sơ đã có: đơn đã tồn tại → bỏ qua (chạy lại ra 0)', async () => {
    mockTx.case.findFirst.mockResolvedValue({ id: 'c9' });
    mockTx.petition.findFirst.mockResolvedValue({ id: 'p9' });
    const kq = await service.ganDonThuKemChoHoSoDaCo([hoSo({})], false);
    expect(kq.daTao).toEqual([]);
    expect(kq.daCo).toBe(1);
    expect(mockTx.petition.create).not.toHaveBeenCalled();
  });

  it('bù — chạy thử: không ghi gì, chỉ liệt kê', async () => {
    mockTx.case.findFirst.mockResolvedValue({ id: 'c9' });
    const kq = await service.ganDonThuKemChoHoSoDaCo([hoSo({})], true);
    expect(kq.daTao).toEqual([
      { legacyId: 'ho_so_doi_1:86938', loai: 'CASE', dichId: 'c9' },
    ]);
    expect(mockTx.petition.create).not.toHaveBeenCalled();
  });

  it('bù — không tìm thấy vụ án đích → báo, không tạo đơn mồ côi', async () => {
    const kq = await service.ganDonThuKemChoHoSoDaCo([hoSo({})], false);
    expect(kq.khongThayDich).toEqual(['ho_so_doi_1:86938']);
    expect(mockTx.petition.create).not.toHaveBeenCalled();
  });
});
