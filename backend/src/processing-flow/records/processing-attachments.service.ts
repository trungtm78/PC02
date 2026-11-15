import { ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DocumentsService } from '../../documents/documents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PROCESSING_ERROR, type ProcessingErrorCode } from '../contract/processing-codes';
import { RecordGateway } from '../gateway/record-gateway';
import type { GatewayUser, RecordKind } from '../gateway/record-snapshot';
import { RECORD_FLOW_LOCK } from './flow-application.service';
import { ProcessingResultsService } from './processing-results.service';

type Tx = Prisma.TransactionClient;

const refuse = {
  conflict: (code: ProcessingErrorCode) => new ConflictException({ code }),
  notFound: (code: ProcessingErrorCode) => new NotFoundException({ code }),
};

/** The column of `documents` that points at a record of each kind. */
const PARENT_KEY = { PETITION: 'petitionId', INCIDENT: 'incidentId', CASE: 'caseId' } as const satisfies Record<RecordKind, string>;

export interface UploadedAttachment {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface AttachmentDto {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
  uploaderName: string | null;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * The files of a report of a step (decision C4): a unit named in a step being worked attaches files to ITS OWN report
 * although it may not write the record. This is a deliberate write path of its own, next to the documents module (which
 * asks for write on the record): what authorises it is the STEP.
 *
 *   - attach / remove: the AUTHOR of the report, still a party of the step, the step OPEN, the report standing (not
 *     withdrawn, not replaced, not answered), the record neither gone nor finished. Under the record's lock.
 *   - download: whoever may read the results of the step (the caller's `readable`, asked again here around the bytes),
 *     and the document must be a file of a report of THAT step of THAT record; a case's evidence governance still
 *     decides for its bytes (`DocumentsService.openDownload`), except that a case outside the reader's own scope is
 *     opened by the step rule (`mayReadByStep`): the scope alone gives way, sensitivity and representation do not.
 *
 * The route adds its permission and the record's read rule opened by the step (the case policy for a RESTRICTED case).
 * The file is a `Document` of the record (its own foreign key), so it is also in the record's document store.
 */
@Injectable()
export class ProcessingAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RecordGateway,
    private readonly results: ProcessingResultsService,
    private readonly documents: DocumentsService,
  ) {}

  async attach(actorId: string, kind: RecordKind, recordId: string, stepKey: string, reportId: string, file: UploadedAttachment, meta?: RequestMeta): Promise<AttachmentDto> {
    return this.locked(kind, recordId, async (tx) => {
      const report = await this.writableReport(tx, actorId, kind, recordId, stepKey, reportId);
      const row = await this.documents.createStepAttachment(tx, { parent: { [PARENT_KEY[kind]]: recordId }, procStepReportId: report.id, file, actorId, meta });
      const [dto] = await this.results.attachmentsOf(tx, [report.id]);
      return dto.find((entry) => entry.id === row.id) as AttachmentDto;
    });
  }

  async remove(actorId: string, kind: RecordKind, recordId: string, stepKey: string, reportId: string, documentId: string, meta?: RequestMeta): Promise<{ id: string }> {
    return this.locked(kind, recordId, async (tx) => {
      const report = await this.writableReport(tx, actorId, kind, recordId, stepKey, reportId);
      // The document of THIS report only: an id of another record, another step, or a document that is no attachment
      // answers as one that does not exist.
      // ...and still a document of THIS record: one moved to another record is no longer this report's to remove.
      const document = await tx.document.findFirst({ where: { id: documentId, procStepReportId: report.id, [PARENT_KEY[kind]]: recordId, deletedAt: null }, select: { id: true, caseId: true, title: true, originalName: true } });
      if (!document) throw refuse.notFound(PROCESSING_ERROR.ATTACHMENT_NOT_FOUND);
      await this.documents.deleteStepAttachment(tx, document, actorId, meta);
      return { id: document.id };
    });
  }

  /**
   * The bytes of an attachment. `user` is asked the step read rule again here (before and after the bytes are read),
   * and the document is looked up THROUGH the step: an id that is not a file of a report of this step of this record
   * is refused whatever the person may read elsewhere.
   */
  async openDownload(user: GatewayUser, kind: RecordKind, recordId: string, stepKey: string, reportId: string, documentId: string, meta?: RequestMeta) {
    const missing = () => refuse.notFound(PROCESSING_ERROR.ATTACHMENT_NOT_FOUND);
    const authorize = async (document: { id: string; procStepReportId: string | null } & Record<'caseId' | 'incidentId' | 'petitionId', string | null>) => {
      if (!(await this.gateway.canRead(kind, recordId, user, { viaStep: true }))) throw refuse.notFound(PROCESSING_ERROR.RECORD_FLOW_NOT_FOUND);
      if (document.procStepReportId !== reportId || document[PARENT_KEY[kind]] !== recordId) throw missing();
      const report = await this.prisma.procStepReport.findFirst({ where: { id: reportId, recordKind: kind, recordId, recordStep: { recordKind: kind, recordId, stepKey } }, select: { id: true } });
      if (!report) throw missing();
    };
    try {
      // `mayReadByStep`: for a CASE outside the reader's own scope, what the case's evidence governance asks in place
      // of the scope (and nothing else of the case policy). The same step rule as `authorize`, asked again there.
      const mayReadByStep = () => this.gateway.canRead(kind, recordId, user, { viaStep: true });
      return await this.documents.openDownload(documentId, { userId: user.id, ...meta }, undefined, { authorize, mayReadByStep });
    } catch (error) {
      // A document that is gone (or never was an attachment) answers with the code of this module.
      if (error instanceof NotFoundException && !(error.getResponse() as { code?: unknown }).code) throw missing();
      throw error;
    }
  }

  /** The caller's own standing report on an OPEN step of a record that is neither gone nor finished. */
  private async writableReport(tx: Tx, actorId: string, kind: RecordKind, recordId: string, stepKey: string, reportId: string) {
    const snapshot = await this.gateway.load(kind, recordId, tx);
    if (!snapshot) throw refuse.notFound(PROCESSING_ERROR.RECORD_FLOW_NOT_FOUND);
    if (snapshot.isFinished) throw refuse.conflict(PROCESSING_ERROR.RECORD_FINISHED);
    const step = await tx.procRecordStep.findFirst({ where: { recordKind: kind, recordId, stepKey }, select: { id: true, status: true } });
    if (!step) throw refuse.notFound(PROCESSING_ERROR.RECORD_STEP_NOT_FOUND);
    await this.results.assertReporter(tx, step.id, actorId);
    const report = await this.results.ownReport(tx, step.id, reportId, actorId);
    if (step.status !== 'OPEN') throw refuse.conflict(PROCESSING_ERROR.STEP_NOT_OPEN);
    return report;
  }

  /** One transaction under the record's flow lock: the step cannot close, nor the report be withdrawn, in between. */
  private locked<T>(kind: RecordKind, recordId: string, job: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma
      .$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RECORD_FLOW_LOCK}::int, hashtext(${`${kind}:${recordId}`})::int)`;
          return job(tx);
        },
        { timeout: 60_000, maxWait: 10_000 },
      )
      .catch((error: unknown) => {
        if (error instanceof HttpException) throw error;
        const failure = error as { code?: string };
        if (failure.code === 'P2034') throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
        throw error;
      });
  }
}
