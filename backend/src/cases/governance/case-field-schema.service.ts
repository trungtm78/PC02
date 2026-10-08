import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseGovernanceService } from './case-governance.service';
import { canonicalJson } from './case-governance.contract';
import type { ActorContext } from './case-governance.contract';
import { object, nonblank } from './legal-workflow.validation';
import { configurationHash } from './case-configuration.service';
import {
  FieldDefinition,
  validateCustomValues,
  validateFieldDefinition,
} from './configuration.validation';
import {
  assertNativeFieldWrites,
  redactCaseFieldPolicies,
  nativePolicyAliases,
  isPublishedFieldSchema,
} from './case-native-field-policy';
import {
  compileCasePolicySearch,
  caseSearchTags,
  CASE_LEGACY_SEARCH_PARAMS,
} from './case-policy-search';
import { BoTimKiem } from '../../common/tim-kiem/bo-tim-kiem';
import { KHAI_TIM_KIEM_VU_AN } from '../../common/tim-kiem/khai/vu-an.khai';
@Injectable()
export class CaseFieldSchemaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CaseGovernanceService,
  ) {}
  private async sensitive(
    tx: Prisma.TransactionClient,
    actor: ActorContext,
    caseId?: string,
  ) {
    if (await this.core.hasCapability(tx, actor.actorId, 'read_sensitive'))
      return true;
    if (!caseId) return false;
    return !!(await tx.caseGovernanceGrant?.findFirst({
      where: {
        caseId,
        granteeId: actor.actorId,
        revokedAt: null,
        startsAt: { lte: new Date() },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        capabilities: { array_contains: ['read_sensitive'] },
      },
    }));
  }
  async byteFieldPolicySnapshot(
    tx: Prisma.TransactionClient,
    caseId: string,
    actor: ActorContext,
    inspectionPurpose?: string,
  ) {
    const record = inspectionPurpose
      ? await this.core.assertClassificationInspectable(
          tx,
          caseId,
          actor,
          inspectionPurpose,
        )
      : await this.core.assertBaseCaseReadable(tx, caseId, actor);
    const schema = record.fieldDefinitionVersionId
      ? await tx.caseFieldDefinitionVersion.findUnique({
          where: { id: record.fieldDefinitionVersionId },
        })
      : null;
    if (
      record.fieldDefinitionVersionId &&
      (!schema || !isPublishedFieldSchema(schema))
    )
      throw new ForbiddenException('Pinned field policy unavailable');
    const definition = schema?.definition ?? { fields: [] };
    validateFieldDefinition(definition);
    const d = definition as unknown as FieldDefinition,
      sensitive = await this.sensitive(tx, actor, caseId);
    return {
      definitionVersionId: schema?.id ?? null,
      definitionHash: configurationHash(definition),
      hasDeniedProtectedFields:
        !sensitive &&
        (d.fields.some((f) => f.sensitivity === 'RESTRICTED') ||
          (d.fieldPolicies ?? []).some((f) => f.sensitivity === 'RESTRICTED')),
    };
  }
  async validateForWrite(
    tx: Prisma.TransactionClient,
    input: { metadata?: unknown; fieldDefinitionVersionId?: unknown },
    existing: {
      id: string;
      fieldDefinitionVersionId: string | null;
      metadata: unknown;
    } | null,
    actor: ActorContext,
  ) {
    if (input.fieldDefinitionVersionId !== undefined)
      throw new BadRequestException(
        'Adopt field version through governed route',
      );
    const oldMetadata = existing?.metadata ? object(existing.metadata) : {},
      metadata = input.metadata ? object(input.metadata) : { ...oldMetadata };
    const old = oldMetadata._customFields
        ? object(oldMetadata._customFields)
        : {},
      incoming =
        metadata._customFields === undefined
          ? old
          : object(metadata._customFields);
    let id = existing?.fieldDefinitionVersionId ?? null;
    if (
      !existing &&
      (await this.core.accessProfile(tx, actor)).caseAccessMode !== 'INTERNAL'
    )
      throw new ForbiddenException(
        'Internal creation/schema authority required',
      );
    let schema = id
      ? await tx.caseFieldDefinitionVersion.findUnique({ where: { id } })
      : !existing
        ? await tx.caseFieldDefinitionVersion.findFirst({
            where: { code: 'default', status: 'PUBLISHED' },
            orderBy: { revision: 'desc' },
          })
        : null;
    const sensitive = await this.sensitive(tx, actor, existing?.id);
    if (schema && isPublishedFieldSchema(schema)) {
      validateFieldDefinition(schema.definition);
      assertNativeFieldWrites(
        input,
        existing,
        (schema.definition as unknown as FieldDefinition).fieldPolicies ?? [],
        sensitive,
      );
      if (!existing) id = schema.id;
    }
    const changed =
      canonicalJson({ ...old, ...incoming }) !== canonicalJson(old);
    if (!changed) {
      // Creation has no previous typed values to preserve. A required published
      // default must be satisfied even when the caller omits the custom object.
      if (!existing && schema && isPublishedFieldSchema(schema))
        validateCustomValues(schema.definition, incoming);
      if (oldMetadata._customFields !== undefined) metadata._customFields = old;
      return { fieldDefinitionVersionId: id, metadata };
    }
    await this.core.ensureEnabled(tx);
    if (!(await this.core.hasCapability(tx, actor.actorId, 'operate')))
      throw new ForbiddenException(
        'Explicit custom field write capability required',
      );
    if (
      !id &&
      (await this.core.accessProfile(tx, actor)).caseAccessMode !== 'INTERNAL'
    )
      throw new ForbiddenException(
        'Internal schema adoption authority required',
      );
    schema =
      schema ??
      (id
        ? await tx.caseFieldDefinitionVersion.findUnique({ where: { id } })
        : await tx.caseFieldDefinitionVersion.findFirst({
            where: { code: 'default', status: 'PUBLISHED' },
            orderBy: { revision: 'desc' },
          }));
    if (!schema || !isPublishedFieldSchema(schema))
      throw new BadRequestException('Published field schema required');
    id = schema.id;
    validateFieldDefinition(schema.definition);
    const definition = schema.definition as unknown as FieldDefinition;
    for (const key of Object.keys(incoming)) {
      if (
        canonicalJson(incoming[key] ?? null) === canonicalJson(old[key] ?? null)
      )
        continue;
      const field = definition.fields.find((f) => f.key === key);
      if (!field)
        throw new BadRequestException('Unknown custom field modification');
      if (field.sensitivity === 'RESTRICTED' && !sensitive)
        throw new ForbiddenException('Sensitive field write denied');
    }
    const all = { ...old, ...incoming },
      declared: Record<string, unknown> = {};
    for (const f of definition.fields) {
      if (Object.prototype.hasOwnProperty.call(incoming, f.key))
        declared[f.key] = incoming[f.key];
      else if (Object.prototype.hasOwnProperty.call(old, f.key))
        declared[f.key] = old[f.key];
    }
    validateCustomValues(definition, declared);
    metadata._customFields = all;
    return { fieldDefinitionVersionId: id, metadata };
  }
  async filterCustomFields<
    T extends {
      id: string;
      fieldDefinitionVersionId?: string | null;
      metadata?: unknown;
    },
  >(
    record: T,
    actor: ActorContext,
    tx: Prisma.TransactionClient = this.prisma,
    purpose: 'read' | 'export' = 'read',
  ): Promise<T> {
    const schema = record.fieldDefinitionVersionId
      ? await tx.caseFieldDefinitionVersion.findUnique({
          where: { id: record.fieldDefinitionVersionId },
        })
      : null;
    const permitted = await this.sensitive(tx, actor, record.id);
    const sanitized =
      schema && isPublishedFieldSchema(schema)
        ? redactCaseFieldPolicies(record, schema.definition, permitted, purpose)
        : record;
    if (!sanitized.metadata) return sanitized;
    const metadata = { ...object(sanitized.metadata) };
    if (metadata._customFields === undefined) return sanitized;
    const all = object(metadata._customFields);
    const values: Record<string, unknown> = {};
    if (schema && isPublishedFieldSchema(schema)) {
      validateFieldDefinition(schema.definition);
      for (const field of (schema.definition as unknown as FieldDefinition)
        .fields)
        if (
          (field.sensitivity !== 'RESTRICTED' || permitted) &&
          Object.prototype.hasOwnProperty.call(all, field.key)
        )
          values[field.key] = all[field.key];
    }
    metadata._customFields = values;
    return { ...sanitized, metadata };
  }
  /** Authorized native inputs for a derived formula, partitioned by pinned policy. */
  async readableNativeWhere(
    tx: Prisma.TransactionClient,
    actor: ActorContext,
    keys: string[],
    legacyVisibility?: Prisma.CaseWhereInput,
  ): Promise<Prisma.CaseWhereInput> {
    const visible = actor.actorId
      ? await this.core.readableCaseWhere(tx, actor, {
          representationCapability: 'view',
        })
      : (legacyVisibility ?? { id: '__no_access__' });
    const schemas = await tx.caseFieldDefinitionVersion.findMany({
      where: { cases: { some: visible } },
    });
    const sensitive =
      actor.actorId &&
      (await this.core.hasCapability(tx, actor.actorId, 'read_sensitive'));
    const partitions: Prisma.CaseWhereInput[] = [
      { fieldDefinitionVersionId: null },
    ];
    for (const schema of schemas) {
      if (!isPublishedFieldSchema(schema)) continue;
      validateFieldDefinition(schema.definition);
      const policies =
        (schema.definition as unknown as FieldDefinition).fieldPolicies ?? [];
      const protectedInput = policies.some(
        (policy) =>
          policy.sensitivity === 'RESTRICTED' &&
          nativePolicyAliases(policy.key).some((key) => keys.includes(key)),
      );
      partitions.push({
        fieldDefinitionVersionId: schema.id,
        ...(!protectedInput || sensitive
          ? {}
          : {
              caseGovernanceGrant_case: {
                some: {
                  granteeId: actor.actorId,
                  revokedAt: null,
                  startsAt: { lte: new Date() },
                  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                  capabilities: { array_contains: ['read_sensitive'] },
                },
              },
            }),
      });
    }
    return { AND: [visible, { OR: partitions }] };
  }
  async assertQueryReadable(
    tx: Prisma.TransactionClient,
    actor: ActorContext,
    query: Record<string, unknown>,
    purpose: 'read' | 'export' = 'read',
    legacyVisibility?: Prisma.CaseWhereInput,
  ) {
    const where = actor.actorId
      ? await this.core.readableCaseWhere(tx, actor)
      : ({
          AND: [
            legacyVisibility ?? {},
            {
              sensitivity: 'NORMAL',
              NOT: {
                metadata: { path: ['_sensitivity'], equals: 'RESTRICTED' },
              },
            },
          ],
        } as Prisma.CaseWhereInput);
    const schemas = await tx.caseFieldDefinitionVersion.findMany({
      where: {
        cases: { some: where },
        OR: [
          { status: 'PUBLISHED' },
          { status: 'SUPERSEDED', publishedAt: { not: null } },
        ],
      },
    });
    const nativeSchemas = schemas.filter((s) => {
      validateFieldDefinition(s.definition);
      return !!(s.definition as unknown as FieldDefinition).fieldPolicies
        ?.length;
    });
    if (!nativeSchemas.length) return;
    const ids = nativeSchemas.map((s) => s.id),
      rows = await tx.case.findMany({
        where: { AND: [where, { fieldDefinitionVersionId: { in: ids } }] },
        select: { id: true, fieldDefinitionVersionId: true },
      });
    const forbidden = new Set<string>();
    for (const row of rows) {
      const schema = schemas.find((s) => s.id === row.fieldDefinitionVersionId);
      if (!schema) continue;
      validateFieldDefinition(schema.definition);
      const sensitive = await this.sensitive(tx, actor, row.id);
      for (const p of (schema.definition as unknown as FieldDefinition)
        .fieldPolicies ?? []) {
        if (
          (p.sensitivity === 'RESTRICTED' && !sensitive) ||
          p.searchable === false ||
          (purpose === 'export' && p.exportable === false)
        )
          nativePolicyAliases(p.key).forEach((k) => forbidden.add(k));
      }
    }
    if (!forbidden.size) return;
    function scan(value: unknown, key = ''): void {
      if (value === undefined || value === null || value === '') return;
      if (forbidden.has(key))
        throw new ForbiddenException('Protected field query denied');
      if (typeof value === 'string') {
        if (['tk', 'tokens', 'token', 'timKiemTokens'].includes(key)) {
          if (value.includes('~')) {
            const fieldKey = value.slice(0, value.indexOf('~')),
              field = KHAI_TIM_KIEM_VU_AN.truong.find(
                (f) => f.key === fieldKey,
              );
            if (
              forbidden.has(fieldKey) ||
              (field?.cot && forbidden.has(field.cot)) ||
              (field?.quanHe && forbidden.has(field.quanHe + 'Id'))
            )
              throw new ForbiddenException('Protected token query denied');
          } else if (value.startsWith('{') || value.startsWith('[')) {
            try {
              scan(JSON.parse(value));
            } catch (e) {
              if (e instanceof ForbiddenException) throw e;
            }
          }
        } else if (
          [
            'sortBy',
            'emptyFields',
            'fields',
            'columns',
            'field',
            'column',
            'cot',
            'key',
          ].includes(key) &&
          value.split(/[\s,|]+/).some((v) => forbidden.has(v))
        )
          throw new ForbiddenException(
            'Protected field/sort/empty/export query denied',
          );
      } else if (Array.isArray(value)) value.forEach((v) => scan(v, key));
      else if (typeof value === 'object')
        for (const [k, v] of Object.entries(value)) scan(v, k);
    }
    scan(query);
  }
  async policyAwareSearchWhere(
    tx: Prisma.TransactionClient,
    actor: ActorContext,
    query: Record<string, unknown>,
    legacyVisibility?: Prisma.CaseWhereInput,
    representationViewOnly = false,
    implicitPeriod?: { field: string; where: Prisma.CaseWhereInput },
  ): Promise<Prisma.CaseWhereInput | null> {
    if (
      actor.actorId &&
      !representationViewOnly &&
      (await this.core.accessProfile(tx, actor)).caseAccessMode ===
        'REPRESENTATION_ONLY'
    ) {
      const list = await this.core.readableCaseWhere(tx, actor),
        view = await this.core.readableCaseWhere(tx, actor, {
          representationCapability: 'view',
        }),
        full = await this.policyAwareSearchWhere(
          tx,
          actor,
          query,
          undefined,
          true,
          implicitPeriod,
        ),
        original = await new BoTimKiem(
          tx,
          KHAI_TIM_KIEM_VU_AN,
          CASE_LEGACY_SEARCH_PARAMS,
        ).dieuKien(query);
      const fullWhere = {
        AND: [view, ...(full ? [full] : (original as Prisma.CaseWhereInput[]))],
      };
      const safeKeys = new Set([
        'page',
        'limit',
        'sortOrder',
        'search',
        'q',
        'tk',
        'sortBy',
        'name',
        'caseCode',
        'status',
      ]);
      const privateFilter =
        Object.entries(query).some(
          ([k, v]) =>
            v !== undefined && v !== null && v !== '' && !safeKeys.has(k),
        ) ||
        (query.sortBy !== undefined &&
          !['id', 'caseCode', 'name', 'status'].includes(
            nonblank(query.sortBy, 'Sort field'),
          )) ||
        caseSearchTags(query).some(
          (tag) =>
            !['*', 'stt', 'tenVuAn', 'trangThai'].includes(tag.split('~')[0]),
        );
      if (privateFilter) return { AND: [view, fullWhere] };
      const summaryForbidden = new Set(
        KHAI_TIM_KIEM_VU_AN.truong
          .filter((t) => !['stt', 'tenVuAn', 'trangThai'].includes(t.key))
          .flatMap((t) => [
            t.key,
            ...(t.cot ? [t.cot] : []),
            ...(t.quanHe ? [t.quanHe + 'Id'] : []),
          ]),
      );
      summaryForbidden.add('soHoSoCu');
      return {
        AND: [
          list,
          {
            OR: [
              fullWhere,
              {
                AND: [
                  list,
                  { NOT: view },
                  ...(compileCasePolicySearch(
                    query,
                    summaryForbidden,
                  ) as Prisma.CaseWhereInput[]),
                ],
              },
            ],
          },
        ],
      };
    }
    if (!caseSearchTags(query).length && !implicitPeriod) return null;
    const visible = actor.actorId
      ? await this.core.readableCaseWhere(
          tx,
          actor,
          representationViewOnly
            ? { representationCapability: 'view' }
            : undefined,
        )
      : ({
          AND: [legacyVisibility ?? {}, { sensitivity: 'NORMAL' }],
        } as Prisma.CaseWhereInput);
    const all = await tx.caseFieldDefinitionVersion.findMany({
        where: {
          cases: { some: visible },
          OR: [
            { status: 'PUBLISHED' },
            { status: 'SUPERSEDED', publishedAt: { not: null } },
          ],
        },
      }),
      schemas = all.filter((s) => {
        validateFieldDefinition(s.definition);
        return (s.definition as unknown as FieldDefinition).fieldPolicies?.some(
          (p) => p.sensitivity === 'RESTRICTED' || p.searchable === false,
        );
      });
    if (!schemas.length) {
      if (!implicitPeriod) return null;
      const original = await new BoTimKiem(
        tx,
        KHAI_TIM_KIEM_VU_AN,
        CASE_LEGACY_SEARCH_PARAMS,
      ).dieuKien(query);
      return {
        AND: [implicitPeriod.where, ...(original as Prisma.CaseWhereInput[])],
      };
    }
    const sensitive = actor.actorId
        ? await this.core.hasCapability(tx, actor.actorId, 'read_sensitive')
        : false,
      now = new Date();
    const grant: Prisma.CaseGovernanceGrantWhereInput = {
      granteeId: actor.actorId,
      startsAt: { lte: now },
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      capabilities: { array_contains: ['read_sensitive'] },
    };
    const original = await new BoTimKiem(
        tx,
        KHAI_TIM_KIEM_VU_AN,
        CASE_LEGACY_SEARCH_PARAMS,
      ).dieuKien(query),
      groups: Prisma.CaseWhereInput[] = [
        {
          AND: [
            {
              OR: [
                { fieldDefinitionVersionId: null },
                {
                  fieldDefinitionVersionId: { notIn: schemas.map((s) => s.id) },
                },
              ],
            },
            ...(original as Prisma.CaseWhereInput[]),
            ...(implicitPeriod ? [implicitPeriod.where] : []),
          ],
        },
      ];
    for (const schema of schemas) {
      const policies =
        (schema.definition as unknown as FieldDefinition).fieldPolicies ?? [];
      const compile = (allowed: boolean) =>
        compileCasePolicySearch(
          query,
          new Set(
            policies
              .filter(
                (p) =>
                  p.searchable === false ||
                  (p.sensitivity === 'RESTRICTED' && !allowed),
              )
              .flatMap((p) => nativePolicyAliases(p.key)),
          ),
        ) as Prisma.CaseWhereInput[];
      const period = (allowed: boolean): Prisma.CaseWhereInput[] =>
        implicitPeriod &&
        !policies.some(
          (p) =>
            nativePolicyAliases(p.key).includes(implicitPeriod.field) &&
            (p.searchable === false ||
              (p.sensitivity === 'RESTRICTED' && !allowed)),
        )
          ? [implicitPeriod.where]
          : [];
      if (sensitive)
        groups.push({
          AND: [
            { fieldDefinitionVersionId: schema.id },
            ...compile(true),
            ...period(true),
          ],
        });
      else {
        groups.push({
          AND: [
            {
              fieldDefinitionVersionId: schema.id,
              caseGovernanceGrant_case: { some: grant },
            },
            ...compile(true),
            ...period(true),
          ],
        });
        groups.push({
          AND: [
            {
              fieldDefinitionVersionId: schema.id,
              NOT: { caseGovernanceGrant_case: { some: grant } },
            },
            ...compile(false),
            ...period(false),
          ],
        });
      }
    }
    return { AND: [visible, { OR: groups }] };
  }
  async get(caseId: string | null, actor: ActorContext) {
    let id: string | null = null,
      metadata: Record<string, unknown> = {};
    if (caseId) {
      const record = await this.core.assertCaseReadable(
        this.prisma,
        caseId,
        actor,
      );
      id = record.fieldDefinitionVersionId;
      metadata = record.metadata ? object(record.metadata) : {};
      if (!id) return { success: true, data: null };
    } else {
      if (
        (await this.core.accessProfile(this.prisma, actor)).caseAccessMode !==
        'INTERNAL'
      )
        throw new ForbiddenException('Internal default schema access required');
      await this.core.readableCaseWhere(this.prisma, actor);
    }
    const schema = id
      ? await this.prisma.caseFieldDefinitionVersion.findUnique({
          where: { id },
        })
      : await this.prisma.caseFieldDefinitionVersion.findFirst({
          where: { code: 'default', status: 'PUBLISHED' },
          orderBy: { revision: 'desc' },
        });
    if (!schema || !isPublishedFieldSchema(schema))
      return { success: true, data: null };
    validateFieldDefinition(schema.definition);
    const permitted = await this.sensitive(
        this.prisma,
        actor,
        caseId ?? undefined,
      ),
      fields = (schema.definition as unknown as FieldDefinition).fields.filter(
        (f) => f.sensitivity !== 'RESTRICTED' || permitted,
      );
    const all = metadata._customFields ? object(metadata._customFields) : {},
      values: Record<string, unknown> = {};
    for (const f of fields)
      if (Object.prototype.hasOwnProperty.call(all, f.key))
        values[f.key] = all[f.key];
    return {
      success: true,
      data: {
        id: schema.id,
        revision: schema.revision,
        status: 'PUBLISHED' as const,
        definition: {
          fields,
          fieldPolicies: (
            schema.definition as unknown as FieldDefinition
          ).fieldPolicies?.map((p) => ({
            ...p,
            readable: p.sensitivity !== 'RESTRICTED' || permitted,
            writable: p.sensitivity !== 'RESTRICTED' || permitted,
          })),
        },
        values,
      },
    };
  }
  async save(
    caseId: string,
    dto: {
      requestKey: string;
      expectedUpdatedAt: string;
      fieldDefinitionVersionId?: string;
      values: unknown;
    },
    actor: ActorContext,
  ) {
    const incoming = object(dto.values);
    return this.core.mutateCase(
      {
        caseId,
        operation: 'FIELD_SCHEMA_ADOPT',
        requestKey: dto.requestKey,
        expectedUpdatedAt: dto.expectedUpdatedAt,
        payload: {
          fieldDefinitionVersionId: dto.fieldDefinitionVersionId,
          values: incoming,
        },
      },
      actor,
      async (tx, { caseRecord, operationId }) => {
        const id =
          dto.fieldDefinitionVersionId ?? caseRecord.fieldDefinitionVersionId;
        if (!id)
          throw new BadRequestException('Published field schema required');
        if (
          id !== caseRecord.fieldDefinitionVersionId &&
          (await this.core.accessProfile(tx, actor)).caseAccessMode !==
            'INTERNAL'
        )
          throw new ForbiddenException(
            'Internal schema adoption authority required',
          );
        const schema = await tx.caseFieldDefinitionVersion.findUnique({
          where: { id },
        });
        if (
          !schema ||
          !isPublishedFieldSchema(schema) ||
          (schema.status === 'SUPERSEDED' &&
            caseRecord.fieldDefinitionVersionId !== id)
        )
          throw new NotFoundException('Published field schema not found');
        validateFieldDefinition(schema.definition);
        const definition = schema.definition as unknown as FieldDefinition,
          sensitive = await this.sensitive(tx, actor, caseId);
        for (const key of Object.keys(incoming)) {
          const field = definition.fields.find((f) => f.key === key);
          if (!field) throw new BadRequestException('Unknown typed custom key');
          if (field.sensitivity === 'RESTRICTED' && !sensitive)
            throw new ForbiddenException('Sensitive field authority required');
        }
        const metadata = caseRecord.metadata ? object(caseRecord.metadata) : {},
          old = metadata._customFields ? object(metadata._customFields) : {},
          all = { ...old, ...incoming },
          declared: Record<string, unknown> = {};
        for (const f of definition.fields)
          if (Object.prototype.hasOwnProperty.call(all, f.key))
            declared[f.key] = all[f.key];
        validateCustomValues(definition, declared);
        await tx.case.update({
          where: { id: caseId },
          data: {
            fieldDefinitionVersionId: id,
            metadata: {
              ...metadata,
              _customFields: all,
            } as Prisma.InputJsonValue,
          },
        });
        await this.core.recordEvent(
          tx,
          caseId,
          operationId,
          actor.actorId,
          'FIELD_SCHEMA_ADOPTED',
          {
            fieldDefinitionVersionId: id,
            revision: schema.revision,
            changedKeys: Object.keys(incoming),
          },
        );
        const fields = definition.fields.filter(
            (f) => f.sensitivity !== 'RESTRICTED' || sensitive,
          ),
          values: Record<string, unknown> = {};
        for (const f of fields)
          if (Object.prototype.hasOwnProperty.call(all, f.key))
            values[f.key] = all[f.key];
        return {
          success: true,
          data: {
            id,
            revision: schema.revision,
            status: 'PUBLISHED' as const,
            definition: {
              fields,
              fieldPolicies: definition.fieldPolicies?.map((p) => ({
                ...p,
                readable: p.sensitivity !== 'RESTRICTED' || sensitive,
                writable: p.sensitivity !== 'RESTRICTED' || sensitive,
              })),
            },
            values,
          },
        };
      },
    );
  }
}
