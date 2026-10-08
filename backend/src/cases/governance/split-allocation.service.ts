import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CaseGovernanceService } from './case-governance.service';
import { CaseEvidenceGovernanceService } from '../evidence-governance/evidence-governance.service';
import type { ActorContext } from './case-governance.contract';
import { object, nonblank } from './legal-workflow.validation';
import { configurationHash } from './case-configuration.service';
import { CASE_CANONICAL_FIELD_REGISTRY } from '../case-canonical-field-registry.generated';
import { isPublishedFieldSchema } from './case-native-field-policy';
import type { FieldDefinition } from './configuration.validation';
export interface AllocationRef {
  id: string;
  expectedUpdatedAt: string;
}
export interface SplitAllocation {
  subjects?: AllocationRef[];
  documents?: AllocationRef[];
  assets?: AllocationRef[];
  evidences?: AllocationRef[];
  fields?: string[];
}
@Injectable()
export class SplitAllocationService {
  constructor(
    private readonly core: CaseGovernanceService,
    private readonly evidence: CaseEvidenceGovernanceService,
  ) {}
  async snapshot(
    tx: Prisma.TransactionClient,
    caseId: string,
    raw: unknown,
    actor: ActorContext,
  ) {
    const allocation = object(raw);
    if (
      Object.keys(allocation).some(
        (k) =>
          !['subjects', 'documents', 'assets', 'evidences', 'fields'].includes(
            k,
          ),
      )
    )
      throw new BadRequestException('Unsupported allocation selector');
    const count = Object.values(allocation).reduce<number>((n, list) => {
      if (!Array.isArray(list) || list.length > 200)
        throw new BadRequestException('Bounded allocation arrays required');
      return n + list.length;
    }, 0);
    if (!count)
      throw new BadRequestException('Select at least one concrete source part');
    await this.core.assertCaseReadable(tx, caseId, actor);
    const result: {
      subjects: unknown[];
      documents: unknown[];
      assets: unknown[];
      evidences: unknown[];
      fields: unknown[];
    } = { subjects: [], documents: [], assets: [], evidences: [], fields: [] };
    function refs(value: unknown) {
      if (value === undefined) return [] as AllocationRef[];
      const seen = new Set<string>();
      return (value as unknown[]).map((raw) => {
        const r = object(raw),
          id = nonblank(r.id, 'Source reference'),
          expectedUpdatedAt = nonblank(
            r.expectedUpdatedAt,
            'Source reference version',
          );
        if (
          Object.keys(r).some(
            (k) => !['id', 'expectedUpdatedAt'].includes(k),
          ) ||
          seen.has(id) ||
          !Number.isFinite(new Date(expectedUpdatedAt).getTime())
        )
          throw new BadRequestException(
            'Unique versioned source references required',
          );
        seen.add(id);
        return { id, expectedUpdatedAt };
      });
    }
    const same = (
      row: { id: string; updatedAt: Date } | null,
      ref: AllocationRef,
    ) => {
      if (
        !row ||
        row.updatedAt.getTime() !== new Date(ref.expectedUpdatedAt).getTime()
      )
        throw new ConflictException(
          'Selected source part changed or unavailable',
        );
    };
    for (const ref of refs(allocation.subjects)) {
      const row = await tx.subject.findFirst({
        where: { id: ref.id, caseId, deletedAt: null },
      });
      same(row, ref);
      result.subjects.push({
        id: row!.id,
        caseId,
        updatedAt: row!.updatedAt.toISOString(),
        type: row!.type,
        contentHash: configurationHash(
          JSON.parse(JSON.stringify(row)) as unknown,
        ),
      });
    }
    for (const ref of refs(allocation.evidences)) {
      const row = await tx.evidence.findFirst({
        where: { id: ref.id, caseId, deletedAt: null },
      });
      same(row, ref);
      result.evidences.push({
        id: row!.id,
        caseId,
        updatedAt: row!.updatedAt.toISOString(),
        contentHash: configurationHash(
          JSON.parse(JSON.stringify(row)) as unknown,
        ),
      });
    }
    for (const ref of refs(allocation.documents)) {
      const row = await tx.document.findFirst({
        where: { id: ref.id, caseId, deletedAt: null },
      });
      same(row, ref);
      result.documents.push(
        await this.evidence.decisionSourceSnapshot(tx, caseId, ref.id, actor),
      );
    }
    for (const ref of refs(allocation.assets)) {
      const asset = await tx.caseAssetVersion.findFirst({
        where: { id: ref.id, caseId, retiredAt: null },
      });
      if (
        !asset ||
        asset.createdAt.getTime() !== new Date(ref.expectedUpdatedAt).getTime()
      )
        throw new ConflictException(
          'Selected immutable asset version unavailable',
        );
      const pin = await this.evidence.decisionSourceSnapshot(
        tx,
        caseId,
        asset.documentId,
        actor,
      );
      if (pin.assetVersionId !== asset.id)
        throw new ConflictException('Asset version changed');
      result.assets.push(pin);
    }
    if (allocation.fields !== undefined) {
      const keys = allocation.fields as unknown[];
      if (
        keys.some((k) => typeof k !== 'string') ||
        new Set(keys).size !== keys.length
      )
        throw new BadRequestException('Unique field keys required');
      const record = await tx.case.findUniqueOrThrow({
          where: { id: caseId },
          include: { statistic: true },
        }),
        schema = record.fieldDefinitionVersionId
          ? await tx.caseFieldDefinitionVersion.findUnique({
              where: { id: record.fieldDefinitionVersionId },
            })
          : null;
      if (schema && !isPublishedFieldSchema(schema))
        throw new ForbiddenException('Pinned field policy unavailable');
      const definition = schema?.definition as unknown as
          | FieldDefinition
          | undefined,
        sensitive = await this.core.hasSensitiveAccess(tx, caseId, actor);
      for (const key of keys as string[]) {
        const native = CASE_CANONICAL_FIELD_REGISTRY.find((f) => f.key === key),
          custom = definition?.fields.find((f) => f.key === key);
        if (!native && !custom)
          throw new BadRequestException('Unregistered allocation field');
        if (
          (definition?.fieldPolicies?.find((p) => p.key === key)
            ?.sensitivity === 'RESTRICTED' ||
            custom?.sensitivity === 'RESTRICTED') &&
          !sensitive
        )
          throw new ForbiddenException('Protected allocation field');
        let value: unknown = record;
        const path = native
          ? native.column.split('.')
          : ['metadata', '_customFields', key];
        for (const part of path)
          value =
            value && typeof value === 'object'
              ? (value as Record<string, unknown>)[part]
              : undefined;
        const metadata = record.metadata as Record<string, unknown> | null,
          clears = metadata?._canonicalClears as
            | Record<string, unknown>
            | undefined,
          state =
            native && clears?.[native.column] === true
              ? 'CLEARED'
              : value === undefined || value === null
                ? 'UNKNOWN'
                : 'CANONICAL';
        const normalized =
          value === undefined
            ? null
            : (JSON.parse(JSON.stringify(value)) as unknown);
        result.fields.push({
          key,
          column: native?.column ?? 'metadata._customFields.' + key,
          valueHash: configurationHash(normalized),
          state,
          caseUpdatedAt: record.updatedAt.toISOString(),
          statisticUpdatedAt: native?.column.startsWith('statistic.')
            ? (record.statistic?.updatedAt.toISOString() ?? null)
            : null,
          fieldDefinitionVersionId: record.fieldDefinitionVersionId,
        });
      }
    }
    return result;
  }
}
