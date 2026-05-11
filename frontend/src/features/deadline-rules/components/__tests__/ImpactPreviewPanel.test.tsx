import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImpactPreviewPanel } from '../ImpactPreviewPanel';

describe('ImpactPreviewPanel', () => {
  it('shows loading skeleton when isLoading=true', () => {
    render(<ImpactPreviewPanel impact={null} isLoading />);
    expect(screen.getByTestId('impact-loading')).toBeInTheDocument();
  });

  it('renders nothing when impact is null and not loading', () => {
    const { container } = render(<ImpactPreviewPanel impact={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders 3 bucket counts when impact is provided', () => {
    render(
      <ImpactPreviewPanel
        impact={{
          ruleKey: 'THOI_HAN_XAC_MINH',
          proposedValue: 25,
          effectiveFrom: '2026-06-01T00:00:00.000Z',
          counts: { notAffected: 10, openWillReextend: 5, futureAll: 0 },
          soonestIncidents: [],
          soonestPetitions: [],
        }}
      />,
    );
    expect(screen.getByTestId('impact-panel')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('hides "openWillReextend" bucket when count is 0', () => {
    render(
      <ImpactPreviewPanel
        impact={{
          ruleKey: 'THOI_HAN_TO_CAO',
          proposedValue: 30,
          effectiveFrom: null,
          counts: { notAffected: 12, openWillReextend: 0, futureAll: 0 },
          soonestIncidents: [],
          soonestPetitions: [],
        }}
      />,
    );
    // The amber/in-flight section should NOT render
    expect(screen.queryByText(/vụ việc đang mở/)).toBeNull();
  });

  it('lists soonest deadlines in expandable section', () => {
    render(
      <ImpactPreviewPanel
        impact={{
          ruleKey: 'THOI_HAN_XAC_MINH',
          proposedValue: 25,
          effectiveFrom: null,
          counts: { notAffected: 0, openWillReextend: 1, futureAll: 0 },
          soonestIncidents: [{ id: 'i1', code: 'VV-2026-001', deadline: '2026-06-01T00:00:00.000Z' }],
          soonestPetitions: [],
        }}
      />,
    );
    expect(screen.getByText(/VV VV-2026-001/)).toBeInTheDocument();
  });
});
