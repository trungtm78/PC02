import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { RoundHistory } from '../components/RoundHistory';
import type { WardDecision, WardRound, WardSnapshot } from '../types';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';

const snap: WardSnapshot = { caseType: 'INCIDENT', kind: 'NEW', summary: 'Mất xe máy', content: 'Nội dung', subjectsUnknown: true, subjects: [], proposedInvestigatorId: 'i1' };

function decision(over: Partial<WardDecision> = {}): WardDecision {
  return {
    id: 'd1',
    kind: 'RETURN',
    decidedAt: '2026-11-07T03:00:00.000Z',
    decidedById: 'u2',
    decidedBy: { id: 'u2', firstName: 'K', lastName: 'Đặng Văn' },
    reasonCode: null,
    reasonText: 'Thiếu biên bản khám nghiệm hiện trường',
    requirements: ['Bổ sung biên bản', 'Lấy lời khai'],
    assignedInvestigatorId: null,
    followUpUserId: null,
    followUpTeamId: null,
    revokedAt: null,
    revokedById: null,
    revokeReason: null,
    slipNumber: '0398/PYC-PC02-Đ1',
    slipIssuedAt: null,
    ...over,
  };
}

function round(sequence: number, submissionNo: number, status: WardRound['status'], snapshot: WardSnapshot, decisions: WardDecision[] = []): WardRound {
  return {
    id: `r${sequence}`,
    sequence,
    submissionNo,
    status,
    submittedAt: `2026-11-0${sequence + 4}T03:00:00.000Z`,
    submittedById: 'u1',
    submittedBy: { id: 'u1', firstName: 'G', lastName: 'Võ Thị' },
    snapshot,
    withdrawnAt: status === 'WITHDRAWN' ? '2026-11-06T03:00:00.000Z' : null,
    withdrawnById: null,
    decisions,
  };
}

const rounds = [
  round(1, 1, 'DECIDED', snap, [decision()]),
  round(2, 2, 'WITHDRAWN', { ...snap, summary: 'Rút' }),
  round(3, 2, 'PENDING', { ...snap, summary: 'Mất xe máy tại bãi', content: 'Nội dung đã bổ sung' }),
];

describe('the round history', () => {
  it('shows every round, newest first, with its number, who submitted it and how it ended', () => {
    render(<RoundHistory rounds={rounds} />);
    const items = screen.getAllByTestId(/^ward-round-r\d$/);
    expect(items.map((i) => i.dataset.testid)).toEqual(['ward-round-r3', 'ward-round-r2', 'ward-round-r1']);
    expect(within(items[0]).getByText(L.rounds.pending)).toBeInTheDocument();
    expect(within(items[0]).getByText(/Võ Thị G/)).toBeInTheDocument();
    expect(within(items[1]).getByText(L.rounds.withdrawn)).toBeInTheDocument();
    expect(within(items[2]).getByText(L.rounds.round(1))).toBeInTheDocument();
  });

  it('shows a decision with its kind, reason, numbered requirements, who and the slip number', () => {
    render(<RoundHistory rounds={rounds} />);
    const d = screen.getByTestId('ward-decision-d1');
    expect(d).toHaveTextContent(L.rounds.decision.RETURN);
    expect(d).toHaveTextContent('Thiếu biên bản khám nghiệm hiện trường');
    expect(d).toHaveTextContent('Đặng Văn K');
    expect(d).toHaveTextContent('Phiếu 0398/PYC-PC02-Đ1');
    expect(within(d).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Bổ sung biên bản', 'Lấy lời khai']);
  });

  it('a revoked decision says so, with the reason it was revoked', () => {
    render(<RoundHistory rounds={[round(1, 1, 'DECIDED', snap, [decision({ revokedAt: '2026-11-08T00:00:00Z', revokeReason: 'Trả nhầm' })])]} />);
    expect(screen.getByTestId('ward-decision-d1')).toHaveTextContent(L.rounds.revoked);
    expect(screen.getByTestId('ward-decision-d1')).toHaveTextContent('Trả nhầm');
  });

  it('"compared with the previous submission" lists the changed fields against the last round PC02 saw', () => {
    render(<RoundHistory rounds={rounds} />);
    const r3 = screen.getByTestId('ward-round-r3');
    fireEvent.click(within(r3).getByTestId('ward-round-compare-r3'));
    const diff = within(r3).getByTestId('ward-round-diff-r3');
    expect(diff).toHaveTextContent(L.rounds.changedCount(2));
    // Against round 1 (round 2 was withdrawn): summary and content changed.
    expect(diff).toHaveTextContent(L.form.fields.summary);
    expect(diff).toHaveTextContent('Mất xe máy');
    expect(diff).toHaveTextContent('Mất xe máy tại bãi');
    expect(diff).toHaveTextContent(L.form.fields.content);
    expect(diff).not.toHaveTextContent('Rút');
  });

  it('words a value through the resolver it is given (names for ids)', () => {
    const changed = [round(1, 1, 'DECIDED', snap), round(2, 2, 'PENDING', { ...snap, proposedInvestigatorId: 'i2' })];
    render(<RoundHistory rounds={changed} describe={(field, v) => (field === 'proposedInvestigatorId' ? `ĐTV ${String(v)}` : null)} />);
    fireEvent.click(screen.getByTestId('ward-round-compare-r2'));
    expect(screen.getByTestId('ward-round-diff-r2')).toHaveTextContent('ĐTV i1');
    expect(screen.getByTestId('ward-round-diff-r2')).toHaveTextContent('ĐTV i2');
  });

  it('a change of a subject’s address alone shows the addresses before and after', () => {
    const a = { ...snap, subjectsUnknown: false, subjects: [{ fullName: 'Trần Thị B', birthYear: 1992, idNumber: null, address: 'Quận 1' }] };
    const b = { ...a, subjects: [{ ...a.subjects[0], address: 'Quận 3' }] };
    render(<RoundHistory rounds={[round(1, 1, 'DECIDED', a), round(2, 2, 'PENDING', b)]} />);
    fireEvent.click(screen.getByTestId('ward-round-compare-r2'));
    const diff = screen.getByTestId('ward-round-diff-r2');
    expect(diff).toHaveTextContent('Quận 1');
    expect(diff).toHaveTextContent('Quận 3');
  });

  it('the first round has nothing to compare with', () => {
    render(<RoundHistory rounds={[round(1, 1, 'PENDING', snap)]} />);
    expect(screen.queryByTestId('ward-round-compare-r1')).not.toBeInTheDocument();
  });

  it('says when there is no round yet', () => {
    render(<RoundHistory rounds={[]} />);
    expect(screen.getByText(L.rounds.none)).toBeInTheDocument();
  });
});
