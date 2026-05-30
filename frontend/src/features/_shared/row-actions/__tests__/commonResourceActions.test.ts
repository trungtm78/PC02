import { describe, it, expect, vi } from 'vitest';
import { commonResourceActions } from '../commonResourceActions';
import type { ActionContext } from '../registry';

interface CaseRow {
  id: string;
  status: string;
}

function makeCtx(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    navigate: vi.fn() as unknown as ActionContext['navigate'],
    perms: { canDispatch: true, canEdit: true, canDelete: true },
    assignModal: { open: vi.fn() },
    deleteModal: { open: vi.fn() },
    ...overrides,
  };
}

describe('commonResourceActions', () => {
  it('returns View + Edit when canDelete option omitted', () => {
    const acts = commonResourceActions<CaseRow>({ basePath: '/cases' });
    expect(acts.map((a) => a.key)).toEqual(['view', 'edit']);
  });

  it('returns View + Edit + Delete when canDelete provided', () => {
    const acts = commonResourceActions<CaseRow>({
      basePath: '/cases',
      canDelete: () => null,
      resourceType: 'cases',
    });
    expect(acts.map((a) => a.key)).toEqual(['view', 'edit', 'delete']);
  });

  it('View action navigates to basePath/:id on execute', () => {
    const ctx = makeCtx();
    const acts = commonResourceActions<CaseRow>({ basePath: '/cases' });
    acts[0].execute({ id: 'C1', status: 'TIEP_NHAN' }, ctx);
    expect(ctx.navigate).toHaveBeenCalledWith('/cases/C1');
  });

  it('Edit action navigates to basePath/:id/edit on execute', () => {
    const ctx = makeCtx();
    const acts = commonResourceActions<CaseRow>({ basePath: '/cases' });
    acts[1].execute({ id: 'C2', status: 'TIEP_NHAN' }, ctx);
    expect(ctx.navigate).toHaveBeenCalledWith('/cases/C2/edit');
  });

  it('Delete action opens delete modal when canDelete returns null', () => {
    const ctx = makeCtx();
    const acts = commonResourceActions<CaseRow>({
      basePath: '/cases',
      canDelete: (r) => (r.status === 'TIEP_NHAN' ? null : 'wrong status'),
      resourceType: 'cases',
    });
    const del = acts[2];
    del.execute({ id: 'C3', status: 'TIEP_NHAN' }, ctx);
    expect(ctx.deleteModal.open).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'cases', recordId: 'C3' }),
    );
  });

  it('Delete action disabled returns reason when canDelete returns string', () => {
    const acts = commonResourceActions<CaseRow>({
      basePath: '/cases',
      canDelete: (r) => (r.status === 'TIEP_NHAN' ? null : 'Chỉ xóa khi Tiếp nhận'),
      resourceType: 'cases',
    });
    const del = acts[2];
    const reason = del.disabled?.({ id: 'C4', status: 'KET_THUC' }, makeCtx());
    expect(reason).toBe('Chỉ xóa khi Tiếp nhận');
  });

  it('Delete action visible filtered by perms.canDelete', () => {
    const acts = commonResourceActions<CaseRow>({
      basePath: '/cases',
      canDelete: () => null,
      resourceType: 'cases',
    });
    const del = acts[2];
    const ctxNoPerm = makeCtx({ perms: { canDelete: false } });
    expect(del.visible?.({ id: 'C', status: 'TIEP_NHAN' }, ctxNoPerm)).toBe(false);
  });

  it('Edit visible filtered by perms.canEdit', () => {
    const acts = commonResourceActions<CaseRow>({ basePath: '/cases' });
    const edit = acts[1];
    const ctxNoPerm = makeCtx({ perms: { canEdit: false } });
    expect(edit.visible?.({ id: 'C', status: 'TIEP_NHAN' }, ctxNoPerm)).toBe(false);
  });
});
