import { describe, it, expect, vi } from 'vitest';
import { incidentsRowActions, type IncidentRowForActions } from '../row-actions';
import { incidentsListFilters } from '../list-filters';
import type { ActionContext } from '@/features/_shared/row-actions/registry';

function makeCtx(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    navigate: vi.fn() as unknown as ActionContext['navigate'],
    perms: { canDispatch: true, canEdit: true, canDelete: true },
    assignModal: { open: vi.fn() },
    deleteModal: { open: vi.fn() },
    ...overrides,
  };
}

describe('incidentsRowActions', () => {
  it('registers View/Edit/Delete/Assign/Transition/Prosecute in order', () => {
    expect(incidentsRowActions.all().map((a) => a.key)).toEqual([
      'view',
      'edit',
      'delete',
      'assign',
      'transition',
      'prosecute',
    ]);
  });

  it('Transition visible when statusTransition provided + status has valid transitions', () => {
    const action = incidentsRowActions.all().find((a) => a.key === 'transition')!;
    const ctxWith = makeCtx({ statusTransition: { open: vi.fn() } });
    expect(action.visible?.({ id: 'I', status: 'TIEP_NHAN' }, ctxWith)).toBe(true);
    expect(action.visible?.({ id: 'I', status: 'DA_CHUYEN_VU_AN' }, ctxWith)).toBe(false);
    expect(action.visible?.({ id: 'I', status: 'TIEP_NHAN' }, makeCtx())).toBe(false);
  });

  it('Transition execute opens statusTransition modal', () => {
    const action = incidentsRowActions.all().find((a) => a.key === 'transition')!;
    const open = vi.fn();
    const ctx = makeCtx({ statusTransition: { open } });
    action.execute(
      { id: 'I3', status: 'DANG_XAC_MINH', updatedAt: '2026-01-01T00:00:00Z' },
      ctx,
    );
    expect(open).toHaveBeenCalledWith({
      recordId: 'I3',
      currentStatus: 'DANG_XAC_MINH',
      currentUpdatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('Prosecute visible only when status ∈ {DANG_XAC_MINH, DA_PHAN_CONG} + provider', () => {
    const action = incidentsRowActions.all().find((a) => a.key === 'prosecute')!;
    const ctxWith = makeCtx({ prosecute: { open: vi.fn() } });
    expect(action.visible?.({ id: 'I', status: 'DANG_XAC_MINH' }, ctxWith)).toBe(true);
    expect(action.visible?.({ id: 'I', status: 'DA_PHAN_CONG' }, ctxWith)).toBe(true);
    expect(action.visible?.({ id: 'I', status: 'TIEP_NHAN' }, ctxWith)).toBe(false);
    expect(action.visible?.({ id: 'I', status: 'DANG_XAC_MINH' }, makeCtx())).toBe(false);
  });

  it('Prosecute execute opens prosecute modal with incident name', () => {
    const action = incidentsRowActions.all().find((a) => a.key === 'prosecute')!;
    const open = vi.fn();
    const ctx = makeCtx({ prosecute: { open } });
    action.execute(
      {
        id: 'I4',
        status: 'DANG_XAC_MINH',
        name: 'Vụ việc HS-2026-007',
        updatedAt: '2026-05-01T00:00:00Z',
      },
      ctx,
    );
    expect(open).toHaveBeenCalledWith({
      recordId: 'I4',
      incidentName: 'Vụ việc HS-2026-007',
      currentUpdatedAt: '2026-05-01T00:00:00Z',
    });
  });

  it('View navigates to /vu-viec/:id', () => {
    const ctx = makeCtx();
    const view = incidentsRowActions.all().find((a) => a.key === 'view')!;
    view.execute({ id: 'I1', status: 'TIEP_NHAN' }, ctx);
    expect(ctx.navigate).toHaveBeenCalledWith('/vu-viec/I1');
  });

  it('Phân công requires canDispatch, opens AssignModal with resourceType=incidents', () => {
    const assign = incidentsRowActions.all().find((a) => a.key === 'assign')!;
    expect(assign.visible?.({ id: 'I', status: 'X' }, makeCtx({ perms: { canDispatch: false } }))).toBe(false);
    const ctx = makeCtx();
    const row: IncidentRowForActions = {
      id: 'I2',
      status: 'TIEP_NHAN',
      assignedTeamId: 'T9',
      updatedAt: '2026-01-02T00:00:00Z',
    };
    assign.execute(row, ctx);
    expect(ctx.assignModal.open).toHaveBeenCalledWith({
      resourceType: 'incidents',
      recordId: 'I2',
      currentTeamId: 'T9',
      currentUpdatedAt: '2026-01-02T00:00:00Z',
    });
  });

  it('Delete TIEP_NHAN-only', () => {
    const del = incidentsRowActions.all().find((a) => a.key === 'delete')!;
    expect(del.disabled?.({ id: 'I', status: 'TIEP_NHAN' }, makeCtx())).toBeNull();
    expect(del.disabled?.({ id: 'I', status: 'DANG_XAC_MINH' }, makeCtx())).toContain('Tiếp nhận');
  });
});

describe('incidentsListFilters', () => {
  it('registers 3 fields', () => {
    expect(incidentsListFilters.all().map((f) => f.key)).toEqual([
      'loaiDonVu',
      'reporter',
      'unit',
    ]);
  });

  /**
   * HỢP ĐỒNG ĐỔI CÓ CHỦ ĐÍCH (trước: có field 'keyword').
   *
   * `keyword` trùng chức năng với ô tìm kiếm trên thanh công cụ (cùng tra mã/tên), và
   * param này KHÔNG có trong `QueryIncidentsDto` — mà backend bật `forbidNonWhitelisted`
   * nên gửi lên là 400. Tức là dùng bộ lọc đó đang làm mất trắng danh sách.
   */
  it('KHÔNG còn field keyword (trùng ô tìm kiếm + gây 400)', () => {
    expect(incidentsListFilters.all().find((f) => f.key === 'keyword')).toBeUndefined();
  });

  it('loaiDonVu is enumSelect with 3 options', () => {
    const f = incidentsListFilters.all().find((x) => x.key === 'loaiDonVu')!;
    expect(f.type).toBe('enumSelect');
    expect(f.options).toHaveLength(3);
    expect(f.options?.map((o) => o.value)).toEqual(['TO_GIAC', 'TIN_BAO', 'KIEN_NGHI_KHOI_TO']);
  });

  it('legacy testid pattern preserved', () => {
    expect(incidentsListFilters.all().map((f) => f.testid)).toEqual([
      'filter-loai-don-vu',
      'filter-reporter',
      'filter-unit',
    ]);
  });
});
