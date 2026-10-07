import { CASE_CANONICAL_FIELD_REGISTRY } from './case-canonical-field-registry.generated';
import { laNgayThat } from '../common/validators/is-ngay-that.validator';
export { CASE_CANONICAL_FIELD_REGISTRY } from './case-canonical-field-registry.generated';

type Values = Record<string, unknown>;
const object = (value: unknown): Values =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Values)
    : {};
const own = (value: Values, key: string) =>
  Boolean(Object.prototype.hasOwnProperty.call(value, key));
const safe = (key: string) =>
  !['__proto__', 'prototype', 'constructor'].includes(key);
function readPath(record: Values, path: string): unknown {
  let value: unknown = record;
  for (const key of path.split('.')) {
    if (!safe(key) || !own(object(value), key)) return undefined;
    value = object(value)[key];
  }
  return value;
}
const supplemental = [
  ['caseTitle', 'name'],
  ['criminalType', 'crime'],
  ['investigationDeadline', 'deadline'],
  ['handler', 'investigatorId'],
  ['status', 'status'],
  ['assignedTeamId', 'assignedTeamId'],
  ['unit', 'unit'],
  ['caseProvenance', 'caseProvenance'],
  ['linkedPetitionId', 'linkedPetitionId'],
  ['linkedIncidentId', 'linkedIncidentId'],
  ['sourceDocumentNote', 'sourceDocumentNote'],
  ['deXuatXuLy', 'deXuat'],
  ['caseCode', 'caseCode'],
  ['receiveDate', 'receiveDate'],
  ['caseClassification', 'caseClassification'],
  ['tinhTrang', 'tinhTrang'],
  ['sttCu', 'sttCu'],
  ['soHoSoCu', 'soHoSoCu'],
  ['phanLoaiToiPhamLinhVuc', 'phanLoaiToiPhamLinhVuc'],
  ['yeuCauBoSung', 'yeuCauBoSung'],
  ['ngayVietDonEdtf', 'ngayVietDonEdtf'],
  ['ngayVietDonChu', 'ngayVietDonChu'],
  ['reporterDateOfBirth', 'reporterDateOfBirth'],
  ['reporterDateOfBirthPrecision', 'reporterDateOfBirthPrecision'],
].map(([key, column]) => ({ key, column }));
const fields: readonly { key: string; column: string }[] = [
  ...CASE_CANONICAL_FIELD_REGISTRY,
  ...supplemental,
];
const aliases: Record<string, readonly string[]> = {
  noiXayRa: ['specificAddress'],
  tenCungCap: ['reporter'],
  cccdCungCap: ['reporterIdNumber'],
  diaChiCungCap: ['reporterAddress'],
  'statistic.soTienBiThietHai': ['damageAmount'],
};
const dateColumns = new Set<string>([
  ...CASE_CANONICAL_FIELD_REGISTRY.filter((field) => field.kind === 'date').map(
    (field) => field.column,
  ),
  'deadline',
  'receiveDate',
  'reporterDateOfBirth',
  'ngayVietDonEdtf',
  'ngayVietDonChu',
]);
const completeDate = (value: unknown) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}/.test(value) &&
  Number(value.slice(0, 4)) > 0 &&
  laNgayThat(value);

export function normalizeCanonicalCaseWrite(
  input: Record<string, unknown>,
  existingMetadata?: unknown,
): Record<string, unknown> {
  const previous = object(existingMetadata);
  const incoming = object(input.metadata);
  const metadata = Object.fromEntries(
    Object.entries({ ...previous, ...incoming }).filter(([key]) => safe(key)),
  );
  // Only an explicit canonical write can revoke a durable clear. Incoming metadata cannot.
  const clears: Values = {
    ...object(incoming._canonicalClears),
    ...object(previous._canonicalClears),
  };
  const dateSources: Values = {
    ...object(incoming._canonicalDateSources),
    ...object(previous._canonicalDateSources),
  };
  for (const field of fields) {
    const value = readPath(input, field.column);
    if (
      (value !== undefined || clears[field.column] === true) &&
      dateColumns.has(field.column) &&
      !own(object(previous._canonicalDateSources), field.column)
    ) {
      const originals = [previous, incoming].flatMap((record) =>
        [field.key, field.column].map((alias) => ({
          value: own(record, alias) ? record[alias] : readPath(record, alias),
          source: `metadata.${alias}`,
        })),
      );
      const original = originals.find(
        (entry) =>
          entry.value !== undefined &&
          entry.value !== null &&
          entry.value !== '' &&
          !completeDate(entry.value),
      );
      if (original)
        dateSources[field.column] = { ...original, verification: 'unverified' };
    }
    const cleared =
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    if (value !== undefined) {
      if (cleared) clears[field.column] = true;
      else delete clears[field.column];
    }
    for (const alias of [
      field.key,
      field.column,
      ...(aliases[field.column] ?? []),
    ]) {
      if (clears[field.column] === true) delete metadata[alias];
      else if (value !== undefined && own(metadata, alias))
        metadata[alias] = value;
    }
    if (
      field.column.startsWith('statistic.') &&
      own(object(metadata.statistic), field.column.slice(10))
    ) {
      const nested = { ...object(metadata.statistic) };
      if (clears[field.column] === true) delete nested[field.column.slice(10)];
      else if (value !== undefined) nested[field.column.slice(10)] = value;
      metadata.statistic = nested;
    }
  }
  metadata._canonicalClears = Object.fromEntries(
    Object.entries(clears).filter(
      ([key, value]) => safe(key) && value === true,
    ),
  );
  if (Object.keys(dateSources).length)
    metadata._canonicalDateSources = dateSources;
  return { ...input, metadata };
}
