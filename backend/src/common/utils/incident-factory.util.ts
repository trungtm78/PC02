import { Prisma, CaseProvenance } from '@prisma/client';

interface IncidentFromCaseInput {
  rawName: string;
  meta: Record<string, unknown>;
  code: string;
  userId: string;
  investigatorId: string;
  assignedTeamId?: string;
}

export function buildIncidentFromCase(
  input: IncidentFromCaseInput,
): Prisma.IncidentUncheckedCreateInput {
  const { rawName, meta, code, userId, investigatorId, assignedTeamId } = input;

  const name = rawName.length >= 5 ? rawName : `Vụ việc - ${rawName}`;

  const parts: string[] = [];
  if (meta.incidentDescription) parts.push(String(meta.incidentDescription));
  if (meta.incidentCause) parts.push(`Nguyên nhân: ${meta.incidentCause}`);
  if (meta.incidentMethod) parts.push(`Phương thức: ${meta.incidentMethod}`);

  return {
    code,
    name,
    incidentType: meta.incidentType ? String(meta.incidentType) : undefined,
    fromDate: (() => {
      if (!meta.incidentDate) return undefined;
      const d = new Date(String(meta.incidentDate));
      return isNaN(d.getTime()) ? undefined : d;
    })(),
    diaChiXayRa: meta.incidentLocation
      ? String(meta.incidentLocation)
      : undefined,
    description: parts.length > 0 ? parts.join('\n\n') : undefined,
    deadline: null,
    canBoNhapId: userId,
    createdById: userId,
    investigatorId,
    assignedTeamId: assignedTeamId ?? null,
  };
}

const BRANCH3_PROVENANCES = new Set<string>([
  CaseProvenance.DIRECT_DISCOVERY,
  CaseProvenance.TRANSFERRED,
  CaseProvenance.SELF_SURRENDER,
  CaseProvenance.PROSECUTOR_PROPOSAL,
  CaseProvenance.OTHER_LEGAL_SOURCE,
]);

export function shouldAutoCreateIncident(
  provenance: string,
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!BRANCH3_PROVENANCES.has(provenance)) return false;
  const meta = metadata ?? {};
  return !!(
    meta.incidentDate ||
    meta.incidentType ||
    meta.incidentDescription ||
    meta.incidentLocation
  );
}
