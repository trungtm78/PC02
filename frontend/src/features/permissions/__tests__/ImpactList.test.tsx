import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreviewBox } from '../components/ui';
import { permissions as L } from '@/locales/permissions.vi';
import { REACH, type PermissionDelta, type PreviewResult } from '../types';
import { INDEX } from './harness';

const PERMISSION = 'read:Case';
const result = (changed: PermissionDelta[], extra: Partial<PreviewResult['impacts'][number]> = {}): PreviewResult => ({
  people: 5,
  impacts: [{ userId: 'u1', name: 'Nguyễn Văn A', gained: [], lost: [], changed, ...extra }],
  teamNames: { a: 'Tổ A', b: 'Tổ B' },
});
const renderBox = (value: PreviewResult) => render(<PreviewBox result={value} index={INDEX} />);
const narrower = () => screen.queryByTestId(`authz-preview-narrower-u1-${PERMISSION}`);
const wider = () => screen.queryByTestId(`authz-preview-wider-u1-${PERMISSION}`);

/** The list of people a change touches: shared by the preview of a change and by the "Áp dụng" tab. */
describe('ImpactList (through PreviewBox)', () => {
  it('a permission kept at a narrower reach says so, even when no team is lost', () => {
    renderBox(result([{ permission: PERMISSION, before: REACH.TEAM_TREE, after: REACH.TEAM, narrower: true }]));
    const row = screen.getByTestId('authz-preview-person-u1');
    expect(row).toHaveTextContent(`${L.preview.changed}: ${L.preview.change('Vụ án · Xem', L.reaches.TEAM_TREE, L.reaches.TEAM)}`);
    expect(narrower()).toHaveTextContent(L.preview.narrower);
    expect(wider()).toBeNull();
  });

  it('a permission kept at a wider reach says so', () => {
    renderBox(result([{ permission: PERMISSION, before: REACH.TEAM, after: REACH.TEAM_TREE, wider: true }]));
    expect(wider()).toHaveTextContent(L.preview.wider);
    expect(narrower()).toBeNull();
  });

  it('narrower somewhere and wider elsewhere shows both, next to the teams gained and lost', () => {
    renderBox(result([{ permission: PERMISSION, before: REACH.TEAM, after: REACH.TEAM, teamsGained: ['b'], teamsLost: ['a'], narrower: true, wider: true }]));
    expect(narrower()).toHaveTextContent(L.preview.narrower);
    expect(wider()).toHaveTextContent(L.preview.wider);
    const row = screen.getByTestId('authz-preview-person-u1');
    expect(row).toHaveTextContent(L.preview.teamsGained('Tổ B'));
    expect(row).toHaveTextContent(L.preview.teamsLost('Tổ A'));
  });

  it('without the two flags there is no marker (also when they are false)', () => {
    renderBox(result([{ permission: PERMISSION, before: REACH.TEAM, after: REACH.TEAM, teamsLost: ['a'], narrower: false, wider: false }]));
    expect(narrower()).toBeNull();
    expect(wider()).toBeNull();
    expect(screen.getByTestId('authz-preview-person-u1')).toHaveTextContent(L.preview.teamsLost('Tổ A'));
  });

  it('the markers belong to "changed" only: a gained or lost entry never carries one', () => {
    renderBox(
      result([], {
        gained: [{ permission: PERMISSION, before: null, after: REACH.ALL, wider: true }],
        lost: [{ permission: 'delete:Petition', before: REACH.ALL, after: null, narrower: true }],
      }),
    );
    expect(screen.getByTestId('authz-preview-person-u1')).not.toHaveTextContent(L.preview.narrower);
    expect(screen.getByTestId('authz-preview-person-u1')).not.toHaveTextContent(L.preview.wider);
  });
});
