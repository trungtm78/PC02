import { describe, it, expect, vi } from 'vitest';
import { petitionsRowActions, type PetitionRowForActions } from '../row-actions';
import { petitionsListFilters } from '../list-filters';
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

describe('petitionsRowActions', () => {
  it('registers View/Edit/Delete/Assign in order', () => {
    expect(petitionsRowActions.all().map((a) => a.key)).toEqual([
      'view',
      'edit',
      'delete',
      'assign',
    ]);
  });

  it('View navigates to /petitions/:id', () => {
    const ctx = makeCtx();
    const view = petitionsRowActions.all().find((a) => a.key === 'view')!;
    view.execute({ id: 'P1', status: 'MOI_TIEP_NHAN' }, ctx);
    expect(ctx.navigate).toHaveBeenCalledWith('/petitions/P1');
  });

  it('Phân công opens AssignModal with resourceType=petitions', () => {
    const assign = petitionsRowActions.all().find((a) => a.key === 'assign')!;
    const ctx = makeCtx();
    const row: PetitionRowForActions = {
      id: 'P2',
      status: 'DANG_XU_LY',
      assignedTeamId: 'T5',
    };
    assign.execute(row, ctx);
    expect(ctx.assignModal.open).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'petitions', recordId: 'P2', currentTeamId: 'T5' }),
    );
  });

  it('Phân công hidden when canDispatch=false', () => {
    const assign = petitionsRowActions.all().find((a) => a.key === 'assign')!;
    expect(assign.visible?.({ id: 'P', status: 'X' }, makeCtx({ perms: { canDispatch: false } }))).toBe(false);
  });

  it('Delete enabled for all petition statuses (no status guard)', () => {
    const del = petitionsRowActions.all().find((a) => a.key === 'delete')!;
    expect(del.disabled?.({ id: 'P', status: 'MOI_TIEP_NHAN' }, makeCtx())).toBeNull();
    expect(del.disabled?.({ id: 'P', status: 'DA_GIAI_QUYET' }, makeCtx())).toBeNull();
  });
});

describe('petitionsListFilters', () => {
  it('registers 5 fields in legacy order', () => {
    expect(petitionsListFilters.all().map((f) => f.key)).toEqual([
      'fromDate',
      'toDate',
      'sender',
      'status',
      'unit',
    ]);
  });

  it('status is enumSelect with all PetitionStatus values', () => {
    const f = petitionsListFilters.all().find((x) => x.key === 'status')!;
    expect(f.type).toBe('enumSelect');
    expect(f.options).toBeDefined();
    expect(f.options!.length).toBeGreaterThanOrEqual(7);
  });

  it('legacy testid pattern preserved', () => {
    expect(petitionsListFilters.all().map((f) => f.testid)).toEqual([
      'filter-from-date',
      'filter-to-date',
      'filter-sender',
      'filter-status',
      'filter-unit',
    ]);
  });
});
