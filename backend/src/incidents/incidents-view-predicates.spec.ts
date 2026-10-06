import { BadRequestException } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import type { QueryIncidentsDto } from './dto/query-incidents.dto';

describe('Approved intake/management/history/empty-field filter contracts', () => {
  const service = new IncidentsService(
    {} as never,
    {} as never,
    {
      getKyThongKe: jest.fn().mockResolvedValue({
        ky: 'TAT_CA',
        truong: 'NGAY_TIEP_NHAN',
        tuNgay: null,
        denNgay: null,
      }),
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );

  it('intake retains explicit staged records and original legacy intake sources', async () => {
    const { where } = await service.dungWhereDanhSach({
      view: 'intake',
      intakeStage: 'CHO_NHAN',
    });
    expect(where.intakeStage).toBe('CHO_NHAN');
    expect(where.AND).toContainEqual({
      OR: [{ intakeStage: { not: null } }, { legacyCollection: 'ho_so_doi_1' }],
    });
  });

  it('management excludes source copies and pending/unaccepted stages', async () => {
    const { where } = await service.dungWhereDanhSach({
      view: 'management',
      historyStatus: 'TAM_DINH_CHI',
    });
    expect(where.AND).toContainEqual({
      handledIncidentId: null,
      OR: [{ intakeStage: null }, { intakeStage: 'DA_NHAN' }],
    });
    expect(where.statusHistory).toEqual({ some: { toStatus: 'TAM_DINH_CHI' } });
  });

  it('empty date means null only; empty text permits null or blank', async () => {
    const date = await service.dungWhereDanhSach({
      emptyField: 'ngayTiepNhanNguonTin',
    });
    expect(date.where.AND).toContainEqual({ ngayTiepNhanNguonTin: null });
    for (const emptyField of [
      'soQDPhanCongNguonTin',
      'soQuyetDinhTamDinhChiVV',
      'soQuyetDinhPhucHoiVV',
      'benVu',
      'donViGiaiQuyet',
      'crimeChinhId',
    ]) {
      const text = await service.dungWhereDanhSach({
        emptyField,
      } as QueryIncidentsDto);
      expect(text.where.AND).toContainEqual({
        OR: [{ [emptyField]: null }, { [emptyField]: '' }],
      });
    }
  });

  it('unknown empty-field keys fail closed rather than forming arbitrary Prisma predicates', async () => {
    await expect(
      service.dungWhereDanhSach({
        emptyField: 'passwordHash',
      } as QueryIncidentsDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
