import type { PERSON_ROLES } from './evidence/evidence.schema';

export type PersonRole = (typeof PERSON_ROLES)[number];

/** Subject statuses a Case form accepts (`subjectTypeToEnum` in the frontend payload builder). */
export type SubjectType = 'SUSPECT' | 'VICTIM' | 'WITNESS';

export interface RoleContext {
  /** True only when a prosecution decision naming the person is quoted from the paperwork. */
  prosecutionDecisionQuoted: boolean;
}

/**
 * Maps a role in the paperwork to a procedural status.
 *
 * A complaint accuses; it does not make anyone a suspect. The frontend defaults an unknown subject type to
 * SUSPECT, so a careless mapping would silently turn an accusation into "Bị can". ACCUSED therefore maps to
 * SUSPECT only when a prosecution decision naming the person is quoted, and the officer still confirms it.
 *
 * The switch is exhaustive on purpose: adding a role to the evidence schema fails compilation here.
 */
export function subjectTypeFor(
  role: PersonRole,
  context: RoleContext,
): SubjectType | null {
  switch (role) {
    case 'ACCUSED':
      return context.prosecutionDecisionQuoted ? 'SUSPECT' : null;
    case 'VICTIM':
      return 'VICTIM';
    case 'WITNESS':
      return 'WITNESS';
    case 'COMPLAINANT':
    case 'FORWARDING_AGENCY':
    case 'RECEIVING_AGENCY':
    case 'SIGNATORY':
      return null;
    default: {
      const unreachable: never = role;
      throw new Error(`unhandled person role ${String(unreachable)}`);
    }
  }
}
