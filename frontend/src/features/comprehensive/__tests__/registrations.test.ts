import { describe, it, expect, vi } from 'vitest';
import {
  comprehensiveRowActions,
  type ComprehensiveRowForActions,
} from '../row-actions';
import { comprehensiveListFilters } from '../list-filters';
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

describe('comprehensiveRowActions polyglot dispatch', () => {
  it('registers View/Edit/Delete (3 actions)', () => {
    expect(comprehensiveRowActions.all().map((a) => a.key)).toEqual([
      'view',
      'edit',
      'delete',
    ]);
  });

  it('View dispatches to /cases when recordType=CASE', () => {
    const ctx = makeCtx();
    const view = comprehensiveRowActions.all().find((a) => a.key === 'view')!;
    view.execute({ id: 'X1', recordType: 'CASE' }, ctx);
    expect(ctx.navigate).toHaveBeenCalledWith('/cases/X1');
  });

  it('View dispatches to /incidents when recordType=INCIDENT', () => {
    const ctx = makeCtx();
    const view = comprehensiveRowActions.all().find((a) => a.key === 'view')!;
    view.execute({ id: 'X2', recordType: 'INCIDENT' }, ctx);
    expect(ctx.navigate).toHaveBeenCalledWith('/incidents/X2');
  });

  it('View dispatches to /petitions when recordType=PETITION', () => {
    const ctx = makeCtx();
    const view = comprehensiveRowActions.all().find((a) => a.key === 'view')!;
    view.execute({ id: 'X3', recordType: 'PETITION' }, ctx);
    expect(ctx.navigate).toHaveBeenCalledWith('/petitions/X3');
  });

  it('Edit appends /edit per type', () => {
    const ctx = makeCtx();
    const edit = comprehensiveRowActions.all().find((a) => a.key === 'edit')!;
    edit.execute({ id: 'X4', recordType: 'INCIDENT' }, ctx);
    expect(ctx.navigate).toHaveBeenCalledWith('/incidents/X4/edit');
  });

  it('Delete opens DeleteResourceModal with mapped resourceType', () => {
    const ctx = makeCtx();
    const del = comprehensiveRowActions.all().find((a) => a.key === 'delete')!;
    del.execute(
      { id: 'X5', recordType: 'PETITION', caseNumber: 'DT-2026-001' },
      ctx,
    );
    expect(ctx.deleteModal.open).toHaveBeenCalledWith({
      resourceType: 'petitions',
      recordId: 'X5',
      recordLabel: 'DT-2026-001',
    });
  });

  it('Edit hidden when canEdit=false', () => {
    const edit = comprehensiveRowActions.all().find((a) => a.key === 'edit')!;
    expect(edit.visible?.({ id: 'X', recordType: 'CASE' }, makeCtx({ perms: { canEdit: false } }))).toBe(false);
  });

  it('Delete hidden when canDelete=false', () => {
    const del = comprehensiveRowActions.all().find((a) => a.key === 'delete')!;
    expect(del.visible?.({ id: 'X', recordType: 'CASE' }, makeCtx({ perms: { canDelete: false } }))).toBe(false);
  });
});

describe('comprehensiveListFilters', () => {
  it('registers 5 fields', () => {
    expect(comprehensiveListFilters.all().map((f) => f.key)).toEqual([
      'fromDate',
      'toDate',
      'district',
      'status',
      'createdBy',
    ]);
  });

  it('testid pattern legacy preserved', () => {
    const testids = comprehensiveListFilters.all().map((f) => f.testid);
    expect(testids).toContain('filter-from-date');
    expect(testids).toContain('filter-district');
    expect(testids).toContain('filter-created-by');
  });
});
