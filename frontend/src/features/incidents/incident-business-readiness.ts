import { INCIDENT_VALID_TRANSITIONS } from "@/shared/enums/incident-transitions.generated";

export function canProsecuteIncident(record: {
  status: string;
  intakeStage?: string | null;
}): boolean {
  const transitions = INCIDENT_VALID_TRANSITIONS as Record<
    string,
    readonly string[]
  >;
  return (
    (!record.intakeStage || record.intakeStage === "DA_NHAN") &&
    (transitions[record.status]?.includes("DA_CHUYEN_VU_AN") ?? false)
  );
}
