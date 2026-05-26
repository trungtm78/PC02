import { CaseStatus } from '@prisma/client';

/**
 * v0.31.0.2: response shape cho GET /cases/:id/delete-preflight.
 * v0.43: linkedIncidents moved from blockers → willUnlink (SetNull on delete, not blocker).
 * Frontend dùng để render blocker banner + willUnlink warning trước khi user nhập reason.
 */
export interface DeleteCasePreflightResponse {
  canDelete: boolean;
  status: CaseStatus;
  blockers: {
    subjects: number;
    lawyers: number;
    conclusions: number;
    documents: number;
  };
  willUnlink: {
    incidents: Array<{ id: string; code: string; name: string }>;
  };
  /** Vietnamese reasons khi canDelete=false. UI render list. */
  reasonsIfBlocked: string[];
}
