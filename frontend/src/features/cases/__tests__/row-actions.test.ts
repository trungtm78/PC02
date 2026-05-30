import { describe, it, expect, vi } from 'vitest';
import { casesRowActions, type CaseRowForActions } from '../row-actions';
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

describe('casesRowActions registry', () => {
  it('registers 8 actions total (View, Edit, Delete, Assign, 2x Manage, Conclusion, Transfer)', () => {
    const keys = casesRowActions.all().map((a) => a.key);
    expect(keys).toEqual([
      'view',
      'edit',
      'delete',
      'assign',
      'manage-defendants',
      'manage-lawyers',
      'conclusion',
      'transfer',
    ]);
  });

  it('Phân công hidden when canDispatch=false', () => {
    const assign = casesRowActions.all().find((a) => a.key === 'assign')!;
    const row: CaseRowForActions = { id: 'C1', status: 'TIEP_NHAN' };
    expect(assign.visible?.(row, makeCtx({ perms: { canDispatch: false } }))).toBe(false);
  });

  it('Phân công opens AssignModal with resourceType=cases', () => {
    const assign = casesRowActions.all().find((a) => a.key === 'assign')!;
    const ctx = makeCtx();
    const row: CaseRowForActions = {
      id: 'C2',
      status: 'TIEP_NHAN',
      assignedTeamId: 'T7',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    assign.execute(row, ctx);
    expect(ctx.assignModal.open).toHaveBeenCalledWith({
      resourceType: 'cases',
      recordId: 'C2',
      currentTeamId: 'T7',
      currentUpdatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('Delete disabled when status != TIEP_NHAN, with reason', () => {
    const del = casesRowActions.all().find((a) => a.key === 'delete')!;
    const reason = del.disabled?.({ id: 'C', status: 'DANG_XAC_MINH' }, makeCtx());
    expect(reason).toBe('Chỉ xóa được khi trạng thái = Tiếp nhận');
  });

  it('Delete enabled when status = TIEP_NHAN', () => {
    const del = casesRowActions.all().find((a) => a.key === 'delete')!;
    expect(del.disabled?.({ id: 'C', status: 'TIEP_NHAN' }, makeCtx())).toBeNull();
  });

  it('Manage defendants navigates to /cases/:id?tab=defendants', () => {
    const md = casesRowActions.all().find((a) => a.key === 'manage-defendants')!;
    const ctx = makeCtx();
    md.execute({ id: 'C3', status: 'TIEP_NHAN' }, ctx);
    expect(ctx.navigate).toHaveBeenCalledWith('/cases/C3?tab=defendants');
  });

  it('Transfer navigates to /transfer-return?caseId=:id', () => {
    const tr = casesRowActions.all().find((a) => a.key === 'transfer')!;
    const ctx = makeCtx();
    tr.execute({ id: 'C4', status: 'TIEP_NHAN' }, ctx);
    expect(ctx.navigate).toHaveBeenCalledWith('/transfer-return?caseId=C4');
  });
});
