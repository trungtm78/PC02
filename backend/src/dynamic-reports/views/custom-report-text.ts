import type { SummaryMode } from '../aggregate/contributors';

/**
 * The words of a custom report's FILE, in one place.
 *
 * The file is a document sent to people: its Vietnamese text is its content, not interface text. The screen does not
 * use these: it is sent the structured data (counts, names, codes) and words it from its own locale file.
 */
export type CustomCellMark = 'NOT_ASSIGNED' | 'EXEMPT' | 'NOT_COUNTED' | 'BLANK' | 'NOT_AGGREGATED';

export type CustomNote =
  | { code: 'PERIOD_OPEN'; params: { mode: SummaryMode } }
  | { code: 'GROUP_INCLUDES_UNLISTED'; params: { code: string | null; label: string; listed: number; total: number } }
  | { code: 'ITEM_KEYS_IGNORED'; params: { count: number } }
  | { code: 'TEAMS_IGNORED'; params: { count: number } };

/** How many team names the filter line spells out before it says "and N more". */
const FILTER_LINE_MAX_NAMES = 6;

const MODE: Record<SummaryMode, string> = {
  SUBMITTED: 'đã nộp + đã duyệt',
  APPROVED: 'đã duyệt',
  ALL_SAVED: 'mọi số đã lưu (kể cả chưa nộp)',
};

export const CUSTOM_REPORT_TEXT = {
  sheetName: 'Báo cáo',
  noteHeading: 'Ghi chú:',
  headers: { code: 'Mã', label: 'Tiêu chí', unit: 'ĐVT', total: 'Tổng' },

  autoTitle: (reportName: string, periodKey: string): string => `${reportName} — kỳ ${periodKey}`,

  filterLine(input: {
    teamNames: readonly string[];
    teamsTotal: number;
    mode: SummaryMode;
  }): string {
    const { teamNames, teamsTotal } = input;
    let units: string;
    if (teamNames.length === teamsTotal) {
      units = `tất cả các tổ`;
    } else {
      const shown = teamNames.slice(0, FILTER_LINE_MAX_NAMES).join(', ');
      const more = teamNames.length - FILTER_LINE_MAX_NAMES;
      units = `${shown}${more > 0 ? ` và ${more} tổ khác` : ''}`;
    }
    return `Đơn vị: ${units} · Số liệu: ${MODE[input.mode]}`;
  },

  /** What a cell of the file shows for a mark. A blank stays an empty cell. */
  cellMark(mark: CustomCellMark, mode: SummaryMode): string | null {
    switch (mark) {
      case 'NOT_ASSIGNED':
        return '—';
      case 'EXEMPT':
        return 'miễn nộp';
      case 'NOT_COUNTED':
        return mode === 'APPROVED' ? 'chưa duyệt' : 'chưa nộp';
      case 'BLANK':
      case 'NOT_AGGREGATED':
        return null;
    }
  },

  note(note: CustomNote): string {
    switch (note.code) {
      case 'PERIOD_OPEN':
        return `Kỳ báo cáo chưa khoá sổ: số liệu là số tạm tính (${MODE[note.params.mode]}) và còn có thể thay đổi.`;
      case 'GROUP_INCLUDES_UNLISTED': {
        const name = [note.params.code, note.params.label].filter(Boolean).join(' ');
        return `Mục "${name}" là tổng của mọi tiêu chí con, kể cả những tiêu chí không được liệt kê trong báo cáo này.`;
      }
      case 'ITEM_KEYS_IGNORED':
        return `${note.params.count} tiêu chí đã chọn không còn trong mẫu của kỳ này nên không có trong báo cáo.`;
      case 'TEAMS_IGNORED':
        return `${note.params.count} tổ đã chọn không được giao báo cáo trong kỳ này nên không có trong báo cáo.`;
    }
  },
} as const;
