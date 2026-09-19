import { ForbiddenException } from '@nestjs/common';
import type { DataScope } from '../../auth/services/unit-scope.service';
import { CasesService } from '../../cases/cases.service';
import { IncidentsService } from '../../incidents/incidents.service';
import { PetitionsService } from '../../petitions/petitions.service';

/**
 * Cán bộ PHƯỜNG không được thấy hồ sơ CHƯA GIAO TỔ (luật v0.33 "Crit 1"). Danh sách đã ẩn chúng, nhưng kiểm phạm vi
 * ĐỌC từng hồ sơ (trang chi tiết) không loại cán bộ phường → biết id là mở được (rà độc lập 19/09/2026).
 */
const PHUONG: DataScope = {
  userIds: ['u1'],
  teamIds: ['t-phuong'],
  writableTeamIds: ['t-phuong'],
  writableUserIds: ['u1'],
  isWardOfficer: true,
};
const THUONG: DataScope = { ...PHUONG, isWardOfficer: false };

// Chỉ gọi hàm kiểm phạm vi thuần — không cần phụ thuộc nào của service.
const vuAn = Object.create(CasesService.prototype) as CasesService;
const vuViec = Object.create(IncidentsService.prototype) as IncidentsService;
const donThu = Object.create(PetitionsService.prototype) as PetitionsService;

describe('checkRecordInScope — cán bộ phường và hồ sơ chưa giao tổ', () => {
  it('vụ án chưa giao tổ: cán bộ phường (không phụ trách) → 403; cán bộ thường → xem được', () => {
    const hoSo = { investigatorId: 'u-khac', assignedTeamId: null };
    expect(() => vuAn['checkRecordInScope'](hoSo, PHUONG)).toThrow(
      ForbiddenException,
    );
    expect(() => vuAn['checkRecordInScope'](hoSo, THUONG)).not.toThrow();
  });

  it('vụ việc chưa giao tổ: cán bộ phường → 403', () => {
    const hoSo = { investigatorId: 'u-khac', assignedTeamId: null };
    expect(() => vuViec['checkRecordInScope'](hoSo, PHUONG)).toThrow(
      ForbiddenException,
    );
    expect(() => vuViec['checkRecordInScope'](hoSo, THUONG)).not.toThrow();
  });

  it('đơn thư chưa giao tổ: cán bộ phường → 403', () => {
    const hoSo = { enteredById: 'u-khac', assignedTeamId: null };
    expect(() => donThu['checkRecordInScope'](hoSo, PHUONG)).toThrow(
      ForbiddenException,
    );
    expect(() => donThu['checkRecordInScope'](hoSo, THUONG)).not.toThrow();
  });

  it('cán bộ phường vẫn xem được hồ sơ chưa giao tổ mà CHÍNH MÌNH phụ trách/nhập', () => {
    expect(() =>
      vuAn['checkRecordInScope'](
        { investigatorId: 'u1', assignedTeamId: null },
        PHUONG,
      ),
    ).not.toThrow();
    expect(() =>
      donThu['checkRecordInScope'](
        { enteredById: 'u1', assignedTeamId: null },
        PHUONG,
      ),
    ).not.toThrow();
  });
});
