import {
  legacyDefinitionAllowsBytes,
  definitionAllowsCaseNameSearch,
} from './legacy-byte-eligibility';
describe('R1/R2 legacy byte compatibility never grants Case read', () => {
  it('Case-name search respects field restriction and explicit searchable=false', () => {
    const restricted = {
      status: 'PUBLISHED',
      definition: {
        fields: [],
        fieldPolicies: [{ key: 'name', sensitivity: 'RESTRICTED' }],
      },
    };
    expect(definitionAllowsCaseNameSearch(restricted, false)).toBe(false);
    expect(definitionAllowsCaseNameSearch(restricted, true)).toBe(true);
    expect(
      definitionAllowsCaseNameSearch(
        {
          status: 'PUBLISHED',
          definition: {
            fields: [],
            fieldPolicies: [
              { key: 'name', sensitivity: 'NORMAL', searchable: false },
            ],
          },
        },
        true,
      ),
    ).toBe(false);
    expect(
      definitionAllowsCaseNameSearch(
        { status: 'PUBLISHED', definition: { fields: null } },
        true,
      ),
    ).toBe(false);
  });
  it('allows absence of a pinned definition and validated fully public publication', () => {
    expect(legacyDefinitionAllowsBytes(null, null)).toBe(true);
    expect(
      legacyDefinitionAllowsBytes('public', {
        status: 'PUBLISHED',
        definition: {
          fields: [],
          fieldPolicies: [
            { key: 'description', sensitivity: 'NORMAL', exportable: true },
          ],
        },
      }),
    ).toBe(true);
  });
  it.each([
    null,
    { status: 'DRAFT', definition: { fields: [] } },
    { status: 'SUPERSEDED', publishedAt: null, definition: { fields: [] } },
    { status: 'PUBLISHED', definition: { fields: 'invalid' } },
    {
      status: 'PUBLISHED',
      definition: {
        fields: [],
        fieldPolicies: [{ key: 'description', sensitivity: 'RESTRICTED' }],
      },
    },
    {
      status: 'PUBLISHED',
      definition: {
        fields: [
          {
            key: 'secret',
            label: 'Secret',
            type: 'text',
            required: false,
            sensitivity: 'RESTRICTED',
          },
        ],
      },
    },
    {
      status: 'PUBLISHED',
      definition: {
        fields: [],
        fieldPolicies: [
          { key: 'description', sensitivity: 'NORMAL', exportable: false },
        ],
      },
    },
  ])('denies absent/invalid/protected/unpublished pinned policy %j', (row) => {
    expect(legacyDefinitionAllowsBytes('pinned', row)).toBe(false);
  });
});
