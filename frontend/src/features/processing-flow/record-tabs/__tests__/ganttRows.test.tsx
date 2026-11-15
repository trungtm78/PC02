import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GanttChart } from '../../components/GanttChart';
import { recordGantt } from '../ganttRows';
import { recFlow, recStep } from './fixtures';

const flow = recFlow({}, [
  recStep({ stepKey: 'a', name: 'Tiếp nhận', status: 'DONE', doneAt: '2026-12-03T03:00:00.000Z', startAt: '2026-12-01T00:00:00.000Z', dueAt: '2026-12-05T00:00:00.000Z', regulatoryDueAt: '2026-12-05T00:00:00.000Z' }),
  recStep({ stepKey: 'b', name: 'Xác minh', setsRecordDeadline: true, internalDueAt: '2026-12-16T00:00:00.000Z', dueAt: '2026-12-16T00:00:00.000Z' }),
  recStep({ stepKey: 'c', name: 'Chờ', status: 'WAITING_ANCHOR', startAt: null, dueAt: null, regulatoryDueAt: null }),
  recStep({ stepKey: 'd', name: 'Bỏ', status: 'SKIPPED', skippedAt: '2026-12-02T00:00:00.000Z' }),
]);

describe('the flow of a record as the rows of the Gantt chart', () => {
  const g = recordGantt(flow, new Date('2026-12-10T05:00:00.000Z'));

  it('takes the instants the server computed, and draws no bar for a step that waits or was skipped', () => {
    expect(g.data.steps.map((r) => [r.stepKey, r.startAt !== null, r.dueAt !== null])).toEqual([
      ['a', true, true],
      ['b', true, true],
      ['c', false, false],
      ['d', false, false],
    ]);
    expect(g.data.steps[1]).toMatchObject({ greenFrom: '2026-12-13T00:00:00.000Z', yellowFrom: '2026-12-17T00:00:00.000Z', redFrom: '2026-12-19T00:00:00.000Z' });
  });

  it('draws the record deadline from the regulatory deadline of the step that sets it', () => {
    expect(g.data.recordDeadline).toBe('2026-12-20T00:00:00.000Z');
  });

  it('marks finished, skipped and waiting steps, and keeps the regulatory deadline behind an earlier target', () => {
    expect(g.extras.rows?.[0]).toMatchObject({ label: '✔ 1. Tiếp nhận', done: true });
    expect(g.extras.rows?.[1]).toMatchObject({ regulatoryAt: '2026-12-20T00:00:00.000Z' });
    expect(g.extras.rows?.[3]?.label).toBe('4. Bỏ (bỏ qua)');
    expect(g.extras.rows?.[2]?.note).toBe('chờ mốc');
  });
});

describe('the chart with the extras of a record', () => {
  it('draws the line of today inside the axis, with its date', () => {
    const g = recordGantt(flow, new Date('2026-12-10T05:00:00.000Z'));
    render(<GanttChart steps={g.steps} data={g.data} extras={g.extras} />);
    expect(screen.getByTestId('gantt-today')).toHaveTextContent('hôm nay 10/12/2026');
    expect(screen.getByTestId('gantt-seg-0-base').className).toContain('bg-slate-300');
    expect(screen.getByTestId('gantt-seg-1-red').className).toContain('bg-red-600');
  });

  it('draws no line of today when today is outside the axis', () => {
    const g = recordGantt(flow, new Date('2027-06-01T00:00:00.000Z'));
    render(<GanttChart steps={g.steps} data={g.data} extras={g.extras} />);
    expect(screen.queryByTestId('gantt-today')).toBeNull();
  });

  it('without extras the chart of the flow settings is drawn exactly as before (no line, no gap)', () => {
    const g = recordGantt(flow);
    render(<GanttChart steps={g.steps} data={g.data} />);
    expect(screen.queryByTestId('gantt-today')).toBeNull();
    expect(screen.queryByTestId('gantt-gap-1')).toBeNull();
    expect(screen.getByTestId('gantt-problem-2')).toHaveTextContent(/không vẽ được/);
  });
});
