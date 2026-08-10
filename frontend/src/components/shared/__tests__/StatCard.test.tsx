/**
 * Three report pages each built this tile inline with
 * `` className={`text-${stat.color}-600`} ``. Tailwind's JIT compiler scans
 * source for complete class names, so a string assembled at runtime is never
 * in that scan: those classes were missing from the production stylesheet and
 * every KPI tile rendered colourless. It looked right in dev only because the
 * dev build is less aggressive — which is why nobody caught it.
 *
 * These tests assert the emitted class names literally, because that is the
 * only property that actually mattered.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard, type StatTone } from '../StatCard';

describe('StatCard', () => {
  it.each<[StatTone, string]>([
    ['blue', 'text-blue-600'],
    ['purple', 'text-purple-600'],
    ['red', 'text-red-600'],
    ['green', 'text-green-600'],
    ['amber', 'text-amber-600'],
    ['slate', 'text-slate-600'],
  ])('emits a literal class for tone %s', (tone, expected) => {
    render(<StatCard label="Tổng" value={7} tone={tone} testId="card" />);

    const value = screen.getByText('7');
    expect(value.className).toContain(expected);
    // The bug in one assertion: nothing interpolated survives to the DOM.
    expect(value.className).not.toContain('${');
  });

  it('hides the change badge when no change is supplied', () => {
    // The pages hardcoded "+12%" beside a real total. A number that never
    // moves still reads as a measurement, so no badge is better than a fake.
    render(<StatCard label="Tổng đơn thư" value={12} testId="card" />);

    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it('shows the change badge when one is supplied', () => {
    render(<StatCard label="Tổng" value={12} change="+4%" testId="card" />);

    expect(screen.getByText('+4%')).toBeInTheDocument();
  });

  it('falls back to the icon when there is no change to show', () => {
    render(
      <StatCard
        label="Quá hạn"
        value={3}
        icon={<span data-testid="icon" />}
        testId="card"
      />,
    );

    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('defaults to blue rather than rendering an unstyled tile', () => {
    render(<StatCard label="Tổng" value={1} testId="card" />);

    expect(screen.getByText('1').className).toContain('text-blue-600');
  });
});
