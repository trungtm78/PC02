export const DOCUMENT_TYPES = [
  'INCIDENT',
  'PETITION',
  'CASE',
  'PROPOSAL',
  'DELEGATION',
  'EVIDENCE',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
