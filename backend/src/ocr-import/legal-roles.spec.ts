import { PERSON_ROLES } from './evidence/evidence.schema';
import { subjectTypeFor } from './legal-roles';

describe('subjectTypeFor (role in the paperwork -> procedural status of a subject)', () => {
  const none = { prosecutionDecisionQuoted: false };
  const decided = { prosecutionDecisionQuoted: true };

  it('an accused person is never made a suspect by the complaint alone', () => {
    expect(subjectTypeFor('ACCUSED', none)).toBeNull();
  });

  it('an accused person becomes a suspect only when a prosecution decision is quoted', () => {
    expect(subjectTypeFor('ACCUSED', decided)).toBe('SUSPECT');
  });

  it('victims and witnesses map directly', () => {
    expect(subjectTypeFor('VICTIM', none)).toBe('VICTIM');
    expect(subjectTypeFor('WITNESS', none)).toBe('WITNESS');
  });

  it('the complainant and the agencies are not case subjects', () => {
    for (const role of [
      'COMPLAINANT',
      'FORWARDING_AGENCY',
      'RECEIVING_AGENCY',
      'SIGNATORY',
    ] as const) {
      expect(subjectTypeFor(role, none)).toBeNull();
      expect(subjectTypeFor(role, decided)).toBeNull();
    }
  });

  it('covers every role the evidence schema can produce, so a new role forces a decision here', () => {
    for (const role of PERSON_ROLES) {
      expect(() => subjectTypeFor(role, none)).not.toThrow();
    }
  });

  it('a decision never turns a victim or witness into a suspect', () => {
    expect(subjectTypeFor('VICTIM', decided)).toBe('VICTIM');
    expect(subjectTypeFor('WITNESS', decided)).toBe('WITNESS');
  });
});
