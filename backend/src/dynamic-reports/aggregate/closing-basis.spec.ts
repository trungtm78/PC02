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

describe('closingBasis by mode (an open period can be exported as the screen shows it)', () => {
  const teams = [
    team('Đội 1', 'APPROVED'),
    team('Đội 2', 'SUBMITTED'),
    team('Đội 3', 'DRAFT'),
    team('Đội 4', null),
    team('Đội 5', 'NOT_STARTED', 'EXEMPT'),
  ];
  const counted = (mode: 'APPROVED' | 'SUBMITTED' | 'ALL_SAVED') => closingBasis(teams, mode).approved.map((t) => t.name);

  it('counts the same states as the aggregate screen: approved; submitted + approved; every saved one', () => {
    expect(counted('APPROVED')).toEqual(['Đội 1']);
    expect(counted('SUBMITTED')).toEqual(['Đội 1', 'Đội 2']);
    expect(counted('ALL_SAVED')).toEqual(['Đội 1', 'Đội 2', 'Đội 3', 'Đội 4']);
  });

  it('a total that is not the closed figure says so first, and names the teams it counts', () => {
    const note = totalsNote(closingBasis(teams, 'SUBMITTED'));
    expect(note.startsWith('TẠM TÍNH, chưa phải số chốt.')).toBe(true);
    expect(note).toContain('từ 2/4 tổ đã nộp hoặc đã duyệt');
    expect(totalsNote(closingBasis(teams, 'APPROVED'))).not.toContain('TẠM TÍNH');
  });

  it('nobody submitted: the note says the totals are blank, in the mode\'s words', () => {
    expect(totalsNote(closingBasis([team('Đội 1', 'DRAFT')], 'SUBMITTED'))).toContain('Chưa có tổ nào nộp hoặc được duyệt');
  });
});

describe('totalsNote', () => {
  it('says how many teams the totals come from and who is not in them', () => {
    const note = totalsNote(closingBasis([team('Đội 1', 'APPROVED'), team('Đội 2', 'SUBMITTED'), team('Đội 3', null)]));
    expect(note).toBe('Số liệu tổng hợp từ 1/3 tổ đã duyệt. Chưa tính: Đội 2 (đã nộp, chưa duyệt); Đội 3 (chưa nhập).');
  });

  it('a file whose totals are formulas says so, and that editing a team sheet updates them; the plain list does not claim it', () => {
    const basis = closingBasis([team('Đội 1', 'APPROVED'), team('Đội 2', 'SUBMITTED')]);
    expect(totalsNote(basis, true)).toContain('công thức');
    expect(totalsNote(basis, true)).toContain('Chưa tính: Đội 2');
    expect(totalsNote(basis)).not.toContain('công thức');
  });

  it('the teams that count are named by id, so the export can line them up with its sheets', () => {
    const basis = closingBasis([team('Đội 1', 'APPROVED'), team('Đội 2', 'SUBMITTED')]);
    expect(basis.approved.map((t) => t.teamId)).toEqual(['id-Đội 1']);
  });

  it('says so when nobody is approved (the totals are blank, not zero)', () => {
    expect(totalsNote(closingBasis([team('Đội 1', 'SUBMITTED')]))).toContain('Chưa có tổ nào được duyệt');
  });

  it('is a short line when everyone is approved, and nothing at all when no team is required', () => {
    expect(totalsNote(closingBasis([team('Đội 1', 'APPROVED')]))).toBe('Số liệu tổng hợp từ 1/1 tổ đã duyệt.');
    expect(totalsNote(closingBasis([]))).toBe('');
  });
});
