import { BadRequestException } from '@nestjs/common';
import { Incident, IncidentStatus, Prisma } from '@prisma/client';
import { laNgayThat } from '../common/validators/is-ngay-that.validator';
import { VALID_TRANSITIONS } from './incidents.constants';

export function canProsecuteIncidentStatus(status: IncidentStatus): boolean {
  return (
    VALID_TRANSITIONS[status]?.includes(IncidentStatus.DA_CHUYEN_VU_AN) ?? false
  );
}

export function validateIncidentProsecution(
  source: Incident,
  decision?: string,
  date?: string,
) {
  if (source.intakeStage && source.intakeStage !== 'DA_NHAN')
    throw new BadRequestException('Cần xác nhận nhận hồ sơ trước khi khởi tố');
  if (!canProsecuteIncidentStatus(source.status))
    throw new BadRequestException(
      'Chỉ khởi tố vụ việc đang xác minh, đã phân công hoặc phục hồi nguồn tin',
    );
  if (
    !decision?.trim() ||
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !laNgayThat(date)
  )
    throw new BadRequestException(
      'Bắt buộc số và ngày quyết định khởi tố có thật',
    );
}

export function incidentSourceToCase(source: Incident) {
  return {
    moTaChiTiet: source.description,
    nguonDon: source.chuyenTuDonVi,
    tenCungCap: source.benVu,
    cccdCungCap: source.cmndNguoiToGiac,
    sdtCungCap: source.sdtNguoiToGiac,
    diaChiCungCap: source.diaChiNguoiToGiac,
    sinhNamCungCap: source.sinhNamNguoiToGiac,
    noiXayRa: source.diaChiXayRa,
    ngayXayRa: source.fromDate,
    donViGiaiQuyet: source.donViGiaiQuyet,
    ngayDeXuat: source.ngayDeXuat,
    lanhDaoToTung: source.lanhDaoToTung,
    dieuTraVien: source.dieuTraVien,
    crimeChinhId: source.crimeChinhId,
    assignedTeamId: source.assignedTeamId,
    investigatorId: source.investigatorId,
  };
}

export function incidentSourceSnapshot(
  source: Incident,
): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(source)) as Prisma.InputJsonObject;
}
