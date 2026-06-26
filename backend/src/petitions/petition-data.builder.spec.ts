import { buildPetitionCreateData } from './petition-data.builder';
import { PetitionStatus } from '@prisma/client';

const baseDto: any = {
  receivedDate: '2026-06-01',
  senderName: 'Nguyễn Văn A',
  senderPhone: '0901234567',
  // v0.47 — trước đây bị RỚT khi create (bug)
  nhanThay: 'Có dấu hiệu tội phạm',
  deXuat: 'Đề xuất xác minh',
  raSoatTrung: 'Không trùng',
  baoCaoBanGiamDoc: true,
  petitionDate: '2026-05-30',
  nguonDon: 'Công an phường 1',
  // field-parity mới
  senderIdNumber: '012345678901',
  senderIdIssueDate: '2020-01-15',
  crimeChinhId: 'crime-123',
  senderIsAnonymous: false,
  laCongNgheCao: true,
  loaiThongTin: 'Tố giác',
  ngayPhieuChuyen: '2026-05-28',
};

const ctx = {
  stt: 'DT-2026-00001',
  actorId: 'user-1',
  computedDeadline: new Date('2026-07-01'),
  deadlineRuleVersionId: 'rule-1',
  effectiveAssignedTeamId: undefined,
};

describe('buildPetitionCreateData', () => {
  it('GIỮ field v0.47 khi create (fix bug rớt data)', () => {
    const data = buildPetitionCreateData(baseDto, ctx);
    expect(data.nhanThay).toBe('Có dấu hiệu tội phạm');
    expect(data.deXuat).toBe('Đề xuất xác minh');
    expect(data.raSoatTrung).toBe('Không trùng');
    expect(data.baoCaoBanGiamDoc).toBe(true);
    expect(data.nguonDon).toBe('Công an phường 1');
  });

  it('persist ngayDeXuat/phanLoaiNguonTin/dieuTraVien (parity tab Thông tin)', () => {
    const data = buildPetitionCreateData(
      { ...baseDto, ngayDeXuat: '2026-06-20', phanLoaiNguonTin: 'don-cong-van-ban-dau', dieuTraVien: 'Nguyễn Văn A' },
      ctx,
    );
    expect(data.dieuTraVien).toBe('Nguyễn Văn A');
    expect(data.phanLoaiNguonTin).toBe('don-cong-van-ban-dau');
    expect(data.ngayDeXuat).toEqual(new Date('2026-06-20'));
  });

  it('gồm field-parity mới', () => {
    const data = buildPetitionCreateData(baseDto, ctx);
    expect(data.senderIdNumber).toBe('012345678901');
    expect(data.crimeChinhId).toBe('crime-123');
    expect(data.senderIsAnonymous).toBe(false);
    expect(data.laCongNgheCao).toBe(true);
    expect(data.loaiThongTin).toBe('Tố giác');
  });

  it('GIỮ thoiHanUTDT khi create (fix bug rớt data — update có, create không)', () => {
    const data = buildPetitionCreateData({ ...baseDto, thoiHanUTDT: '2026-06-30' }, ctx);
    expect(data.thoiHanUTDT).toBeInstanceOf(Date);
    expect((data.thoiHanUTDT as Date).toISOString()).toContain('2026-06-30');
  });

  it('thoiHanUTDT để trống → undefined (không Invalid Date)', () => {
    const data = buildPetitionCreateData({ ...baseDto, thoiHanUTDT: undefined }, ctx);
    expect(data.thoiHanUTDT).toBeUndefined();
  });

  it('chuyển string ngày → Date', () => {
    const data = buildPetitionCreateData(baseDto, ctx);
    expect(data.receivedDate).toBeInstanceOf(Date);
    expect(data.petitionDate).toBeInstanceOf(Date);
    expect(data.ngayPhieuChuyen).toBeInstanceOf(Date);
    expect(data.senderIdIssueDate).toBeInstanceOf(Date);
  });

  it('ngày để trống → undefined (không tạo Invalid Date)', () => {
    const data = buildPetitionCreateData({ ...baseDto, petitionDate: undefined }, ctx);
    expect(data.petitionDate).toBeUndefined();
  });

  it('stt/enteredById/deadline lấy từ ctx; status mặc định MOI_TIEP_NHAN', () => {
    const data = buildPetitionCreateData(baseDto, ctx);
    expect(data.stt).toBe('DT-2026-00001');
    expect(data.enteredById).toBe('user-1');
    expect(data.deadline).toEqual(new Date('2026-07-01'));
    expect(data.status).toBe(PetitionStatus.MOI_TIEP_NHAN);
  });

  it('assignedTeamId chỉ có khi ctx truyền', () => {
    const without = buildPetitionCreateData(baseDto, ctx);
    expect('assignedTeamId' in without).toBe(false);
    const withTeam = buildPetitionCreateData(baseDto, { ...ctx, effectiveAssignedTeamId: 'team-9' });
    expect(withTeam.assignedTeamId).toBe('team-9');
  });
});
