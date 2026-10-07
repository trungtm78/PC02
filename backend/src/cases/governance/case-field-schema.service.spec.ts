import { CaseFieldSchemaService } from './case-field-schema.service';
describe('CG-FS-REQ01 new default fields and legacy preservation', () => {
  it('native formula readiness keeps readable partitions and requires exact grant for protected deadline/status', async () => {
    const schemas = [{ id: 'public',status: 'PUBLISHED',definition: { fields: [] } },{ id: 'private',status: 'PUBLISHED',definition: { fields: [],fieldPolicies: [{ key: 'deadline',sensitivity: 'RESTRICTED' }] } },{ id: 'draft',status: 'DRAFT',definition: { fields: [] } }];
    const db = { caseFieldDefinitionVersion: { findMany: jest.fn(async () => schemas) } };
    const core = { readableCaseWhere: jest.fn(async () => ({ id: 'visible' })),hasCapability: jest.fn(async () => false) };
    const service = new CaseFieldSchemaService(db as never,core as never);
    const where = await service.readableNativeWhere(db as never,{ actorId: 'actor' },['deadline','status']);
    expect(core.readableCaseWhere).toHaveBeenCalledWith(db,{ actorId: 'actor' },{ representationCapability: 'view' });
    expect(where).toHaveProperty('AND.1.OR.0.fieldDefinitionVersionId',null);
    expect(JSON.stringify(where)).toContain('public'); expect(JSON.stringify(where)).toContain('caseGovernanceGrant_case'); expect(JSON.stringify(where)).not.toContain('draft');
    core.hasCapability.mockResolvedValue(true);
    expect(JSON.stringify(await service.readableNativeWhere(db as never,{ actorId: 'actor' },['deadline']))).not.toContain('caseGovernanceGrant_case');
    expect(JSON.stringify(await service.readableNativeWhere(db as never,{ actorId: '' },['name'],{ id: 'legacy-visible' }))).toContain('legacy-visible');
  });
  function fixture() {
    const schema = { id: 'required-default', status: 'PUBLISHED', definition: { fields: [{ key: 'custom_enabled', label: 'Enabled', type: 'boolean', required: true },{ key: 'custom_count', label: 'Count', type: 'number', required: true }] } };
    const db = { caseFieldDefinitionVersion: { findFirst: jest.fn(async () => schema), findUnique: jest.fn(async () => schema) } };
    const core = { accessProfile: jest.fn(async () => ({ caseAccessMode: 'INTERNAL' })), hasCapability: jest.fn(async (_tx: unknown,_actor: string,action: string) => action === 'operate'), ensureEnabled: jest.fn(async () => undefined) };
    return { service: new CaseFieldSchemaService(db as never,core as never), db };
  }
  it('new creation cannot omit all required default values', async () => {
    const { service,db } = fixture();
    await expect(service.validateForWrite(db as never,{},null,{ actorId: 'actor' })).rejects.toThrow('Enabled required');
  });
  it('required false and zero remain valid typed values', async () => {
    const { service,db } = fixture();
    await expect(service.validateForWrite(db as never,{ metadata: { _customFields: { custom_enabled: false, custom_count: 0 } } },null,{ actorId: 'actor' })).resolves.toMatchObject({ fieldDefinitionVersionId: 'required-default', metadata: { _customFields: { custom_enabled: false, custom_count: 0 } } });
  });
  it('unrelated edit preserves an existing legacy required-field omission without inventing values', async () => {
    const { service,db } = fixture();
    await expect(service.validateForWrite(db as never,{}, { id: 'legacy', fieldDefinitionVersionId: 'required-default', metadata: { legacy_unknown: 'preserved' } },{ actorId: 'actor' })).resolves.toMatchObject({ fieldDefinitionVersionId: 'required-default', metadata: { legacy_unknown: 'preserved' } });
  });
});
describe('CG01/14 pinned runtime schema', () => {
  it('byte entitlement gets only a current policy hash and denied-protected flag without implying full view', async () => {
    const { svc, db, core } = make('pinned');
    (core as any).assertBaseCaseReadable = jest
      .fn()
      .mockResolvedValue({ id: 'case', fieldDefinitionVersionId: 'pinned' });
    const snapshot = await svc.byteFieldPolicySnapshot(db as never, 'case', {
      actorId: 'reader',
    });
    expect(snapshot).toMatchObject({
      definitionVersionId: 'pinned',
      definitionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      hasDeniedProtectedFields: true,
    });
    expect(core.assertCaseReadable).not.toHaveBeenCalled();
  });
  const schema = {
    id: 'pinned',
    revision: 3,
    status: 'PUBLISHED',
    definition: {
      fields: [
        {
          key: 'custom_public',
          label: 'Public',
          type: 'text',
          required: false,
        },
        {
          key: 'custom_secret',
          label: 'Secret',
          type: 'text',
          required: false,
          sensitivity: 'RESTRICTED',
        },
      ],
    },
  };
  function make(pin: string | null) {
    const db = {
      caseFieldDefinitionVersion: {
        findUnique: jest.fn().mockResolvedValue(schema),
        findFirst: jest.fn().mockResolvedValue({ ...schema, id: 'latest' }),
      },
    };
    const core = {
      assertCaseReadable: jest.fn().mockResolvedValue({
        fieldDefinitionVersionId: pin,
        metadata: {
          _customFields: {
            custom_public: 'visible',
            custom_secret: 'hidden',
          },
          status: 'hijack',
        },
      }),
      hasCapability: jest.fn().mockResolvedValue(false),
    };
    return {
      svc: new CaseFieldSchemaService(db as never, core as never),
      db,
      core,
    };
  }
  it('returns explicit null for unpinned legacy case', async () => {
    const { svc, db } = make(null);
    await expect(svc.get('case', { actorId: 'reader' })).resolves.toEqual({
      success: true,
      data: null,
    });
    expect(db.caseFieldDefinitionVersion.findFirst).not.toHaveBeenCalled();
  });
  it('returns pinned revision and only authorized declared values', async () => {
    const { svc } = make('pinned');
    await expect(svc.get('case', { actorId: 'reader' })).resolves.toMatchObject(
      {
        success: true,
        data: {
          id: 'pinned',
          revision: 3,
          status: 'PUBLISHED',
          definition: {
            fields: [expect.objectContaining({ key: 'custom_public' })],
          },
          values: { custom_public: 'visible' },
        },
      },
    );
    const result = await svc.get('case', { actorId: 'reader' });
    expect(result.data!.definition.fields).toHaveLength(1);
    expect(result.data!.values).not.toHaveProperty('custom_secret');
  });
  it('one CaseForm save can edit a public value while preserving an omitted hidden value', async () => {
    const { svc, db, core } = make('pinned');
    (core as any).ensureEnabled = jest.fn();
    core.hasCapability.mockImplementation(
      async (_tx: any, _actor: any, cap: string) => cap === 'operate',
    );
    const existing = {
      id: 'case',
      fieldDefinitionVersionId: 'pinned',
      metadata: {
        _customFields: { custom_public: 'old', custom_secret: 'hidden' },
        canonical: 'preserve',
      },
    };
    await expect(
      svc.validateForWrite(
        db as never,
        {
          metadata: {
            _customFields: { custom_public: 'changed' },
            canonical: 'preserve',
          },
        },
        existing,
        { actorId: 'operator' },
      ),
    ).resolves.toMatchObject({
      fieldDefinitionVersionId: 'pinned',
      metadata: {
        canonical: 'preserve',
        _customFields: { custom_public: 'changed', custom_secret: 'hidden' },
      },
    });
  });
  it('native columns/statistic values and metadata aliases follow pinned policy for reads and writes', async () => {
    const { svc, db } = make('pinned');
    db.caseFieldDefinitionVersion.findUnique.mockResolvedValue({
      ...schema,
      definition: {
        fields: [],
        fieldPolicies: [
          { key: 'cccdCungCap', sensitivity: 'RESTRICTED' },
          { key: 'statistic.soTienBiThietHai', sensitivity: 'RESTRICTED' },
        ],
      },
    } as never);
    const record = {
      id: 'case',
      fieldDefinitionVersionId: 'pinned',
      cccdCungCap: 'secret',
      statistic: { soTienBiThietHai: 99 },
      metadata: { reporterIdNumber: 'secret', damageAmount: 99 },
    };
    const sanitized = await svc.filterCustomFields(
      record,
      { actorId: 'reader' },
      db as never,
    );
    expect(JSON.stringify(sanitized)).not.toContain('secret');
    expect(sanitized.statistic).not.toHaveProperty('soTienBiThietHai');
    await expect(
      svc.validateForWrite(
        db as never,
        { metadata: { reporterIdNumber: 'changed' } },
        record,
        { actorId: 'reader' },
      ),
    ).rejects.toThrow('Protected native');
  });
  it('forbidden native search/sort/empty tokens cannot infer through counts or exports', async () => {
    const { svc, db, core } = make('pinned');
    (core as any).readableCaseWhere = jest
      .fn()
      .mockResolvedValue({ id: { in: ['case'] } });
    (db as any).case = {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 'case', fieldDefinitionVersionId: 'pinned' },
        ]),
    };
    (db.caseFieldDefinitionVersion as any).findMany = jest
      .fn()
      .mockResolvedValue([
        {
          ...schema,
          definition: {
            fields: [],
            fieldPolicies: [{ key: 'cccdCungCap', sensitivity: 'RESTRICTED' }],
          },
        },
      ]);
    for (const query of [
      { sortBy: 'cccdCungCap' },
      { emptyFields: ['cccdCungCap'] },
      { tokens: '[{"field":"cccdCungCap","value":"secret"}]' },
    ])
      await expect(
        svc.assertQueryReadable(db as never, { actorId: 'reader' }, query),
      ).rejects.toThrow();
    for (const query of [
      { search: 'all' },
      { tk: ['tenVuAn~all'] },
      { tk: ['*~all'] },
    ])
      await expect(
        svc.assertQueryReadable(db as never, { actorId: 'reader' }, query),
      ).resolves.toBeUndefined();
    await expect(
      svc.assertQueryReadable(
        db as never,
        { actorId: 'reader' },
        { status: 'TIEP_NHAN' },
      ),
    ).resolves.toBeUndefined();
  });
  it('superseded pinned immutable policy remains enforced and scoped unexpired grants count as explicit authority', async () => {
    const { svc, db } = make('pinned');
    db.caseFieldDefinitionVersion.findUnique.mockResolvedValue({
      ...schema,
      status: 'SUPERSEDED',
      publishedAt: new Date('2026-01-01'),
      definition: {
        fields: [],
        fieldPolicies: [{ key: 'cccdCungCap', sensitivity: 'RESTRICTED' }],
      },
    } as never);
    const grant = jest.fn().mockResolvedValue({ id: 'grant' });
    (db as any).caseGovernanceGrant = { findFirst: grant };
    const record = {
      id: 'case',
      fieldDefinitionVersionId: 'pinned',
      cccdCungCap: 'authorized',
    };
    await expect(
      svc.filterCustomFields(record, { actorId: 'grantee' }, db as never),
    ).resolves.toMatchObject({ cccdCungCap: 'authorized' });
    expect(grant).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          caseId: 'case',
          granteeId: 'grantee',
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
        }),
      }),
    );
  });
});
