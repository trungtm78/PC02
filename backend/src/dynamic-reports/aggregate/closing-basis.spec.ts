import { closingBasis, describeExcluded, totalsNote } from './closing-basis';

const team = (name: string, state: string | null, obligation = 'REQUIRED') => ({
  teamId: `id-${name}`,
  obligation,
  teamSnapshot: { name },
  submission: state ? { state } : null,
});

describe('closingBasis', () => {
  it('counts only APPROVED teams in the official numbers; every other required team is left out, with why', () => {
    const basis = closingBasis([
      team('Đội 1', 'APPROVED'),
      team('Đội 2', 'SUBMITTED'),
      team('Đội 3', 'RETURNED'),
      team('Đội 4', 'DRAFT'),
      team('Đội 5', null),
    ]);
    expect(basis.requiredCount).toBe(5);
    expect(basis.approved.map((t) => t.name)).toEqual(['Đội 1']);
    expect(describeExcluded(basis.excluded)).toBe(
      'Đội 2 (đã nộp, chưa duyệt); Đội 3 (đang bị trả lại); Đội 4 (đang nhập, chưa nộp); Đội 5 (chưa nhập)',
    );
  });

  it('a team that is exempt is neither counted nor left out', () => {
    const basis = closingBasis([team('Đội 1', 'APPROVED'), team('Đội 2', 'NOT_STARTED', 'EXEMPT')]);
    expect(basis.requiredCount).toBe(1);
    expect(basis.excluded).toEqual([]);
  });

  it('falls back to the team id when the snapshot has no name', () => {
    const basis = closingBasis([{ teamId: 't9', obligation: 'REQUIRED', teamSnapshot: null, submission: { state: 'SUBMITTED' } }]);
    expect(basis.excluded[0].name).toBe('t9');
  });
});

describe('totalsNote', () => {
  it('says how many teams the totals come from and who is not in them', () => {
    const note = totalsNote(closingBasis([team('Đội 1', 'APPROVED'), team('Đội 2', 'SUBMITTED'), team('Đội 3', null)]));
    expect(note).toBe('Số liệu tổng hợp từ 1/3 tổ đã duyệt. Chưa tính: Đội 2 (đã nộp, chưa duyệt); Đội 3 (chưa nhập).');
  });

  it('says so when nobody is approved (the totals are blank, not zero)', () => {
    expect(totalsNote(closingBasis([team('Đội 1', 'SUBMITTED')]))).toContain('Chưa có tổ nào được duyệt');
  });

  it('is a short line when everyone is approved, and nothing at all when no team is required', () => {
    expect(totalsNote(closingBasis([team('Đội 1', 'APPROVED')]))).toBe('Số liệu tổng hợp từ 1/1 tổ đã duyệt.');
    expect(totalsNote(closingBasis([]))).toBe('');
  });
});
