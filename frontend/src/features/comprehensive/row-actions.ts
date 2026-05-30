import { Eye, Pencil, Trash2 } from 'lucide-react';
import {
  createRowActionRegistry,
  type RowAction,
} from '@/features/_shared/row-actions/registry';

/**
 * v0.66 PR4 — Comprehensive (polyglot 3-entity view) per-row actions.
 *
 * Rows carry recordType: 'CASE' | 'INCIDENT' | 'PETITION'. Actions dispatch
 * navigation + delete endpoint per type.
 *
 * Differs from Cases/Incidents/Petitions registries: actions are entity-aware
 * via row.recordType, not entity-specific registries.
 *
 * See docs/audit/shell-parity-matrix.md Comprehensive section.
 */

export type ComprehensiveRecordType = 'CASE' | 'INCIDENT' | 'PETITION';

export interface ComprehensiveRowForActions {
  id: string;
  recordType: ComprehensiveRecordType;
  caseNumber?: string;
  name?: string;
  updatedAt?: string;
}

const ROUTE_BY_TYPE: Record<ComprehensiveRecordType, string> = {
  CASE: '/cases',
  INCIDENT: '/incidents',
  PETITION: '/petitions',
};

const DELETE_RESOURCE_BY_TYPE: Record<
  ComprehensiveRecordType,
  'cases' | 'incidents' | 'petitions'
> = {
  CASE: 'cases',
  INCIDENT: 'incidents',
  PETITION: 'petitions',
};

const comprehensive = createRowActionRegistry<ComprehensiveRowForActions>();

const actions: RowAction<ComprehensiveRowForActions>[] = [
  {
    key: 'view',
    label: 'Xem chi tiết',
    icon: Eye,
    position: 'inline',
    execute: (row, ctx) => ctx.navigate(`${ROUTE_BY_TYPE[row.recordType]}/${row.id}`),
    testid: 'btn-view',
  },
  {
    key: 'edit',
    label: 'Chỉnh sửa',
    icon: Pencil,
    position: 'inline',
    visible: (_row, ctx) => ctx.perms.canEdit !== false,
    execute: (row, ctx) => ctx.navigate(`${ROUTE_BY_TYPE[row.recordType]}/${row.id}/edit`),
    testid: 'btn-edit',
  },
  {
    key: 'delete',
    label: 'Xóa',
    icon: Trash2,
    position: 'menu',
    danger: true,
    visible: (_row, ctx) => ctx.perms.canDelete !== false,
    execute: (row, ctx) =>
      ctx.deleteModal.open({
        resourceType: DELETE_RESOURCE_BY_TYPE[row.recordType],
        recordId: row.id,
        recordLabel: row.caseNumber ?? row.name,
      }),
    testid: 'btn-delete',
  },
];

comprehensive.registerMany(actions);

export const comprehensiveRowActions = comprehensive;
