import { ngayVN } from '../common/xuat-danh-sach/dinh-dang';
import type { KhaiCotXuat } from '../common/xuat-danh-sach/xuat-danh-sach';

/** A row of the list as the Excel export reads it (the same columns as the screen). */
export interface WardExportRow {
  id: string;
  code: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED';
  archivedAt: Date | null;
  submissionCount: number;
  submittedAt: Date | null;
  caseType: 'INCIDENT' | 'CASE';
  kind: 'NEW' | 'REASSIGN';
  crimeOther: string | null;
  summary: string;
  place: string | null;
  entryOfficerName: string;
  resultDueOn: Date | null;
  assignedTeam: { name: string } | null;
  crime: { name: string } | null;
}

/** The words of the screen (`frontend/src/locales/wardAssignments.vi.ts`): a file exported reads as the list does. */
export const WARD_STATUS_LABEL: Record<WardExportRow['status'], string> = { DRAFT: 'Nháp', SUBMITTED: 'Chờ duyệt', RETURNED: 'Trả về', APPROVED: 'Đã duyệt' };
export const WARD_CASE_TYPE_LABEL: Record<WardExportRow['caseType'], string> = { INCIDENT: 'Vụ việc', CASE: 'Vụ án' };
export const WARD_KIND_LABEL: Record<WardExportRow['kind'], string> = { NEW: 'Mới', REASSIGN: 'Lại' };

/** "Tình trạng" as the list shows it: archived, submitted again after a return, or the status. */
export function wardDisplayStatus(row: Pick<WardExportRow, 'status' | 'archivedAt' | 'submissionCount'>): string {
  if (row.archivedAt) return 'Lưu trữ';
  if (row.status === 'SUBMITTED' && row.submissionCount > 1) return 'Trình lại chờ duyệt';
  return WARD_STATUS_LABEL[row.status];
}

/** What the export reads of a request: exactly what the columns below print. */
export const WARD_EXPORT_SELECT = {
  id: true,
  code: true,
  status: true,
  archivedAt: true,
  submissionCount: true,
  submittedAt: true,
  caseType: true,
  kind: true,
  crimeOther: true,
  summary: true,
  place: true,
  entryOfficerName: true,
  resultDueOn: true,
  assignedTeam: { select: { name: true } },
  crime: { select: { name: true } },
} as const;

/**
 * The columns of the Excel export of the list. `key` is the key of the column on `WardAssignmentListPage` (the gate
 * `khaiCotXuat.gate` compares the two sets), so "the columns shown" means one thing on both sides.
 */
export const KHAI_COT_XUAT_HO_SO_PHAN_CONG: readonly KhaiCotXuat<WardExportRow>[] = [
  { key: 'code', tieuDe: 'Mã', rong: 12, doc: (d) => d.code ?? '' },
  { key: 'submittedAt', tieuDe: 'Ngày trình', rong: 13, doc: (d) => ngayVN(d.submittedAt) },
  { key: 'unit', tieuDe: 'Đơn vị', rong: 26, doc: (d) => d.assignedTeam?.name ?? '' },
  { key: 'caseType', tieuDe: 'Loại hồ sơ', rong: 12, doc: (d) => WARD_CASE_TYPE_LABEL[d.caseType] },
  { key: 'kind', tieuDe: 'Phân công', rong: 11, doc: (d) => WARD_KIND_LABEL[d.kind] },
  { key: 'crime', tieuDe: 'Tội danh', rong: 28, doc: (d) => d.crime?.name ?? d.crimeOther ?? '' },
  { key: 'summary', tieuDe: 'Trích yếu', rong: 44, doc: (d) => d.summary },
  { key: 'status', tieuDe: 'Tình trạng', rong: 18, doc: (d) => wardDisplayStatus(d) },
  { key: 'submissionCount', tieuDe: 'Lần trình', rong: 10, doc: (d) => d.submissionCount },
  { key: 'resultDueOn', tieuDe: 'Hạn báo kết quả', rong: 15, doc: (d) => ngayVN(d.resultDueOn) },
  { key: 'place', tieuDe: 'Nơi xảy ra', rong: 28, doc: (d) => d.place ?? '' },
  { key: 'entryOfficerName', tieuDe: 'Cán bộ nhập', rong: 22, doc: (d) => d.entryOfficerName },
];
