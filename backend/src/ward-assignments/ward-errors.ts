import { BadRequestException } from '@nestjs/common';
import { WARD_ERROR } from './ward-assignment.codes';

/**
 * The body of an error of this module: a stable code the screen translates, and the structured details in the slot the
 * global error filter forwards (`details`, an array; anything else is dropped at the HTTP boundary).
 */
export function wardBody(code: string, ...details: Record<string, unknown>[]): { code: string; details: Record<string, unknown>[] } {
  return { code, details };
}

/**
 * Whether the form acted on is the one stored: `expected` is the `updatedAt` the form read. Compared as instants (the
 * same instant written with another offset is the same form). A value that is not an instant is refused, never read
 * as "different" or as "the same".
 */
export function sameStamp(stored: Date, expected: string): boolean {
  const instant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/.test(expected) ? new Date(expected).getTime() : Number.NaN;
  if (Number.isNaN(instant)) throw new BadRequestException(wardBody(WARD_ERROR.STAMP_INVALID));
  return stored.getTime() === instant;
}
