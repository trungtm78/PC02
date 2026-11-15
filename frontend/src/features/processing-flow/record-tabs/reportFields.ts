/** The fields of a report form and what is sent from them (no JSX here, so the form file exports only a component). */
import type { DocumentRef, ReportDto, ReportFields, ReportKind } from './types';

export interface DocRow {
  type: string;
  number: string;
  date: string;
}

export interface ReportFormState {
  kind: ReportKind;
  doneWork: string;
  findings: string;
  difficulties: string;
  proposalKind: string;
  proposalContent: string;
  proposalBasis: string;
  documents: DocRow[];
}

export const EMPTY_REPORT: ReportFormState = { kind: 'PROGRESS', doneWork: '', findings: '', difficulties: '', proposalKind: '', proposalContent: '', proposalBasis: '', documents: [] };

export function reportStateOf(report: ReportDto): ReportFormState {
  return {
    kind: report.kind === 'RESULT' ? 'RESULT' : 'PROGRESS',
    doneWork: report.doneWork,
    findings: report.findings ?? '',
    difficulties: report.difficulties ?? '',
    proposalKind: report.proposalKind ?? '',
    proposalContent: report.proposalContent ?? '',
    proposalBasis: report.proposalBasis ?? '',
    documents: (report.documents ?? []).map((d: DocumentRef) => ({ type: d.type ?? '', number: d.number ?? '', date: d.date ?? '' })),
  };
}

/** What is sent: only what the person filled in (an empty box is not sent), the documents with at least one field. */
export function reportFieldsOf(state: Pick<ReportFormState, 'doneWork' | 'findings' | 'difficulties' | 'proposalKind' | 'proposalContent' | 'proposalBasis' | 'documents'>, alwaysDocuments: boolean): ReportFields {
  const fields: ReportFields = { doneWork: state.doneWork.trim() };
  if (state.findings.trim()) fields.findings = state.findings.trim();
  if (state.difficulties.trim()) fields.difficulties = state.difficulties.trim();
  if (state.proposalKind) fields.proposalKind = state.proposalKind;
  if (state.proposalContent.trim()) fields.proposalContent = state.proposalContent.trim();
  if (state.proposalBasis.trim()) fields.proposalBasis = state.proposalBasis.trim();
  const documents = state.documents
    .map((d) => ({ type: d.type.trim(), number: d.number.trim(), date: d.date.trim() }))
    .filter((d) => d.type !== '' || d.number !== '' || d.date !== '');
  // A correction always says which documents remain, so that taking the last one off really removes it.
  if (documents.length > 0 || alwaysDocuments) fields.documents = documents;
  return fields;
}

