import { CaseStatus } from '@prisma/client';

/**
 * v0.31.0.2: response shape cho GET /cases/:id/delete-preflight.
 * Frontend dùng để render blocker banner + disable submit trước khi user nhập reason.
 */
export interface DeleteCasePreflightResponse {
  canDelete: boolean;
  status: CaseStatus;
  blockers: {
    subjects: number;
    lawyers: number;
    conclusions: number;
    documents: number;
    linkedIncidents: number;
  };
  /** Vietnamese reasons khi canDelete=false. UI render list. */
  reasonsIfBlocked: string[];
}
