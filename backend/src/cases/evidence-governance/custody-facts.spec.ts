import { validateCustodyFacts } from './custody-facts';
const holder = {
  kind: 'WAREHOUSE' as const,
  identifier: 'warehouse-A',
  name: 'Synthetic evidence warehouse A',
};
const recipient = {
  kind: 'PERSON' as const,
  identifier: 'custodian-B',
  name: 'Synthetic actual custodian B',
};
const receipt = {
  fromHolder: null,
  toHolder: holder,
  fromLocation: null,
  toLocation: 'Locker A1',
  condition: 'SEALED',
  conditionNote: 'Seal receipt verified',
  receiptDocumentId: 'source-receipt',
  receiptReference: 'synthetic-receipt-001',
};
describe('CG-CU01 custody actual facts and chain continuity', () => {
  it.each([
    ['unsupported facts', { ...receipt, callerAuthority: true }],
    [
      'unknown holder kind',
      { ...receipt, toHolder: { ...holder, kind: 'APP_ACTOR' } },
    ],
    ['unknown condition', { ...receipt, condition: 'ASSUMED_GOOD' }],
    ['non-object facts', []],
    [
      'correction hidden in receipt',
      { ...receipt, correctionReason: 'unauthorized history rewrite' },
    ],
  ])('rejects %s rather than manufacturing physical facts', (_name, value) => {
    expect(() => validateCustodyFacts('RECEIPT', value, null)).toThrow();
  });
  it('inspection cannot move evidence and transfer cannot describe no movement', () => {
    const previous = {
      holder,
      location: 'Locker A1',
      condition: 'SEALED',
      conditionNote: 'intact',
    };
    const same = { ...receipt, fromHolder: holder, fromLocation: 'Locker A1' };
    expect(() => validateCustodyFacts('TRANSFER', same, previous)).toThrow(
      'actual',
    );
    expect(() =>
      validateCustodyFacts(
        'INSPECTION',
        { ...same, toHolder: recipient },
        previous,
      ),
    ).toThrow('silently');
    expect(
      validateCustodyFacts('INSPECTION', same, previous).currentCustody.holder,
    ).toEqual(holder);
  });
  it('rejects arbitrary event names and empty transfer payloads', () => {
    expect(() => validateCustodyFacts('TRANSFER', {}, null)).toThrow();
    expect(() => validateCustodyFacts('ANY_EVENT', receipt, null)).toThrow();
  });
  it('establishes an explicitly unknown legacy prior holder without inventing the app actor', () => {
    const result = validateCustodyFacts('RECEIPT', receipt, null);
    expect(result.facts.fromHolder).toBeNull();
    expect(result.currentCustody.holder).toEqual(holder);
  });
  it('refuses transfer when actual current holder has not been established', () => {
    expect(() =>
      validateCustodyFacts(
        'TRANSFER',
        { ...receipt, fromHolder: holder, toHolder: recipient },
        null,
      ),
    ).toThrow('Unknown');
  });
  it('validates actual from/to holder and location against the current chain', () => {
    const previous = {
      holder,
      location: 'Locker A1',
      condition: 'SEALED',
      conditionNote: 'intact',
    };
    const result = validateCustodyFacts(
      'TRANSFER',
      {
        ...receipt,
        fromHolder: holder,
        fromLocation: 'Locker A1',
        toHolder: recipient,
        toLocation: 'Custodian secure box',
      },
      previous,
    );
    expect(result.currentCustody.holder).toEqual(recipient);
    expect(() =>
      validateCustodyFacts(
        'TRANSFER',
        { ...receipt, fromHolder: recipient, fromLocation: 'Locker A1' },
        previous,
      ),
    ).toThrow('current custody');
  });
  it('requires source receipt and observed condition facts', () => {
    expect(() =>
      validateCustodyFacts(
        'RECEIPT',
        { ...receipt, receiptDocumentId: '' },
        null,
      ),
    ).toThrow('receipt');
    expect(() =>
      validateCustodyFacts('RECEIPT', { ...receipt, conditionNote: '' }, null),
    ).toThrow('condition');
  });
  it('requires append correction reason instead of silent history rewrite', () => {
    const previous = {
      holder,
      location: 'Locker A1',
      condition: 'SEALED',
      conditionNote: 'intact',
    };
    expect(() =>
      validateCustodyFacts(
        'CORRECTION',
        { ...receipt, fromHolder: holder, fromLocation: 'Locker A1' },
        previous,
      ),
    ).toThrow('correction');
    const corrected = validateCustodyFacts(
      'CORRECTION',
      {
        ...receipt,
        fromHolder: holder,
        fromLocation: 'Locker A1',
        correctionReason: 'Correct observed seal condition',
        condition: 'DAMAGED',
      },
      previous,
    );
    expect(corrected.currentCustody.condition).toBe('DAMAGED');
  });
});
