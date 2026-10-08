export interface CustodyHolder {
  kind: 'PERSON' | 'UNIT' | 'WAREHOUSE';
  identifier: string;
  name: string;
}
export interface CustodyState {
  holder: CustodyHolder | null;
  location: string | null;
  condition: string;
  conditionNote: string;
}
export interface CustodyFacts {
  fromHolder: CustodyHolder | null;
  toHolder: CustodyHolder;
  fromLocation: string | null;
  toLocation: string;
  condition: 'SEALED' | 'UNSEALED' | 'INTACT' | 'DAMAGED' | 'UNKNOWN';
  conditionNote: string;
  receiptDocumentId: string;
  receiptReference: string;
  correctionReason?: string;
}
import { BadRequestException, ConflictException } from '@nestjs/common';
import { canonicalJson } from '../governance/case-governance.contract';
function required(value: unknown, label: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new BadRequestException(`Actual custody ${label} required`);
  return value.trim();
}
function holder(value: unknown): CustodyHolder {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Actual custody holder required');
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).some(
      (key) => !['kind', 'identifier', 'name'].includes(key),
    ) ||
    !['PERSON', 'UNIT', 'WAREHOUSE'].includes(String(row.kind))
  )
    throw new BadRequestException('Typed custody holder required');
  return {
    kind: row.kind as CustodyHolder['kind'],
    identifier: required(row.identifier, 'holder identifier', 128),
    name: required(row.name, 'holder name', 200),
  };
}
export function validateCustodyFacts(
  eventType: string,
  value: unknown,
  previous: CustodyState | null,
): { facts: CustodyFacts; currentCustody: CustodyState } {
  if (
    !['RECEIPT', 'TRANSFER', 'INSPECTION', 'RELEASE', 'CORRECTION'].includes(
      eventType,
    )
  )
    throw new BadRequestException('Typed custody event required');
  canonicalJson(value);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Structured custody facts required');
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).some(
      (key) =>
        ![
          'fromHolder',
          'toHolder',
          'fromLocation',
          'toLocation',
          'condition',
          'conditionNote',
          'receiptDocumentId',
          'receiptReference',
          'correctionReason',
        ].includes(key),
    )
  )
    throw new BadRequestException('Unsupported custody fact');
  const fromHolder = row.fromHolder === null ? null : holder(row.fromHolder),
    toHolder = holder(row.toHolder),
    fromLocation =
      row.fromLocation === null
        ? null
        : required(row.fromLocation, 'from location'),
    toLocation = required(row.toLocation, 'to location');
  if (
    !['SEALED', 'UNSEALED', 'INTACT', 'DAMAGED', 'UNKNOWN'].includes(
      String(row.condition),
    )
  )
    throw new BadRequestException('Observed custody condition required');
  const facts: CustodyFacts = {
    fromHolder,
    toHolder,
    fromLocation,
    toLocation,
    condition: row.condition as CustodyFacts['condition'],
    conditionNote: required(row.conditionNote, 'condition note'),
    receiptDocumentId: required(
      row.receiptDocumentId,
      'source receipt document',
      128,
    ),
    receiptReference: required(
      row.receiptReference,
      'source receipt reference',
      200,
    ),
  };
  if (!previous?.holder && eventType !== 'RECEIPT')
    throw new ConflictException(
      'Unknown prior physical custodian: establish a sourced receipt',
    );
  if (
    canonicalJson(previous?.holder ?? null) !== canonicalJson(fromHolder) ||
    (previous?.location ?? null) !== fromLocation
  )
    throw new ConflictException(
      'From holder/location does not match current custody',
    );
  if (
    eventType === 'TRANSFER' &&
    canonicalJson(fromHolder) === canonicalJson(toHolder) &&
    fromLocation === toLocation
  )
    throw new BadRequestException(
      'Transfer requires actual holder or location change',
    );
  if (
    eventType === 'INSPECTION' &&
    (canonicalJson(fromHolder) !== canonicalJson(toHolder) ||
      fromLocation !== toLocation)
  )
    throw new BadRequestException(
      'Inspection cannot silently transfer custody',
    );
  if (eventType === 'CORRECTION')
    facts.correctionReason = required(
      row.correctionReason,
      'correction reason',
    );
  else if (row.correctionReason !== undefined)
    throw new BadRequestException(
      'Correction reason only allowed for correction',
    );
  return {
    facts,
    currentCustody: {
      holder: toHolder,
      location: toLocation,
      condition: facts.condition,
      conditionNote: facts.conditionNote,
    },
  };
}
