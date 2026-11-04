/**
 * Stored unit of every numeric form field a model may fill.
 *
 * The trap this exists for: the form caption of `statistic.soTienBiThietHai` says "(triệu Việt Nam Đồng)",
 * but the column stores plain VND (`schema.prisma`, and `buildCreateCasePayload.test.ts` expects
 * "5.500.000" to become 5500000). Converting to millions because of the caption would be wrong by a
 * factor of one million, silently. The contract is therefore declared here and pinned to the schema by
 * a test, never inferred from a caption.
 */
export type FieldUnit = 'VND' | 'COUNT';

export const FIELD_UNITS: Readonly<Record<string, FieldUnit>> = {
  'statistic.soTienBiThietHai': 'VND',
  'statistic.soLuongBiHai': 'COUNT',
};

const MONEY_UNITS: readonly FieldUnit[] = ['VND'];

/** Converts an amount in VND to the field's stored unit. Throws for a unit that is not money. */
export function fromVnd(amountVnd: number, unit: FieldUnit): number {
  if (!MONEY_UNITS.includes(unit)) {
    throw new Error(`unit ${unit} is not a money unit`);
  }
  return amountVnd;
}
