/**
 * What a period's official figures ("số chốt") are made of. They count the teams that are APPROVED and nothing else
 * (design D03: SUBMITTED is the default view of the screen, APPROVED is the figure that is closed). A team that has
 * only submitted, was sent back, is still typing or never started is left out — and a manager who closes the period
 * must be told so, because the screen's default view still shows the submitted teams' numbers.
 *
 * Found on production (13/10/2026): a period was closed with one team submitted and none approved; the screen said 120,
 * the closed period and its Excel TỔNG said nothing at all.
 */
/** The modes of the aggregate screen (D03). The closed period's official figures are always APPROVED. */
export type BasisMode = 'APPROVED' | 'SUBMITTED' | 'ALL_SAVED';

/** Which states put a team's figures in the totals under each mode: the very lists `computeApprovedSnapshot` adds up. */
const COUNTED_STATES: Record<BasisMode, readonly string[]> = {
  APPROVED: ['APPROVED'],
  SUBMITTED: ['SUBMITTED', 'APPROVED'],
  ALL_SAVED: ['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED'],
};

/** "tổ ___" in the sentence that says what the totals are made of. */
const COUNTED_WORDS: Record<BasisMode, string> = {
  APPROVED: 'đã duyệt',
  SUBMITTED: 'đã nộp hoặc đã duyệt',
  ALL_SAVED: 'đã có bản lưu (kể cả đang nhập)',
};

/** "Chưa có tổ nào ___ nên các ô tổng để trống." */
const NOBODY_WORDS: Record<BasisMode, string> = {
  APPROVED: 'được duyệt',
  SUBMITTED: 'nộp hoặc được duyệt',
  ALL_SAVED: 'có bản lưu',
};

export interface BasisAssignment {
  teamId: string;
  obligation: string;
  teamSnapshot: unknown;
  submission?: { state: string } | null;
}

export interface BasisTeam {
  teamId: string;
  name: string;
  state: string;
}

export interface ClosingBasis {
  mode: BasisMode;
  requiredCount: number;
  approved: BasisTeam[];
  /** Required teams whose figures are NOT in the official numbers, in the order they were given. */
  excluded: BasisTeam[];
}

const STATE_WORDS: Record<string, string> = {
  SUBMITTED: 'đã nộp, chưa duyệt',
  RETURNED: 'đang bị trả lại',
  DRAFT: 'đang nhập, chưa nộp',
  NOT_STARTED: 'chưa nhập',
};

export function closingBasis(assignments: readonly BasisAssignment[], mode: BasisMode = 'APPROVED'): ClosingBasis {
  const approved: BasisTeam[] = [];
  const excluded: BasisTeam[] = [];
  let requiredCount = 0;
  for (const a of assignments) {
    if (a.obligation !== 'REQUIRED') continue;
    requiredCount++;
    const name = (a.teamSnapshot as { name?: string } | null)?.name || a.teamId;
    const state = a.submission?.state ?? 'NOT_STARTED';
    (COUNTED_STATES[mode].includes(state) ? approved : excluded).push({ teamId: a.teamId, name, state });
  }
  return { mode, requiredCount, approved, excluded };
}

/**
 * The sentence shown to the manager, and the very text they send back to say "yes, with this". Binding the acknowledgement
 * to it means a team approved, unapproved or added while the question was open changes the sentence, so the old "yes" no
 * longer matches and the manager is asked again with what is true now.
 */
export function excludedMessage(basis: ClosingBasis): string {
  return (
    `Số chốt chỉ tính ${basis.approved.length}/${basis.requiredCount} tổ đã duyệt. ` +
    `Số liệu của các tổ sau KHÔNG nằm trong số chốt: ${describeExcluded(basis.excluded)}.`
  );
}

export function describeExcluded(excluded: readonly BasisTeam[]): string {
  return excluded.map((t) => `${t.name} (${STATE_WORDS[t.state] ?? t.state})`).join('; ');
}

/**
 * The line written under the totals in the Excel file, so nobody reads a total as more than it is. `formulas`: the file's
 * totals are formulas over the sheets of the approved teams (the template-shaped file), not plain figures (the plain list).
 */
export function totalsNote(basis: ClosingBasis, formulas = false): string {
  if (basis.requiredCount === 0) return '';
  // Not the closed figures: said first, so a provisional total is never taken for the official one.
  const provisional = basis.mode === 'APPROVED' ? '' : 'TẠM TÍNH, chưa phải số chốt. ';
  if (basis.approved.length === 0) {
    return `${provisional}Chưa có tổ nào ${NOBODY_WORDS[basis.mode]} nên các ô tổng để trống. Chưa tính: ${describeExcluded(basis.excluded)}.`;
  }
  const head = `${provisional}Số liệu tổng hợp từ ${basis.approved.length}/${basis.requiredCount} tổ ${COUNTED_WORDS[basis.mode]}.`;
  const tail = formulas ? ' Các ô tổng là công thức cộng từ sheet của những tổ này: sửa số ở sheet tổ thì TỔNG tự tính lại.' : '';
  return basis.excluded.length === 0
    ? `${head}${tail}`
    : `${head} Chưa tính: ${describeExcluded(basis.excluded)}.${tail}`;
}
