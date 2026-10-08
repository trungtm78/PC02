import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Case, CaseActionRequest, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentNumbersService } from '../../document-numbers/document-numbers.service';
import { CaseEvidenceGovernanceService } from '../evidence-governance/evidence-governance.service';
import { machMocGiaiQuyet } from '../../common/trang-thai/trang-thai-ket-thuc';
import { CaseGovernanceService } from './case-governance.service';
import {
  ActorContext,
  MutationInput,
  canonicalJson,
} from './case-governance.contract';
import { configurationHash } from './case-configuration.service';
import {
  ADDITIONAL_ACTIONS,
  validateRuleDefinition,
} from './configuration.validation';
import { CASE_ACTION_CATALOG } from './legal-action.catalog';
import {
  nativePolicyAliases,
  isPublishedFieldSchema,
  CASE_FIELD_POLICY_CATALOG,
  assertNativeFieldWrites,
} from './case-native-field-policy';
import type { FieldDefinition } from './configuration.validation';
import { SplitAllocationService } from './split-allocation.service';
import { LoaiUyThac } from '@prisma/client';
import {
  evaluateDeadlineEffect,
  getDeadlineEffectRequiredInputs,
} from './case-deadline-effect';
import {
  civilDate,
  evaluateCondition,
  nonblank,
  object,
  ownFact,
} from './legal-workflow.validation';
import { planLegalAction } from './legal-action.validation';
type Tx = Prisma.TransactionClient;
export interface ActionVersion {
  requestKey: string;
  expectedUpdatedAt: string;
  expectedAggregateUpdatedAt: string;
  expectedRevision: number;
}
export interface ActionCreate {
  requestKey: string;
  expectedUpdatedAt: string;
  actionCode: string;
  ruleVersionId: string;
  payload: unknown;
}
@Injectable()
export class LegalWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CaseGovernanceService,
    @Optional() private readonly numbers?: DocumentNumbersService,
    @Optional() private readonly evidence?: CaseEvidenceGovernanceService,
  ) {}
  async actionCapabilities(
    caseId: string,
    actor: ActorContext,
    requestId?: string,
    asOf?: string,
    inspectionPurpose?: string,
  ) {
    const record = inspectionPurpose
        ? await this.core.assertClassificationInspectable(
            this.prisma,
            caseId,
            actor,
            nonblank(inspectionPurpose, 'Inspection purpose'),
          )
        : await this.core.assertCaseReadable(this.prisma, caseId, actor),
      date = civilDate(asOf ?? new Date().toISOString().slice(0, 10));
    const [flag, pending, operate, rules] = await Promise.all([
      this.prisma.featureFlag.findUnique({
        where: { key: 'CASE_GOVERNANCE_V1' },
      }),
      this.prisma.caseHandoff.findFirst({
        where: { caseId, state: 'PENDING' },
      }),
      this.core.hasCapability(this.prisma, actor.actorId, 'operate'),
      this.prisma.caseRuleVersion.findMany({
        where: {
          status: 'PUBLISHED',
          sourceVerified: true,
          effectiveFrom: { lte: date },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: date } }],
        },
        orderBy: { revision: 'desc' },
      }),
    ]);
    let writable = true;
    try {
      await this.core.assertCaseWritable(this.prisma, caseId, actor);
    } catch {
      writable = false;
    }
    const request = requestId
      ? await this.prisma.caseActionRequest.findFirst({
          where: { id: requestId, caseId },
        })
      : null;
    if (requestId && !request)
      throw new NotFoundException('Action request not found');
    const fieldSchema = record.fieldDefinitionVersionId
        ? await this.prisma.caseFieldDefinitionVersion.findUnique({
            where: { id: record.fieldDefinitionVersionId },
          })
        : null,
      sensitive = fieldSchema
        ? await this.core.hasSensitiveAccess(this.prisma, caseId, actor)
        : false;
    const hidden =
        (
          fieldSchema?.definition as unknown as FieldDefinition | undefined
        )?.fieldPolicies?.filter(
          (p) => p.sensitivity === 'RESTRICTED' && !sensitive,
        ) ?? [],
      hiddenNames = new Set(hidden.flatMap((p) => nativePolicyAliases(p.key)));
    const actions = [] as {
      code: string;
      legacyId?: number;
      allowed: boolean;
      ready: boolean;
      reasons: string[];
      requiredFields: string[];
      ruleVersionIds: string[];
    }[];
    for (const code of [
      ...CASE_ACTION_CATALOG.map((a) => a.code),
      ...ADDITIONAL_ACTIONS,
    ]) {
      const item = CASE_ACTION_CATALOG.find((a) => a.code === code),
        reasons: string[] = [];
      if (inspectionPurpose && code !== 'CLASSIFY_SENSITIVITY')
        reasons.push('CLASSIFICATION_INSPECTION_ONLY');
      if (code === 'CLASSIFY_SENSITIVITY') {
        try {
          await this.core.assertClassificationInspectable(
            this.prisma,
            caseId,
            actor,
            inspectionPurpose ?? 'Classification capability inspection',
          );
        } catch {
          reasons.push('CLASSIFICATION_AUTHORITY_REQUIRED');
        }
      }
      if (!flag?.enabled) reasons.push('GOVERNANCE_DISABLED');
      if (pending || record.intakeStage === 'CHO_NHAN')
        reasons.push('PENDING_HANDOFF');
      if (!operate) reasons.push('OPERATE_AUTHORITY_REQUIRED');
      if (!writable) reasons.push('CASE_WRITE_AUTHORITY_REQUIRED');
      if (item && record.status !== item.source.status)
        reasons.push('SOURCE_STATUS_MISMATCH');
      if (item?.source.phase && record.investigationPhase !== item.source.phase)
        reasons.push(
          record.investigationPhase === null
            ? 'PHASE_VERIFICATION_REQUIRED'
            : 'SOURCE_PHASE_MISMATCH',
        );
      if (
        code === 'VERIFY_PHASE' &&
        (record.status !== 'DANG_DIEU_TRA' ||
          record.investigationPhase !== null)
      )
        reasons.push('UNKNOWN_INVESTIGATION_PHASE_REQUIRED');
      const usable = rules.filter(
        (rule) =>
          rule.approvedHash === rule.contentHash &&
          rule.approvedRevision === rule.revision &&
          !!rule.reviewedById &&
          rule.reviewedById !== rule.authorId &&
          (object(rule.definition).actions as Record<string, unknown>[]).some(
            (a) => a.code === code,
          ),
      );
      if (!usable.length) reasons.push('PUBLISHED_RULE_REQUIRED');
      if (
        code === 'DISCONTINUE_EXPIRED' &&
        !(await this.prisma.caseDecision.findFirst({
          where: {
            caseId,
            request: { actionCode: 'REVIEW_EXPIRY', status: 'EXECUTED' },
          },
        }))
      )
        reasons.push('APPROVED_EXPIRATION_EVALUATION_REQUIRED');
      if (
        usable.some((rule) => {
          const a = (
            object(rule.definition).actions as Record<string, unknown>[]
          ).find((x) => x.code === code)!;
          const paths = [
            ...((a.requiredFields ?? []) as string[]),
            ...(a.deadlineEffect ? getDeadlineEffectRequiredInputs(a) : []),
          ];
          function collect(c: unknown) {
            if (!c || typeof c !== 'object') return;
            const n = c as Record<string, unknown>;
            if (typeof n.path === 'string') paths.push(n.path);
            for (const group of [n.all, n.any])
              if (Array.isArray(group)) group.forEach(collect);
          }
          collect(a.conditions);
          return paths.some(
            (path) =>
              path.startsWith('case.') &&
              ((path.startsWith('case.metadata.') && hidden.length > 0) ||
                path.split('.').some((part) => hiddenNames.has(part))),
          );
        })
      )
        reasons.push('PROTECTED_FACT_AUTHORITY_REQUIRED');
      const allowed = reasons.length === 0;
      let ready = false;
      if (request?.actionCode === code) {
        if (
          request.status !== 'APPROVED' ||
          !request.reviewedById ||
          request.reviewedById === request.authorId ||
          request.approvedHash !== request.contentHash ||
          request.approvedRevision !== request.revision
        )
          reasons.push('EXACT_APPROVAL_REQUIRED');
        else if (allowed) {
          try {
            await this.readiness(this.prisma, record, request, actor);
            ready = await this.core.hasCapability(
              this.prisma,
              request.reviewedById,
              'review',
            );
            if (!ready) reasons.push('REVIEWER_AUTHORITY_REQUIRED');
          } catch (error) {
            reasons.push(
              error instanceof ForbiddenException
                ? 'AUTHORITY_OR_PROTECTED_FACT_REQUIRED'
                : error instanceof ConflictException
                  ? 'SOURCE_OR_CASE_VERSION_CHANGED'
                  : 'COMPLETE_VERIFIED_FACTS_REQUIRED',
            );
          }
        }
      } else reasons.push('DECISION_FACTS_AND_APPROVAL_REQUIRED');
      const requiredFields = [
        ...new Set([
          ...((item?.required ?? []) as string[]),
          'decision.type',
          'decision.number',
          'decision.date',
          'decision.effectiveDate',
          'decision.issuer',
          'decision.signatory',
          'decision.legalBasis',
          'decision.sourceDocumentId',
        ]),
      ];
      actions.push({
        code,
        ...(item ? { legacyId: item.legacyId } : {}),
        allowed,
        ready,
        reasons,
        requiredFields,
        ruleVersionIds: usable.map((r) => r.id),
      });
    }
    return {
      success: true,
      data: {
        caseId,
        status: record.status,
        investigationPhase: record.investigationPhase,
        configurationAsOf: date.toISOString().slice(0, 10),
        actions,
      },
    };
  }
  catalog() {
    return {
      success: true,
      data: {
        actions: CASE_ACTION_CATALOG,
        additionalActions: ADDITIONAL_ACTIONS,
        fieldPolicyCatalog: CASE_FIELD_POLICY_CATALOG,
        legalPublication: 'REQUIRES_PER_ACTION_REVIEW',
      },
    };
  }
  async list(caseId: string, actor: ActorContext) {
    await this.core.assertCaseReadable(this.prisma, caseId, actor);
    return this.core.serializeCaseResult(
      this.prisma,
      caseId,
      {
        success: true,
        data: {
          requests: await this.prisma.caseActionRequest.findMany({
            where: { caseId },
            orderBy: { createdAt: 'desc' },
          }),
          decisions: await this.prisma.caseDecision.findMany({
            where: { caseId },
            orderBy: { createdAt: 'desc' },
          }),
        },
      },
      actor,
    );
  }
  private hash(actionCode: string, ruleVersionId: string, payload: unknown) {
    return configurationHash({ actionCode, ruleVersionId, payload });
  }
  private input(
    caseId: string,
    operation: string,
    dto: { requestKey: string; expectedUpdatedAt: string },
    payload: unknown,
  ): MutationInput {
    return {
      caseId,
      operation,
      requestKey: dto.requestKey,
      expectedUpdatedAt: dto.expectedUpdatedAt,
      payload,
    };
  }
  private async load(tx: Tx, caseId: string, id: string, dto: ActionVersion) {
    const row = await tx.caseActionRequest.findFirst({ where: { id, caseId } });
    if (!row) throw new NotFoundException('Action request not found');
    const expected = new Date(dto.expectedAggregateUpdatedAt);
    if (
      !Number.isSafeInteger(dto.expectedRevision) ||
      dto.expectedRevision !== row.revision ||
      !Number.isFinite(expected.getTime()) ||
      expected.getTime() !== row.updatedAt.getTime()
    )
      throw new ConflictException('Request version changed');
    return row;
  }
  private async update(
    tx: Tx,
    row: CaseActionRequest,
    data: Prisma.CaseActionRequestUncheckedUpdateManyInput,
  ) {
    const result = await tx.caseActionRequest.updateMany({
      where: {
        id: row.id,
        caseId: row.caseId,
        revision: row.revision,
        updatedAt: row.updatedAt,
        status: row.status,
      },
      data,
    });
    if (result.count !== 1)
      throw new ConflictException('Request concurrently changed');
  }
  async create(caseId: string, dto: ActionCreate, actor: ActorContext) {
    const payload = object(dto.payload);
    if (
      ['sourceSnapshot', 'allocationSnapshot', 'utdtSourceSnapshot'].some(
        (key) => Object.prototype.hasOwnProperty.call(payload, key),
      )
    )
      throw new BadRequestException('Server-owned sourceSnapshot');
    if (
      ![
        ...CASE_ACTION_CATALOG.map((a) => a.code),
        ...ADDITIONAL_ACTIONS,
      ].includes(dto.actionCode)
    )
      throw new BadRequestException('Unknown action');
    return this.core.mutateCase(
      this.input(caseId, 'LEGAL_ACTION_CREATE', dto, {
        actionCode: dto.actionCode,
        ruleVersionId: dto.ruleVersionId,
        payload,
      }),
      actor,
      async (tx, { operationId }) => {
        const rule = await tx.caseRuleVersion.findUnique({
          where: { id: dto.ruleVersionId },
        });
        if (!rule || rule.status !== 'PUBLISHED' || !rule.sourceVerified)
          throw new BadRequestException(
            'Published legally verified rule required',
          );
        const prepared = await this.preparePayload(
          tx,
          caseId,
          payload,
          actor,
          dto.actionCode,
        );
        const row = await tx.caseActionRequest.create({
          data: {
            caseId,
            actionCode: dto.actionCode,
            ruleVersionId: rule.id,
            payload: prepared as Prisma.InputJsonValue,
            contentHash: this.hash(dto.actionCode, rule.id, prepared),
            authorId: actor.actorId,
          },
        });
        await this.core.recordEvent(
          tx,
          caseId,
          operationId,
          actor.actorId,
          'ACTION_DRAFTED',
          { requestId: row.id, actionCode: row.actionCode },
        );
        return { success: true, data: row };
      },
    );
  }
  async revise(
    caseId: string,
    id: string,
    dto: ActionVersion & { payload: unknown },
    actor: ActorContext,
  ) {
    const payload = object(dto.payload);
    if (
      ['sourceSnapshot', 'allocationSnapshot', 'utdtSourceSnapshot'].some(
        (key) => Object.prototype.hasOwnProperty.call(payload, key),
      )
    )
      throw new BadRequestException('Server-owned sourceSnapshot');
    return this.core.mutateCase(
      this.input(caseId, 'LEGAL_ACTION_REVISE', dto, {
        requestId: id,
        payload,
        revision: dto.expectedRevision,
      }),
      actor,
      async (tx, { operationId }) => {
        const row = await this.load(tx, caseId, id, dto);
        if (row.authorId !== actor.actorId || row.status === 'EXECUTED')
          throw new ForbiddenException('Editable author request required');
        if (
          row.actionCode === 'CLASSIFY_SENSITIVITY' &&
          payload.inspectionPurpose !== object(row.payload).inspectionPurpose
        )
          throw new BadRequestException('Classification purpose is immutable');
        const prepared = await this.preparePayload(
          tx,
          caseId,
          payload,
          actor,
          row.actionCode,
        );
        await this.update(tx, row, {
          payload: prepared as Prisma.InputJsonValue,
          revision: { increment: 1 },
          status: 'DRAFT',
          contentHash: this.hash(row.actionCode, row.ruleVersionId, prepared),
          submittedAt: null,
          reviewedAt: null,
          reviewedById: null,
          approvedHash: null,
          approvedRevision: null,
          reviewNote: null,
        });
        await tx.caseGovernanceTask.updateMany({
          where: {
            caseId,
            type: 'ACTION_REVIEW',
            sourceId: id,
            status: 'OPEN',
          },
          data: { status: 'CANCELLED' },
        });
        await this.core.recordEvent(
          tx,
          caseId,
          operationId,
          actor.actorId,
          'ACTION_REVISED',
          {
            requestId: id,
            revision: row.revision + 1,
            approvalInvalidated: true,
          },
        );
        return {
          success: true,
          data: await tx.caseActionRequest.findUnique({ where: { id } }),
        };
      },
    );
  }
  private async readiness(
    tx: Tx,
    record: Case,
    row: CaseActionRequest,
    actor: ActorContext,
  ) {
    const payload = object(row.payload),
      plan = planLegalAction(row.actionCode, record, payload),
      rule = await tx.caseRuleVersion.findUnique({
        where: { id: row.ruleVersionId },
      });
    if (
      !rule ||
      rule.status !== 'PUBLISHED' ||
      !rule.sourceVerified ||
      !rule.effectiveFrom
    )
      throw new BadRequestException('Published verified rule required');
    validateRuleDefinition(rule.definition);
    if (
      rule.approvedHash !== rule.contentHash ||
      rule.approvedRevision !== rule.revision ||
      !rule.reviewedById ||
      rule.reviewedById === rule.authorId
    )
      throw new ForbiddenException('Rule review integrity failed');
    const date = plan.decision.effectiveDate;
    if (
      date < rule.effectiveFrom ||
      (rule.effectiveTo && date >= rule.effectiveTo)
    )
      throw new BadRequestException('Rule outside legal effective interval');
    const definition = (
      object(rule.definition).actions as Record<string, unknown>[]
    ).find((a) => a.code === row.actionCode);
    if (!definition)
      throw new BadRequestException('Action absent from published rule');
    if (record.fieldDefinitionVersionId) {
      const fields = await tx.caseFieldDefinitionVersion.findUnique({
        where: { id: record.fieldDefinitionVersionId },
      });
      if (!fields || !isPublishedFieldSchema(fields))
        throw new ForbiddenException('Pinned field policy unavailable');
      const sensitive = await this.core.hasSensitiveAccess(
          tx,
          record.id,
          actor,
        ),
        hidden =
          (
            fields.definition as unknown as FieldDefinition
          ).fieldPolicies?.filter(
            (p) => p.sensitivity === 'RESTRICTED' && !sensitive,
          ) ?? [];
      if (hidden.length) {
        const names = new Set(
            hidden.flatMap((p) => nativePolicyAliases(p.key)),
          ),
          paths = [
            ...((definition.requiredFields ?? []) as string[]),
            ...(definition.deadlineEffect
              ? getDeadlineEffectRequiredInputs(definition)
              : []),
          ];
        function collect(raw: unknown) {
          if (!raw || typeof raw !== 'object') return;
          const node = raw as Record<string, unknown>;
          if (typeof node.path === 'string') paths.push(node.path);
          for (const group of [node.all, node.any])
            if (Array.isArray(group)) group.forEach(collect);
        }
        collect(definition.conditions);
        if (
          paths.some(
            (path) =>
              path.startsWith('case.') &&
              (path.startsWith('case.metadata.') ||
                path.split('.').some((p) => names.has(p)) ||
                names.has(path.slice(5))),
          )
        )
          throw new ForbiddenException('Rule requires protected native facts');
      }
    }
    for (const raw of definition.legalSources as unknown[]) {
      const source = object(raw);
      if (
        date < civilDate(source.effectiveFrom) ||
        (source.effectiveTo && date >= civilDate(source.effectiveTo))
      )
        throw new BadRequestException('Provision outside effective interval');
    }
    if (
      definition.conditions &&
      !evaluateCondition(definition.conditions, { case: record, payload })
    )
      throw new BadRequestException('Published rule conditions not satisfied');
    for (const path of (definition.requiredFields ?? []) as string[]) {
      const value = ownFact({ case: record, payload }, path);
      if (value === undefined || value === null || value === '')
        throw new BadRequestException(`Missing required fact ${path}`);
    }
    if (
      !(await tx.document.findFirst({
        where: {
          id: plan.decision.sourceDocumentId,
          deletedAt: null,
        },
      }))
    )
      throw new ForbiddenException(
        'Decision source document must belong to authorized case',
      );
    if (!this.evidence || !payload.sourceSnapshot)
      throw new BadRequestException(
        'Verified immutable source snapshot required',
      );
    const currentSource = await this.evidence.decisionSourceSnapshot(
      tx,
      record.id,
      plan.decision.sourceDocumentId,
      actor,
      row.actionCode === 'CLASSIFY_SENSITIVITY'
        ? nonblank(payload.inspectionPurpose, 'Classification purpose')
        : undefined,
    );
    if (canonicalJson(currentSource) !== canonicalJson(payload.sourceSnapshot))
      throw new ConflictException(
        'Legal source snapshot changed; revise and review again',
      );
    if (row.actionCode === 'CLASSIFY_SENSITIVITY')
      await this.core.assertClassificationInspectable(
        tx,
        record.id,
        actor,
        nonblank(payload.inspectionPurpose, 'Classification purpose'),
      );
    if (row.actionCode === 'SPLIT_CASE') {
      const allowed = (definition.allowedCaseTypes ?? ['REGULAR']) as string[];
      if (!allowed.includes(record.caseType))
        throw new ForbiddenException(
          'Published rule must explicitly authorize this Case type',
        );
      const current = await new SplitAllocationService(
        this.core,
        this.evidence,
      ).snapshot(tx, record.id, payload.allocation, actor);
      if (canonicalJson(current) !== canonicalJson(payload.allocationSnapshot))
        throw new ConflictException(
          'Allocation source version changed; revise and review',
        );
      const child = object(payload.newCase);
      if (record.caseType === 'UY_THAC_DIEU_TRA') {
        nonblank(child.soQuyetDinhUyThac, 'New delegation identity');
        nonblank(child.donViGiao, 'Delegating agency');
        civilDate(child.thoiHanUyThac);
        if (
          !Object.values(LoaiUyThac).includes(child.loaiUyThac as LoaiUyThac) ||
          child.soQuyetDinhUyThac === record.soQuyetDinhUyThac
        )
          throw new BadRequestException(
            'Explicit distinct delegation facts required',
          );
        const pin = await this.evidence.decisionSourceSnapshot(
          tx,
          record.id,
          nonblank(child.uyThacSourceDocumentId, 'Delegation source'),
          actor,
        );
        if (canonicalJson(pin) !== canonicalJson(payload.utdtSourceSnapshot))
          throw new ConflictException('Delegation source snapshot changed');
      }
    }
    if (row.actionCode === 'DISCONTINUE_EXPIRED') {
      const evaluation = await tx.caseDecision.findFirst({
        where: {
          caseId: record.id,
          request: { actionCode: 'REVIEW_EXPIRY', status: 'EXECUTED' },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (
        !evaluation ||
        object(evaluation.facts).expirationEvaluation !== 'EXPIRED_VERIFIED'
      )
        throw new BadRequestException(
          'Persisted approved expiration evaluation required',
        );
    }
    if (plan.resultType === 'MERGE' || row.actionCode === 'LINK_RELATED')
      await this.assertRelation(
        tx,
        record.id,
        nonblank(payload.targetCaseId, 'Target'),
        actor,
      );
    if (
      row.actionCode === 'CORRECT_DECISION' &&
      !(await tx.caseDecision.findFirst({
        where: { id: String(payload.correctedDecisionId), caseId: record.id },
      }))
    )
      throw new BadRequestException('Original decision unavailable');
    if (row.actionCode === 'CORRECT_DECISION' && payload.relationId) {
      const relation = await tx.caseRelation.findFirst({
        where: {
          id: nonblank(payload.relationId, 'Relation'),
          sourceCaseId: record.id,
          revokedAt: null,
          deletedAt: null,
        },
      });
      if (
        !relation ||
        !Number.isSafeInteger(payload.expectedRelationRevision) ||
        relation.revision !== payload.expectedRelationRevision
      )
        throw new ConflictException('Relation revision changed');
      if (relation.decisionId !== payload.correctedDecisionId)
        throw new BadRequestException(
          'Correction must bind original relation decision',
        );
      nonblank(payload.reason, 'Reviewed revocation reason');
      await this.core.assertCaseWritable(tx, relation.targetCaseId, actor);
    }
    const deadlineEffect = evaluateDeadlineEffect(
      {
        ...definition,
        deadlineEffect: definition.deadlineEffect ?? { mode: 'PRESERVE' },
      },
      record,
      payload,
    );
    if (record.fieldDefinitionVersionId) {
      const schema = await tx.caseFieldDefinitionVersion.findUnique({
        where: { id: record.fieldDefinitionVersionId },
      });
      if (!schema || !isPublishedFieldSchema(schema))
        throw new ForbiddenException('Pinned field policy unavailable');
      assertNativeFieldWrites(
        {
          status: plan.status,
          investigationPhase: plan.investigationPhase,
          deadline: deadlineEffect.deadline,
          ...(row.actionCode === 'CLASSIFY_SENSITIVITY'
            ? { sensitivity: payload.sensitivity }
            : {}),
          ...machMocGiaiQuyet(
            'case',
            record.status,
            plan.status,
            record.ngayGiaiQuyet,
            plan.decision.effectiveDate,
          ),
        },
        record,
        (schema.definition as unknown as FieldDefinition).fieldPolicies ?? [],
        await this.core.hasSensitiveAccess(tx, record.id, actor),
      );
    }
    return { plan, payload, rule, deadlineEffect };
  }
  private async preparePayload(
    tx: Tx,
    caseId: string,
    payload: Record<string, unknown>,
    actor: ActorContext,
    actionCode: string,
  ) {
    const prepared = { ...payload },
      decision = payload.decision ? object(payload.decision) : {};
    if (actionCode === 'CLASSIFY_SENSITIVITY')
      await this.core.assertClassificationInspectable(
        tx,
        caseId,
        actor,
        nonblank(payload.inspectionPurpose, 'Classification purpose'),
      );
    if (
      typeof decision.sourceDocumentId === 'string' &&
      decision.sourceDocumentId.trim()
    ) {
      if (!this.evidence)
        throw new BadRequestException('Legal source verification unavailable');
      prepared.sourceSnapshot = await this.evidence.decisionSourceSnapshot(
        tx,
        caseId,
        decision.sourceDocumentId,
        actor,
        actionCode === 'CLASSIFY_SENSITIVITY'
          ? nonblank(payload.inspectionPurpose, 'Classification purpose')
          : undefined,
      );
    }
    if (actionCode === 'SPLIT_CASE') {
      if (!this.evidence)
        throw new BadRequestException(
          'Allocation source verification unavailable',
        );
      prepared.allocationSnapshot = await new SplitAllocationService(
        this.core,
        this.evidence,
      ).snapshot(tx, caseId, payload.allocation, actor);
      const child = object(payload.newCase);
      if (child.uyThacSourceDocumentId)
        prepared.utdtSourceSnapshot =
          await this.evidence.decisionSourceSnapshot(
            tx,
            caseId,
            nonblank(child.uyThacSourceDocumentId, 'Delegation source'),
            actor,
          );
    }
    return prepared;
  }
  async submit(
    caseId: string,
    id: string,
    dto: ActionVersion & { reviewerId?: string },
    actor: ActorContext,
  ) {
    return this.core.mutateCase(
      this.input(caseId, 'LEGAL_ACTION_SUBMIT', dto, {
        requestId: id,
        revision: dto.expectedRevision,
        reviewerId: dto.reviewerId,
      }),
      actor,
      async (tx, { caseRecord, operationId }) => {
        const row = await this.load(tx, caseId, id, dto);
        if (row.authorId !== actor.actorId || row.status !== 'DRAFT')
          throw new ForbiddenException('Author draft required');
        await this.readiness(tx, caseRecord, row, actor);
        if (dto.reviewerId) {
          if (
            dto.reviewerId === actor.actorId ||
            !(await this.core.hasCapability(tx, dto.reviewerId, 'review'))
          )
            throw new ForbiddenException(
              'Independent authorized reviewer required',
            );
          if (row.actionCode === 'CLASSIFY_SENSITIVITY')
            await this.core.assertClassificationInspectable(
              tx,
              caseId,
              { actorId: dto.reviewerId },
              nonblank(
                object(row.payload).inspectionPurpose,
                'Classification purpose',
              ),
            );
          else
            await this.core.assertCaseWritable(tx, caseId, {
              actorId: dto.reviewerId,
            });
        }
        await this.update(tx, row, {
          status: 'SUBMITTED',
          submittedAt: new Date(),
        });
        await tx.caseGovernanceTask.upsert({
          where: {
            caseId_type_sourceId: {
              caseId,
              type: 'ACTION_REVIEW',
              sourceId: id,
            },
          },
          create: {
            caseId,
            type: 'ACTION_REVIEW',
            sourceId: id,
            assigneeId: dto.reviewerId,
            payload: { requestId: id, actionCode: row.actionCode },
            dueAt: caseRecord.deadline,
          },
          update: {
            status: 'OPEN',
            assigneeId: dto.reviewerId ?? null,
            dueAt: caseRecord.deadline,
          },
        });
        await this.core.recordEvent(
          tx,
          caseId,
          operationId,
          actor.actorId,
          'ACTION_SUBMITTED',
          { requestId: id, revision: row.revision },
        );
        if (dto.reviewerId)
          await this.core.enqueue(
            tx,
            caseId,
            operationId,
            { type: 'ACTION_REVIEW_REQUIRED', requestId: id },
            [dto.reviewerId],
          );
        return {
          success: true,
          data: await tx.caseActionRequest.findUnique({ where: { id } }),
        };
      },
    );
  }
  async review(
    caseId: string,
    id: string,
    dto: ActionVersion & { approve: boolean; note: string },
    actor: ActorContext,
  ) {
    if (typeof dto.approve !== 'boolean')
      throw new BadRequestException('Review outcome required');
    const note = nonblank(dto.note, 'Review note');
    return this.core.mutateCase(
      this.input(caseId, 'LEGAL_ACTION_REVIEW', dto, {
        requestId: id,
        revision: dto.expectedRevision,
        approve: dto.approve,
        note,
      }),
      actor,
      async (tx, { operationId }) => {
        const row = await this.load(tx, caseId, id, dto);
        if (
          row.authorId === actor.actorId ||
          row.status !== 'SUBMITTED' ||
          !(await this.core.hasCapability(tx, actor.actorId, 'review'))
        )
          throw new ForbiddenException(
            'Independent explicit reviewer required',
          );
        if (
          row.contentHash !==
          this.hash(row.actionCode, row.ruleVersionId, row.payload)
        )
          throw new ConflictException('Request content integrity failed');
        await this.update(tx, row, {
          status: dto.approve ? 'APPROVED' : 'REJECTED',
          reviewedById: actor.actorId,
          reviewedAt: new Date(),
          reviewNote: note,
          approvedHash: dto.approve ? row.contentHash : null,
          approvedRevision: dto.approve ? row.revision : null,
        });
        await tx.caseGovernanceTask.updateMany({
          where: {
            caseId,
            type: 'ACTION_REVIEW',
            sourceId: id,
            status: 'OPEN',
          },
          data: { status: 'COMPLETED' },
        });
        await this.core.recordEvent(
          tx,
          caseId,
          operationId,
          actor.actorId,
          'ACTION_REVIEWED',
          { requestId: id, approve: dto.approve, revision: row.revision },
        );
        await this.core.enqueue(
          tx,
          caseId,
          operationId,
          { type: 'ACTION_REVIEWED', requestId: id },
          [row.authorId],
        );
        return {
          success: true,
          data: await tx.caseActionRequest.findUnique({ where: { id } }),
        };
      },
    );
  }
  async execute(
    caseId: string,
    id: string,
    dto: ActionVersion,
    actor: ActorContext,
  ) {
    return this.core.mutateCase(
      this.input(caseId, 'LEGAL_ACTION_EXECUTE', dto, {
        requestId: id,
        revision: dto.expectedRevision,
      }),
      actor,
      async (tx, { caseRecord, operationId }) => {
        const row = await this.load(tx, caseId, id, dto);
        if (
          row.status !== 'APPROVED' ||
          !row.reviewedById ||
          row.reviewedById === row.authorId ||
          row.approvedHash !== row.contentHash ||
          row.approvedRevision !== row.revision ||
          row.contentHash !==
            this.hash(row.actionCode, row.ruleVersionId, row.payload)
        )
          throw new ForbiddenException('Exact approved request required');
        if (!(await this.core.hasCapability(tx, row.reviewedById, 'review')))
          throw new ForbiddenException('Reviewer no longer authorized');
        if (row.actionCode === 'CLASSIFY_SENSITIVITY')
          await this.core.assertClassificationInspectable(
            tx,
            caseId,
            { actorId: row.reviewedById },
            nonblank(
              object(row.payload).inspectionPurpose,
              'Classification purpose',
            ),
          );
        else
          await this.core.assertCaseWritable(tx, caseId, {
            actorId: row.reviewedById,
          });
        const { plan, payload, rule, deadlineEffect } = await this.readiness(
          tx,
          caseRecord,
          row,
          actor,
        );
        const decision = await tx.caseDecision.create({
          data: {
            caseId,
            requestId: id,
            ruleVersionId: rule.id,
            ...plan.decision,
            facts: {
              ...payload,
              deadlineEvaluation: deadlineEffect.provenance,
            } as Prisma.InputJsonValue,
            contentHash: row.contentHash,
            createdById: actor.actorId,
          },
        });
        let relation: unknown = null;
        if (row.actionCode === 'CLASSIFY_SENSITIVITY') {
          const old = caseRecord.metadata ? object(caseRecord.metadata) : {},
            history = Array.isArray(old._sensitivityHistory)
              ? (old._sensitivityHistory as unknown[])
              : [];
          await tx.case.update({
            where: { id: caseId },
            data: {
              sensitivity: payload.sensitivity as 'NORMAL' | 'RESTRICTED',
              metadata: {
                ...old,
                sensitivity: payload.sensitivity,
                _sensitivity: payload.sensitivity,
                _sensitivityHistory: [
                  ...history,
                  {
                    previous: caseRecord.sensitivity,
                    previousLegacy: {
                      sensitivity: old.sensitivity ?? null,
                      _sensitivity: old._sensitivity ?? null,
                    },
                    newSensitivity: payload.sensitivity,
                    decisionId: decision.id,
                    actorId: actor.actorId,
                    purpose: payload.inspectionPurpose,
                    reason: payload.reason,
                    at: new Date().toISOString(),
                  },
                ],
              } as Prisma.InputJsonValue,
            },
          });
          await this.core.recordEvent(
            tx,
            caseId,
            operationId,
            actor.actorId,
            'SENSITIVITY_CLASSIFIED',
            {
              decisionId: decision.id,
              previous: caseRecord.sensitivity,
              newSensitivity: String(payload.sensitivity),
              purpose: String(payload.inspectionPurpose),
              reason: String(payload.reason),
            },
          );
        }
        if (row.actionCode === 'CORRECT_DECISION' && payload.relationId) {
          const changed = await tx.caseRelation.updateMany({
            where: {
              id: nonblank(payload.relationId, 'Relation'),
              sourceCaseId: caseId,
              decisionId: String(payload.correctedDecisionId),
              revision: payload.expectedRelationRevision as number,
              revokedAt: null,
              deletedAt: null,
            },
            data: {
              revision: { increment: 1 },
              revokedAt: new Date(),
              revokedById: actor.actorId,
            },
          });
          if (changed.count !== 1)
            throw new ConflictException('Relation revision changed');
          relation = {
            id: nonblank(payload.relationId, 'Relation'),
            revision: (payload.expectedRelationRevision as number) + 1,
            revoked: true,
            correctionDecisionId: decision.id,
          };
          await this.core.recordEvent(
            tx,
            caseId,
            operationId,
            actor.actorId,
            'RELATION_REVOKED',
            {
              relationId: nonblank(payload.relationId, 'Relation'),
              originalDecisionId: String(payload.correctedDecisionId),
              correctionDecisionId: decision.id,
              priorRevision: payload.expectedRelationRevision as number,
              reason: String(payload.reason),
            },
          );
        }
        if (plan.resultType === 'MERGE' || row.actionCode === 'LINK_RELATED')
          relation = await tx.caseRelation.create({
            data: {
              sourceCaseId: caseId,
              targetCaseId: String(payload.targetCaseId),
              type: plan.resultType === 'MERGE' ? 'MERGE' : 'RELATED',
              decisionId: decision.id,
              createdById: actor.actorId,
              payload: { preserveChildren: true },
            },
          });
        if (row.actionCode === 'SPLIT_CASE')
          relation = await this.split(
            tx,
            caseRecord,
            payload,
            decision.id,
            actor,
          );
        if (row.actionCode === 'LINK_SOURCE')
          await this.linkSource(tx, caseRecord, payload, actor);
        await tx.case.update({
          where: { id: caseId },
          data: {
            status: plan.status,
            investigationPhase: plan.investigationPhase,
            governanceRuleVersionId: rule.id,
            deadline: deadlineEffect.deadline,
            ...machMocGiaiQuyet(
              'case',
              caseRecord.status,
              plan.status,
              caseRecord.ngayGiaiQuyet,
              plan.decision.effectiveDate,
            ),
          },
        });
        if (caseRecord.status !== plan.status)
          await tx.caseStatusHistory.create({
            data: {
              caseId,
              fromStatus: caseRecord.status,
              toStatus: plan.status,
              changedById: actor.actorId,
              changedAt: plan.decision.effectiveDate,
            },
          });
        await this.update(tx, row, {
          status: 'EXECUTED',
          executedAt: new Date(),
        });
        if (deadlineEffect.provenance.algorithm !== 'PRESERVE')
          await tx.caseGovernanceTask.upsert({
            where: {
              caseId_type_sourceId: {
                caseId,
                type: 'CASE_DEADLINE',
                sourceId: decision.id,
              },
            },
            create: {
              caseId,
              type: 'CASE_DEADLINE',
              sourceId: decision.id,
              assigneeId: caseRecord.investigatorId,
              dueAt: deadlineEffect.deadline,
              payload: {
                decisionId: decision.id,
                ruleVersionId: rule.id,
                deadlineEvaluation: deadlineEffect.provenance,
              },
            },
            update: { dueAt: deadlineEffect.deadline, status: 'OPEN' },
          });
        await this.core.recordEvent(
          tx,
          caseId,
          operationId,
          actor.actorId,
          'ACTION_EXECUTED',
          {
            requestId: id,
            decisionId: decision.id,
            fromStatus: caseRecord.status,
            toStatus: plan.status,
            fromPhase: caseRecord.investigationPhase,
            toPhase: plan.investigationPhase,
            ruleVersionId: rule.id,
            deadlineEvaluation: deadlineEffect.provenance,
          },
        );
        await this.core.enqueue(
          tx,
          caseId,
          operationId,
          { type: 'ACTION_EXECUTED', requestId: id, decisionId: decision.id },
          [
            row.authorId,
            row.reviewedById,
            ...(caseRecord.investigatorId ? [caseRecord.investigatorId] : []),
          ],
        );
        return { success: true, data: { requestId: id, decision, relation } };
      },
    );
  }
  async assertRelation(
    tx: Tx,
    sourceCaseId: string,
    targetCaseId: string,
    actor: ActorContext,
  ) {
    if (sourceCaseId === targetCaseId)
      throw new BadRequestException('Self relation forbidden');
    await this.core.assertCaseWritable(tx, targetCaseId, actor);
    const edges = await tx.caseRelation.findMany({
      where: {
        type: { in: ['MERGE', 'SPLIT', 'RELATED'] },
        revokedAt: null,
        deletedAt: null,
      },
      select: { sourceCaseId: true, targetCaseId: true },
    });
    const visited = new Set<string>(),
      queue = [targetCaseId];
    while (queue.length) {
      const next = queue.pop()!;
      if (next === sourceCaseId)
        throw new ConflictException('Relation cycle forbidden');
      if (visited.has(next)) continue;
      visited.add(next);
      for (const edge of edges)
        if (edge.sourceCaseId === next) queue.push(edge.targetCaseId);
    }
  }
  private async split(
    tx: Tx,
    source: Case,
    payload: Record<string, unknown>,
    decisionId: string,
    actor: ActorContext,
  ) {
    if (!this.numbers)
      throw new BadRequestException('CASE number allocator unavailable');
    const draft = object(payload.newCase);
    if (
      Object.keys(draft).some(
        (k) =>
          ![
            'name',
            'crime',
            'assignedTeamId',
            'allocationBasis',
            'soQuyetDinhUyThac',
            'donViGiao',
            'thoiHanUyThac',
            'loaiUyThac',
            'uyThacSourceDocumentId',
          ].includes(k),
      )
    )
      throw new BadRequestException('Unsupported split fields');
    const name = nonblank(draft.name, 'New Case name'),
      basis = nonblank(draft.allocationBasis, 'Split allocation basis');
    const teamId = nonblank(draft.assignedTeamId, 'Allocated team');
    if (!(await tx.team.findFirst({ where: { id: teamId, isActive: true } })))
      throw new BadRequestException('Allocated team inactive');
    const membership = await tx.user.findUnique({
      where: { id: actor.actorId },
      include: { role: true },
    });
    if (!membership?.isActive) throw new ForbiddenException();
    const scope = await this.core.currentScope(
      tx,
      await tx.user.findUniqueOrThrow({
        where: { id: actor.actorId },
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      }),
    );
    if (scope && !scope.writableTeamIds.includes(teamId))
      throw new ForbiddenException('Split destination outside writable scope');
    const allocated = await this.numbers.commitWithTx(
      'CASE',
      { userId: actor.actorId },
      tx,
    );
    const child = await tx.case.create({
      data: {
        name,
        crime: typeof draft.crime === 'string' ? draft.crime : null,
        caseCode: allocated.number,
        assignedTeamId: teamId,
        createdById: actor.actorId,
        caseProvenance: 'OTHER_LEGAL_SOURCE',
        sourceDocumentNote: basis,
        caseType: source.caseType,
        fieldDefinitionVersionId: source.fieldDefinitionVersionId,
        ...(source.caseType === 'UY_THAC_DIEU_TRA'
          ? {
              soQuyetDinhUyThac: nonblank(
                draft.soQuyetDinhUyThac,
                'New delegation identity',
              ),
              donViGiao: nonblank(draft.donViGiao, 'Delegating agency'),
              thoiHanUyThac: civilDate(draft.thoiHanUyThac),
              loaiUyThac: draft.loaiUyThac as LoaiUyThac,
            }
          : {}),
        metadata: {
          _splitProvenance: {
            sourceCaseId: source.id,
            decisionId,
            allocationBasis: basis,
          },
        },
        sensitivity:
          source.sensitivity === 'RESTRICTED' ||
          (source.metadata &&
            ((source.metadata as Record<string, unknown>).sensitivity ===
              'RESTRICTED' ||
              (source.metadata as Record<string, unknown>)._sensitivity ===
                'RESTRICTED'))
            ? 'RESTRICTED'
            : 'NORMAL',
        status: 'TIEP_NHAN',
        intakeStage: 'PHAN_LOAI',
      },
    });
    await tx.documentNumberLog.update({
      where: { id: allocated.logId },
      data: { documentId: child.id },
    });
    return tx.caseRelation.create({
      data: {
        sourceCaseId: source.id,
        targetCaseId: child.id,
        type: 'SPLIT',
        decisionId,
        createdById: actor.actorId,
        payload: {
          allocationBasis: basis,
          preserveSourceChildren: true,
          allocationSnapshot:
            payload.allocationSnapshot as Prisma.InputJsonValue,
          ...(payload.utdtSourceSnapshot
            ? {
                utdtSourceSnapshot:
                  payload.utdtSourceSnapshot as Prisma.InputJsonValue,
              }
            : {}),
        },
      },
    });
  }
  private async linkSource(
    tx: Tx,
    record: Case,
    payload: Record<string, unknown>,
    actor: ActorContext,
  ) {
    const id = nonblank(payload.sourceId, 'Source identity'),
      expected = new Date(nonblank(payload.sourceUpdatedAt, 'Source version'));
    if (!Number.isFinite(expected.getTime()))
      throw new BadRequestException('Invalid source version');
    if (payload.sourceType === 'INCIDENT') {
      if (record.linkedIncidentId)
        throw new ConflictException('Existing source link immutable');
      const source = await tx.incident.findFirst({
        where: { id, deletedAt: null, updatedAt: expected },
      });
      if (!source) throw new ConflictException('Source changed');
      await this.assertSourceScope(tx, source, actor, 'Incident');
      if (source.linkedCaseId && source.linkedCaseId !== record.id)
        throw new ConflictException('Source already linked');
      await tx.incident.update({
        where: { id },
        data: { linkedCaseId: record.id },
      });
      await tx.case.update({
        where: { id: record.id },
        data: { linkedIncidentId: id, caseProvenance: 'FROM_INCIDENT' },
      });
    } else {
      if (record.linkedPetitionId)
        throw new ConflictException('Existing source link immutable');
      const source = await tx.petition.findFirst({
        where: { id, deletedAt: null, updatedAt: expected },
      });
      if (!source) throw new ConflictException('Source changed');
      await this.assertSourceScope(tx, source, actor, 'Petition');
      if (source.linkedCaseId && source.linkedCaseId !== record.id)
        throw new ConflictException('Source already linked');
      await tx.petition.update({
        where: { id },
        data: { linkedCaseId: record.id },
      });
      await tx.case.update({
        where: { id: record.id },
        data: { linkedPetitionId: id, caseProvenance: 'FROM_PETITION' },
      });
    }
  }
  private async assertSourceScope(
    tx: Tx,
    source: {
      createdById?: string | null;
      assignedTeamId?: string | null;
      investigatorId?: string | null;
    },
    actor: ActorContext,
    subject: 'Incident' | 'Petition',
  ) {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: actor.actorId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    if (
      !user.isActive ||
      !['read', 'edit'].every((action) =>
        user.role.permissions.some(
          (p) =>
            p.permission.subject === subject &&
            p.permission.action === action &&
            p.permission.conditions === null,
        ),
      )
    )
      throw new ForbiddenException(
        'Explicit source read/edit permission required',
      );
    const scope = await this.core.currentScope(tx, user);
    if (
      scope &&
      !(
        source.assignedTeamId &&
        scope.writableTeamIds.includes(source.assignedTeamId)
      ) &&
      !(
        source.createdById && scope.writableUserIds.includes(source.createdById)
      ) &&
      source.investigatorId !== actor.actorId
    )
      throw new ForbiddenException('Source outside writable scope');
  }
}
