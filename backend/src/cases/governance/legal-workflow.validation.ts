import { BadRequestException } from '@nestjs/common';
import { canonicalJson } from './case-governance.contract';
export type JsonObject = Record<string, unknown>;
export function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Object required');
  canonicalJson(value);
  return value as JsonObject;
}
export function nonblank(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 10000)
    throw new BadRequestException(`${name} required`);
  return value.trim();
}
export function civilDate(value: unknown): Date {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('Complete YYYY-MM-DD date required');
  const date = new Date(value + 'T00:00:00.000Z');
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Invalid civil date');
  return date;
}
export function validateDecision(value: unknown) {
  const d = object(value);
  for (const field of ['dataQuality', 'dateQuality', 'effectiveDateQuality'])
    if (
      d[field] !== undefined &&
      d[field] !== 'VERIFIED' &&
      d[field] !== 'COMPLETE'
    )
      throw new BadRequestException(
        'Extracted, inferred or partial facts cannot establish a legal decision',
      );
  return {
    type: nonblank(d.type, 'Decision type'),
    number: nonblank(d.number, 'Decision number'),
    date: civilDate(d.date),
    effectiveDate: civilDate(d.effectiveDate),
    issuer: nonblank(d.issuer, 'Issuer'),
    signatory: nonblank(d.signatory, 'Signatory'),
    legalBasis: nonblank(d.legalBasis, 'Legal basis'),
    sourceDocumentId: nonblank(d.sourceDocumentId, 'Source document'),
  };
}
function pathParts(path: unknown): string[] {
  if (
    typeof path !== 'string' ||
    !/^(case|payload)\.[A-Za-z0-9_.]+$/.test(path)
  )
    throw new BadRequestException('Unsupported fact path');
  const parts = path.split('.');
  if (
    parts.length > 12 ||
    parts.some(
      (p) => !p || ['__proto__', 'prototype', 'constructor'].includes(p),
    )
  )
    throw new BadRequestException('Unsafe fact path');
  return parts;
}
export function ownFact(facts: unknown, path: string): unknown {
  let value = facts;
  for (const part of pathParts(path)) {
    if (
      !value ||
      typeof value !== 'object' ||
      !Object.prototype.hasOwnProperty.call(value, part)
    )
      return undefined;
    const desc = Object.getOwnPropertyDescriptor(value, part);
    if (!desc || desc.get || desc.set) return undefined;
    value = desc.value;
  }
  return value;
}
export function validateCondition(value: unknown, depth = 0): void {
  if (depth > 12) throw new BadRequestException('Condition nesting too deep');
  const c = object(value),
    keys = Object.keys(c);
  const group =
    keys.length === 1 && (keys[0] === 'all' || keys[0] === 'any')
      ? keys[0]
      : null;
  if (group) {
    const nodes = c[group];
    if (!Array.isArray(nodes) || !nodes.length || nodes.length > 100)
      throw new BadRequestException('Nonempty condition group required');
    nodes.forEach((n) => validateCondition(n, depth + 1));
    return;
  }
  if (keys.some((k) => !['path', 'op', 'value'].includes(k)))
    throw new BadRequestException('Unsupported condition key');
  pathParts(c.path);
  if (!['eq', 'in', 'exists'].includes(String(c.op)))
    throw new BadRequestException('Unsupported condition operator');
  if (c.op === 'exists') {
    if (typeof c.value !== 'boolean')
      throw new BadRequestException('exists expects boolean');
  } else if (c.op === 'in') {
    if (
      !Array.isArray(c.value) ||
      !c.value.length ||
      c.value.length > 100 ||
      c.value.some(
        (v) =>
          v !== null && !['string', 'number', 'boolean'].includes(typeof v),
      )
    )
      throw new BadRequestException('in expects scalar array');
  } else if (
    c.value !== null &&
    !['string', 'number', 'boolean'].includes(typeof c.value)
  )
    throw new BadRequestException('eq expects scalar');
}
export function evaluateCondition(value: unknown, facts: unknown): boolean {
  validateCondition(value);
  const c = value as JsonObject;
  if (c.all)
    return (c.all as unknown[]).every((n) => evaluateCondition(n, facts));
  if (c.any)
    return (c.any as unknown[]).some((n) => evaluateCondition(n, facts));
  const actual = ownFact(facts, String(c.path));
  return c.op === 'exists'
    ? (actual !== undefined && actual !== null) === c.value
    : c.op === 'in'
      ? (c.value as unknown[]).includes(actual)
      : actual === c.value;
}
