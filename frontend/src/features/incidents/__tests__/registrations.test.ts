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
  it('registers View/Edit/Delete/Assign in order', () => {
    expect(incidentsRowActions.all().map((a) => a.key)).toEqual([
      'view',
      'edit',
      'delete',
      'assign',
    ]);
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
  it('registers 4 fields', () => {
    expect(incidentsListFilters.all().map((f) => f.key)).toEqual([
      'keyword',
      'loaiDonVu',
      'reporter',
      'unit',
    ]);
  });

  it('loaiDonVu is enumSelect with 3 options', () => {
    const f = incidentsListFilters.all().find((x) => x.key === 'loaiDonVu')!;
    expect(f.type).toBe('enumSelect');
    expect(f.options).toHaveLength(3);
    expect(f.options?.map((o) => o.value)).toEqual(['TO_GIAC', 'TIN_BAO', 'KIEN_NGHI_KHOI_TO']);
  });

  it('legacy testid pattern preserved', () => {
    expect(incidentsListFilters.all().map((f) => f.testid)).toEqual([
      'filter-keyword',
      'filter-loai-don-vu',
      'filter-reporter',
      'filter-unit',
    ]);
  });
});
