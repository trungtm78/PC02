import type { DataScope } from '../../auth/services/unit-scope.service';
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
export interface ActorContext {
  actorId: string;
  roleId?: string;
  dataScope?: DataScope | null;
}
export interface MutationInput {
  caseId: string;
  operation: string;
  requestKey: string;
  expectedUpdatedAt: string;
  payload: unknown;
  expectedAggregateUpdatedAt?: string;
}
export function canonicalJson(value: unknown): string {
  const seen = new Set<object>();
  function encode(v: unknown, depth: number): string {
    if (depth > 64)
      throw new BadRequestException('Payload nesting is too deep');
    if (v === null || typeof v === 'boolean' || typeof v === 'string')
      return JSON.stringify(v);
    if (typeof v === 'number' && Number.isFinite(v)) return JSON.stringify(v);
    if (!v || typeof v !== 'object' || seen.has(v))
      throw new BadRequestException('Unsupported governance payload');
    if (
      !Array.isArray(v) &&
      Object.getPrototypeOf(v) !== Object.prototype &&
      Object.getPrototypeOf(v) !== null
    )
      throw new BadRequestException('Only plain JSON objects are accepted');
    if (Object.getOwnPropertySymbols(v).length)
      throw new BadRequestException('Symbol keys are unsupported');
    seen.add(v);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(v);
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (
          ['__proto__', 'prototype', 'constructor'].includes(key) ||
          descriptor.get ||
          descriptor.set
        )
          throw new BadRequestException('Unsafe payload property');
      }
      if (Array.isArray(v))
        return (
          '[' +
          Array.from({ length: v.length }, (_, i) =>
            encode(v[i], depth + 1),
          ).join(',') +
          ']'
        );
      return (
        '{' +
        Object.keys(v)
          .sort()
          .filter((key) => descriptors[key].value !== undefined)
          .map(
            (key) =>
              JSON.stringify(key) +
              ':' +
              encode(descriptors[key].value, depth + 1),
          )
          .join(',') +
        '}'
      );
    } finally {
      seen.delete(v);
    }
  }
  return encode(value, 0);
}
export function mutationHash(
  input: Pick<MutationInput, 'caseId' | 'operation' | 'payload'> &
    Partial<
      Pick<
        MutationInput,
        'expectedUpdatedAt' | 'expectedAggregateUpdatedAt' | 'requestKey'
      >
    >,
  actorId: string,
): string {
  return createHash('sha256')
    .update(
      canonicalJson({
        actorId,
        caseId: input.caseId,
        operation: input.operation,
        payload: input.payload,
      }),
    )
    .digest('hex');
}
