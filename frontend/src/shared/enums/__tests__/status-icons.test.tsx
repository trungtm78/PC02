import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  getCaseStatusIcon,
  getIncidentStatusIcon,
  getPetitionStatusIcon,
} from '../status-icons';
import { CaseStatus, IncidentStatus, PetitionStatus } from '../generated';

describe('status-icons', () => {
  describe('getCaseStatusIcon', () => {
    it('returns ReactNode for every valid CaseStatus', () => {
      for (const status of Object.values(CaseStatus)) {
        const icon = getCaseStatusIcon(status);
        // may be null — that is allowed — but must not throw
        if (icon !== null) {
          const { container } = render(<>{icon}</>);
          expect(container.firstChild).toBeTruthy();
        }
      }
    });

    it('returns null for unknown status', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getCaseStatusIcon('UNKNOWN_STATUS' as any)).toBeNull();
    });
  });

  describe('getIncidentStatusIcon', () => {
    it('returns ReactNode for every valid IncidentStatus', () => {
      for (const status of Object.values(IncidentStatus)) {
        const icon = getIncidentStatusIcon(status);
        if (icon !== null) {
          const { container } = render(<>{icon}</>);
          expect(container.firstChild).toBeTruthy();
        }
      }
    });

    it('returns null for unknown status', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getIncidentStatusIcon('UNKNOWN_STATUS' as any)).toBeNull();
    });
  });

  describe('getPetitionStatusIcon', () => {
    it('returns ReactNode for every valid PetitionStatus', () => {
      for (const status of Object.values(PetitionStatus)) {
        const icon = getPetitionStatusIcon(status);
        if (icon !== null) {
          const { container } = render(<>{icon}</>);
          expect(container.firstChild).toBeTruthy();
        }
      }
    });

    it('returns null for unknown status', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getPetitionStatusIcon('UNKNOWN_STATUS' as any)).toBeNull();
    });
  });
});
