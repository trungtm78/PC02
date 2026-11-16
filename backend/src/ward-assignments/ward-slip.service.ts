import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, WardAssignmentDecision } from '@prisma/client';
import type { Readable } from 'node:stream';
import { AuditService } from '../audit/audit.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';
import { phanNgayVN } from '../common/utils/thoi-gian-vn.util';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { DynamicExportService } from '../document-templates/dynamic-export.service';
import { rankName } from '../document-templates/ten-nguoi.util';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  WARD_DOCS_AUDIT,
  WARD_DOCS_ERROR,
  WARD_SLIP_NUMBER_SERIES,
  WARD_SLIP_NUMBER_SUFFIX,
  WARD_SLIP_TEMPLATE_CODE,
} from './ward-docs.codes';
import { readableRequest, requestForDocsWrite, requestForRead } from './ward-docs.locks';
import { wardBody } from './ward-errors';
import { buildSlipRecord, SIGNER_KEYS, signersOf, slipStateOf, type WardSlipSigners, type WardSlipUsed } from './ward-slip.record';

type Tx = Prisma.TransactionClient;
type Scope = DataScope | null | undefined;

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SIGNER_MAX = 120;
const REASON_MAX = 500;
/** How many numbers of the series are tried when the next ones were already written by hand. */
const AUTO_NUMBER_TRIES = 500;

export interface SlipSignersInput {
  canBoThamDinh?: string | null;
  chiHuyDoi?: string | null;
  lanhDaoPhong?: string | null;
}

/**
 * The number written by hand: "1949A" or "1949A/PYC-PC02-Đ1" (the series' suffix is added when left out). Digits,
 * then at most three letters. Anything else is refused: the number is printed on a legal document and is unique per
 * year, so it must be read the same way by everybody.
 */
export function manualSlipNumber(value: string): string {
  const t = value.trim().normalize('NFC');
  const bare = t.endsWith(WARD_SLIP_NUMBER_SUFFIX) ? t.slice(0, -WARD_SLIP_NUMBER_SUFFIX.length) : t;
  if (!/^\d{1,6}[A-Za-z]{0,3}$/.test(bare) || /^0+\d/.test(bare)) throw new BadRequestException(wardBody(WARD_DOCS_ERROR.SLIP_NUMBER_INVALID));
  return `${bare.toUpperCase()}${WARD_SLIP_NUMBER_SUFFIX}`;
}

/** The year of the Viet Nam calendar a slip issued at `at` belongs to. */
export function slipYearOf(at: Date): number {
  return phanNgayVN(at)?.nam ?? at.getUTCFullYear();
}

function checkedSigners(input: SlipSignersInput | undefined): Partial<WardSlipSigners> {
  const out: Partial<WardSlipSigners> = {};
  for (const key of SIGNER_KEYS) {
    const v = input?.[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') throw new BadRequestException(wardBody(WARD_DOCS_ERROR.SLIP_SIGNER_TOO_LONG, { field: key }));
    const t = v.trim();
    if (t.length > SIGNER_MAX) throw new BadRequestException(wardBody(WARD_DOCS_ERROR.SLIP_SIGNER_TOO_LONG, { field: key, max: SIGNER_MAX }));
    out[key] = t;
  }
  return out;
}

/** The JSON kept in `signers`: the three names, what the slip printed of the records it names, the stored file's hash. */
const stateJson = (signers: WardSlipSigners, used: WardSlipUsed, fileSha: string): Prisma.InputJsonValue =>
  ({ ...signers, used, fileSha }) as unknown as Prisma.InputJsonValue;

const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === 'P2002';

/**
 * "Phiếu yêu cầu" — the request slip of a decision of PC02 on a ward assignment request (C5, C6).
 *
 * - Issued ONCE per decision, under a row lock of the decision: the number is allocated (or written by hand and
 *   checked unique for its year), the slip rendered with that number, the file stored in the request's documents,
 *   the decision stamped, the render logged and the issue audited, in one transaction. Issuing again returns the same
 *   decision, the same number and the same stored file.
 * - Downloading returns the STORED file, never a new render: the slip of an old decision is what was issued then.
 * - Reissuing ("Phát hành lại") renders again with the same number, for a reason; the new file replaces the stored
 *   one (the old row is kept, soft deleted) and is audited.
 *
 * The only writer of the slip columns of `ward_assignment_decisions` (gate `ward-assignment-writers.gate.spec.ts`).
 */
@Injectable()
export class WardSlipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: DocumentNumbersService,
    private readonly renderer: DynamicExportService,
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
  ) {}

  async issue(
    actor: { id: string },
    scope: Scope,
    assignmentId: string,
    decisionId: string,
    input: { slipNumber?: string | null; signers?: SlipSignersInput },
  ): Promise<WardAssignmentDecision> {
    const manual = input.slipNumber?.trim() ? manualSlipNumber(input.slipNumber) : null;
    const signersAsked = checkedSigners(input.signers);
    const written: string[] = [];
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { assignment, decision } = await this.lockedDecision(tx, scope, actor.id, assignmentId, decisionId);
        if (decision.slipDocumentId) {
          // Issued already: the same slip, whoever asks again (a double click, a retry after a lost answer).
          if (manual && manual !== decision.slipNumber) {
            throw new ConflictException(wardBody(WARD_DOCS_ERROR.SLIP_ALREADY_ISSUED, { slipNumber: decision.slipNumber }));
          }
          return decision;
        }
        if (decision.revokedAt) throw new ConflictException(wardBody(WARD_DOCS_ERROR.SLIP_DECISION_REVOKED));
        const template = await this.activeTemplate(tx);
        const issuedAt = new Date();
        const year = slipYearOf(issuedAt);
        const slipNumber = manual ?? (await this.nextNumber(tx, actor.id, decision.id, year));
        if (manual && (await this.numberTaken(tx, year, manual))) {
          throw new ConflictException(wardBody(WARD_DOCS_ERROR.SLIP_NUMBER_TAKEN, { slipNumber: manual }));
        }
        const signers = { ...(await this.defaultSigners(tx, actor.id)), ...signersAsked };
        const rendered = await this.render(tx, actor.id, assignment, decision, template, slipNumber, issuedAt, signers, null);
        const stored = await this.documents.storeWardGeneratedFile(tx, {
          wardAssignmentId: assignment.id,
          buffer: rendered.buffer,
          originalName: rendered.filename,
          mimeType: DOCX,
          title: `Phiếu yêu cầu ${slipNumber}`,
          actorId: actor.id,
        });
        written.push(stored.fileName);
        const updated = await tx.wardAssignmentDecision.update({
          where: { id: decision.id },
          data: {
            slipYear: year,
            slipNumber: slipNumber,
            slipIssuedAt: issuedAt,
            slipIssuedById: actor.id,
            slipDocumentId: stored.document.id,
            signers: stateJson(signers, rendered.used, rendered.fileSha),
          },
        });
        await this.audit.log(
          {
            userId: actor.id,
            action: WARD_DOCS_AUDIT.SLIP_ISSUED,
            subject: 'WardAssignment',
            subjectId: assignment.id,
            metadata: {
              decisionId: decision.id,
              kind: decision.kind,
              slipNumber,
              slipYear: year,
              manualNumber: manual !== null,
              documentId: stored.document.id,
              templateId: template.id,
              templateSha: template.fileSha,
              fileSha: rendered.fileSha,
            },
          },
          tx,
        );
        return updated;
      });
    } catch (error) {
      for (const name of written) this.documents.discardStoredFile(name);
      if (isUniqueViolation(error)) throw new ConflictException(wardBody(WARD_DOCS_ERROR.SLIP_NUMBER_TAKEN));
      throw error;
    }
  }

  async reissue(
    actor: { id: string },
    scope: Scope,
    assignmentId: string,
    decisionId: string,
    input: { reason?: string | null; signers?: SlipSignersInput },
  ): Promise<WardAssignmentDecision> {
    const reason = (input.reason ?? '').trim();
    if (!reason || reason.length > REASON_MAX) throw new BadRequestException(wardBody(WARD_DOCS_ERROR.SLIP_REASON_REQUIRED, { max: REASON_MAX }));
    const signersAsked = checkedSigners(input.signers);
    const written: string[] = [];
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { assignment, decision } = await this.lockedDecision(tx, scope, actor.id, assignmentId, decisionId);
        if (!decision.slipDocumentId || !decision.slipNumber || !decision.slipIssuedAt) {
          throw new ConflictException(wardBody(WARD_DOCS_ERROR.SLIP_NOT_ISSUED));
        }
        if (decision.revokedAt) throw new ConflictException(wardBody(WARD_DOCS_ERROR.SLIP_DECISION_REVOKED));
        const template = await this.activeTemplate(tx);
        const signers = { ...(await this.defaultSigners(tx, actor.id)), ...signersOf(decision.signers), ...signersAsked };
        // Same number, same date of issue: the slip is the same slip, corrected.
        const rendered = await this.render(
          tx,
          actor.id,
          assignment,
          decision,
          template,
          decision.slipNumber,
          decision.slipIssuedAt,
          signers,
          slipStateOf(decision.signers).used,
        );
        const previous = await tx.document.findUnique({
          where: { id: decision.slipDocumentId },
          select: { id: true, originalName: true },
        });
        const stored = await this.documents.storeWardGeneratedFile(tx, {
          wardAssignmentId: assignment.id,
          buffer: rendered.buffer,
          originalName: rendered.filename,
          mimeType: DOCX,
          title: `Phiếu yêu cầu ${decision.slipNumber}`,
          actorId: actor.id,
        });
        written.push(stored.fileName);
        const updated = await tx.wardAssignmentDecision.update({
          where: { id: decision.id },
          data: { slipDocumentId: stored.document.id, signers: stateJson(signers, rendered.used, rendered.fileSha) },
        });
        // The file it replaces stays on record (row and bytes), out of the lists.
        if (previous) {
          await tx.document.update({ where: { id: previous.id }, data: { deletedAt: new Date() } });
        }
        await this.audit.log(
          {
            userId: actor.id,
            action: WARD_DOCS_AUDIT.SLIP_REISSUED,
            subject: 'WardAssignment',
            subjectId: assignment.id,
            metadata: {
              decisionId: decision.id,
              slipNumber: decision.slipNumber,
              reason,
              documentId: stored.document.id,
              replacedDocumentId: previous?.id ?? null,
              templateId: template.id,
              templateSha: template.fileSha,
              fileSha: rendered.fileSha,
            },
          },
          tx,
        );
        return updated;
      });
    } catch (error) {
      for (const name of written) this.documents.discardStoredFile(name);
      throw error;
    }
  }

  /** The stored slip of a decision, for whoever may read the request: never rendered again. */
  async download(
    actor: { id: string; ipAddress?: string; userAgent?: string },
    scope: Scope,
    assignmentId: string,
    decisionId: string,
  ): Promise<{ stream: Readable; originalName: string; mimeType: string }> {
    await requestForRead(this.prisma, scope, assignmentId);
    const decision = await this.decisionOf(this.prisma, assignmentId, decisionId);
    if (!decision.slipDocumentId) throw new NotFoundException(wardBody(WARD_DOCS_ERROR.SLIP_NOT_ISSUED));
    const documentId = decision.slipDocumentId;
    return this.documents.openWardFile(documentId, assignmentId, { userId: actor.id, ipAddress: actor.ipAddress, userAgent: actor.userAgent }, async () => {
      const row = await this.prisma.wardAssignment.findUnique({ where: { id: assignmentId }, select: { assignedTeamId: true, enteredById: true } });
      if (!row || !readableRequest(row, scope)) throw new NotFoundException(wardBody(WARD_DOCS_ERROR.SLIP_NOT_ISSUED));
      const current = await this.prisma.wardAssignmentDecision.findUnique({ where: { id: decisionId }, select: { slipDocumentId: true } });
      // Reissued meanwhile: the file asked for is not the slip any more.
      if (current?.slipDocumentId !== documentId) throw new ConflictException(wardBody(WARD_DOCS_ERROR.SLIP_NOT_ISSUED));
    }, slipStateOf(decision.signers).fileSha ?? undefined);
  }

  // ── inside ────────────────────────────────────────────────────────────────────────────────────────────────────

  /** The request (review reach, not archived, not by its own unit) and the decision, row-locked. */
  private async lockedDecision(tx: Tx, scope: Scope, actorId: string, assignmentId: string, decisionId: string) {
    const assignment = await requestForDocsWrite(tx, scope, actorId, assignmentId);
    await tx.$queryRaw`SELECT id FROM "ward_assignment_decisions" WHERE id = ${decisionId} FOR UPDATE`;
    const decision = await this.decisionOf(tx, assignmentId, decisionId);
    return { assignment, decision };
  }

  /** The decision, when it is one of this request's (404 otherwise), with its round. */
  private async decisionOf(db: Tx, assignmentId: string, decisionId: string) {
    const decision = await db.wardAssignmentDecision.findUnique({ where: { id: decisionId }, include: { round: true } });
    if (!decision || decision.round.assignmentId !== assignmentId) throw new NotFoundException(wardBody(WARD_DOCS_ERROR.SLIP_DECISION_NOT_FOUND));
    return decision;
  }

  private async activeTemplate(tx: Tx) {
    const template = await tx.documentTemplate.findFirst({
      where: { entityType: 'HO_SO_PHAN_CONG', code: WARD_SLIP_TEMPLATE_CODE, status: 'active', deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (!template) throw new ConflictException(wardBody(WARD_DOCS_ERROR.SLIP_TEMPLATE_MISSING));
    return template;
  }

  private async numberTaken(tx: Tx, year: number, slipNumber: string): Promise<boolean> {
    return (await tx.wardAssignmentDecision.count({ where: { slipYear: year, slipNumber } })) > 0;
  }

  /** The next number of the series that no slip of the year carries (numbers written by hand are stepped over). */
  private async nextNumber(tx: Tx, actorId: string, decisionId: string, year: number): Promise<string> {
    for (let i = 0; i < AUTO_NUMBER_TRIES; i++) {
      const { number } = await this.numbers.commitWithTx(WARD_SLIP_NUMBER_SERIES, { userId: actorId }, tx, { documentId: decisionId });
      if (!(await this.numberTaken(tx, year, number))) return number;
    }
    throw new ConflictException(wardBody(WARD_DOCS_ERROR.SLIP_NUMBER_TAKEN));
  }

  /**
   * Who signs, when the reviewer does not say: the names on the last slip this reviewer issued (R7), the reviewer
   * as "Cán bộ thẩm định", the head of the department of the settings as the leader.
   */
  private async defaultSigners(tx: Tx, actorId: string): Promise<WardSlipSigners> {
    const last = await tx.wardAssignmentDecision.findFirst({
      where: { slipIssuedById: actorId, slipIssuedAt: { not: null } },
      orderBy: { slipIssuedAt: 'desc' },
      select: { signers: true },
    });
    const previous = signersOf(last?.signers);
    const me = await tx.user.findUnique({ where: { id: actorId }, select: { firstName: true, lastName: true, rank: true } });
    let leader = '';
    try {
      const row = await tx.systemSetting.findUnique({ where: { key: SETTINGS_KEY.TEN_TRUONG_PHONG }, select: { value: true } });
      leader = typeof row?.value === 'string' ? row.value.trim() : '';
    } catch {
      leader = '';
    }
    return {
      canBoThamDinh: previous.canBoThamDinh || rankName(me),
      chiHuyDoi: previous.chiHuyDoi ?? '',
      lanhDaoPhong: previous.lanhDaoPhong || leader,
    };
  }

  private async render(
    tx: Tx,
    actorId: string,
    assignment: { id: string; code: string | null; assignedTeamId: string },
    decision: Awaited<ReturnType<WardSlipService['decisionOf']>>,
    template: Awaited<ReturnType<WardSlipService['activeTemplate']>>,
    slipNumber: string,
    issuedAt: Date,
    signers: WardSlipSigners,
    used: WardSlipUsed | null,
  ) {
    const { record, used: printed } = await buildSlipRecord(tx, {
      assignment,
      round: decision.round,
      decision,
      slipNumber,
      slipIssuedAt: issuedAt,
      signers,
      used,
    });
    const rendered = await this.renderer.renderIssuedInTx(tx, {
      entityType: 'HO_SO_PHAN_CONG',
      entityId: assignment.id,
      record: record as unknown as Record<string, unknown>,
      template,
      actorId,
      issued: { documentNumber: slipNumber },
    });
    return { ...rendered, used: printed };
  }
}
