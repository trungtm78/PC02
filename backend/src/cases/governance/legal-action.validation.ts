import { BadRequestException, ConflictException } from '@nestjs/common';
import { CaseInvestigationPhase, CaseStatus } from '@prisma/client';
import { CASE_ACTION_CATALOG } from './legal-action.catalog';
import {
  nonblank,
  object,
  validateDecision,
} from './legal-workflow.validation';
export function planLegalAction(
  code: string,
  record: { status: string; investigationPhase: string | null },
  raw: unknown,
) {
  const payload = object(raw),
    decision = validateDecision(payload.decision),
    action = CASE_ACTION_CATALOG.find((a) => a.code === code);
  if (action) {
    if (
      record.status !== action.source.status ||
      record.investigationPhase !== action.source.phase
    )
      throw new ConflictException('Action source state/phase mismatch');
    if (
      action.source.expirationEvaluation &&
      payload.expirationEvaluation !== action.source.expirationEvaluation
    )
      throw new BadRequestException('Verified expiration evaluation required');
    if (action.resultType === 'TRANSFER')
      nonblank(payload.destinationAgency, 'External destination agency');
    if (action.resultType === 'MERGE')
      nonblank(payload.targetCaseId, 'Merge target');
    if (
      action.resultType === 'EVALUATION' &&
      payload.expirationEvaluation !== 'EXPIRED_VERIFIED'
    )
      throw new BadRequestException('Verified evaluation facts required');
    return {
      status: action.target.status as CaseStatus,
      investigationPhase: action.target.phase as CaseInvestigationPhase | null,
      decision,
      resultType: action.resultType,
      expirationEvaluation: action.target.expirationEvaluation,
    };
  }
  if (code === 'VERIFY_PHASE') {
    if (
      record.status !== 'DANG_DIEU_TRA' ||
      record.investigationPhase !== null ||
      !Object.values(CaseInvestigationPhase).includes(
        payload.verifiedPhase as CaseInvestigationPhase,
      )
    )
      throw new ConflictException(
        'Explicit unknown-phase verification required',
      );
    return {
      status: record.status as CaseStatus,
      investigationPhase: payload.verifiedPhase as CaseInvestigationPhase,
      decision,
      resultType: 'VERIFICATION',
    };
  }
  if (
    ![
      'SPLIT_CASE',
      'CORRECT_DECISION',
      'LINK_RELATED',
      'LINK_SOURCE',
      'CLASSIFY_SENSITIVITY',
    ].includes(code)
  )
    throw new BadRequestException('Unknown action code');
  if (code === 'SPLIT_CASE') object(payload.newCase);
  if (code === 'CORRECT_DECISION')
    nonblank(payload.correctedDecisionId, 'Original decision');
  if (code === 'LINK_RELATED') nonblank(payload.targetCaseId, 'Related target');
  if (code === 'LINK_SOURCE') {
    if (!['INCIDENT', 'PETITION'].includes(String(payload.sourceType)))
      throw new BadRequestException('Explicit source type required');
    nonblank(payload.sourceId, 'Source identity');
  }
  if (code === 'CLASSIFY_SENSITIVITY') {
    if (
      payload.sensitivity !== 'NORMAL' &&
      payload.sensitivity !== 'RESTRICTED'
    )
      throw new BadRequestException('Known sensitivity required');
    nonblank(payload.reason, 'Classification reason');
    nonblank(payload.inspectionPurpose, 'Classification purpose');
  }
  return {
    status: record.status as CaseStatus,
    investigationPhase:
      record.investigationPhase as CaseInvestigationPhase | null,
    decision,
    resultType: code,
  };
}
