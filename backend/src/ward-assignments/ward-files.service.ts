import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Readable } from 'node:stream';
import * as fs from 'fs';
import { AuditService } from '../audit/audit.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { DocumentsService } from '../documents/documents.service';
import { uploadedFileName } from '../documents/document-upload-policy';
import { PrismaService } from '../prisma/prisma.service';
import { WARD_DOCS_AUDIT, WARD_DOCS_ERROR } from './ward-docs.codes';
import { readableRequest, requestForDocsWrite, requestForRead } from './ward-docs.locks';
import { wardBody } from './ward-errors';

type Scope = DataScope | null | undefined;

/** A result file as the screen lists it. */
export interface WardFileRow {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  uploadedBy: { id: string; firstName: string | null; lastName: string | null; username: string } | null;
}

/** The file multer wrote (immutable storage) and the request's meta of the upload. */
export interface UploadedWardFile {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
  /** The kind the store files it as (a recording keeps the larger limit of recordings). */
  documentType: 'VAN_BAN' | 'AM_THANH' | 'VIDEO';
}

const ROW_SELECT = {
  id: true,
  originalName: true,
  mimeType: true,
  size: true,
  createdAt: true,
  uploadedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
} as const;

/**
 * "Kết quả" — the result files of an approved ward assignment request (block 3, written by PC02).
 *
 * Reach: listing and downloading follow the read reach of the request (a ward officer sees their own unit's; another
 * unit's request does not exist for them: 404). Adding and removing follow the review reach, never by the request's
 * own ward unit, and only while the request is approved and not archived. The bytes and the rows are the documents
 * store's (`DocumentsService`: immutable storage, quota, soft delete, audit); this service only says who may.
 * An issued request slip is a document of the request too, but never a result file: it is neither listed nor removed
 * here.
 */
@Injectable()
export class WardFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
  ) {}

  /** The result files of the request, oldest first. */
  async list(scope: Scope, assignmentId: string): Promise<WardFileRow[]> {
    await requestForRead(this.prisma, scope, assignmentId);
    return this.prisma.document.findMany({
      where: { wardAssignmentId: assignmentId, deletedAt: null, wardSlipOf: null },
      select: ROW_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Adds a file multer has already written and the upload policy has already checked. Whatever refuses it here, the
   * bytes are removed from the disk: a refused upload leaves nothing behind.
   */
  async add(
    actor: { id: string },
    scope: Scope,
    assignmentId: string,
    file: UploadedWardFile,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<WardFileRow> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await requestForDocsWrite(tx, scope, actor.id, assignmentId);
        if (row.status !== 'APPROVED') throw new ConflictException(wardBody(WARD_DOCS_ERROR.FILES_NOT_APPROVED, { status: row.status }));
        const document = await this.documents.createWardFile(tx, { wardAssignmentId: row.id, file, actorId: actor.id, meta });
        await this.audit.log(
          {
            userId: actor.id,
            action: WARD_DOCS_AUDIT.FILE_ADDED,
            subject: 'WardAssignment',
            subjectId: row.id,
            metadata: { documentId: document.id, size: file.size, mimeType: file.mimetype, nameLength: uploadedFileName(file.originalname).length },
          },
          tx,
        );
        return tx.document.findUniqueOrThrow({ where: { id: document.id }, select: ROW_SELECT });
      });
    } catch (error) {
      fs.rmSync(file.path, { force: true });
      throw error;
    }
  }

  /** Removes a result file (soft delete, as the documents store removes every file): the row and the bytes are kept. */
  async remove(actor: { id: string }, scope: Scope, assignmentId: string, fileId: string, meta?: { ipAddress?: string; userAgent?: string }): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const row = await requestForDocsWrite(tx, scope, actor.id, assignmentId);
      await tx.$queryRaw`SELECT id FROM "documents" WHERE id = ${fileId} FOR UPDATE`;
      const document = await tx.document.findFirst({
        where: { id: fileId, wardAssignmentId: row.id, deletedAt: null },
        select: { id: true, originalName: true, wardSlipOf: { select: { id: true } } },
      });
      if (!document) throw new NotFoundException(wardBody(WARD_DOCS_ERROR.FILE_NOT_FOUND));
      if (document.wardSlipOf) throw new ConflictException(wardBody(WARD_DOCS_ERROR.FILE_IS_SLIP));
      if (row.status !== 'APPROVED') throw new ConflictException(wardBody(WARD_DOCS_ERROR.FILES_NOT_APPROVED, { status: row.status }));
      await this.documents.deleteWardFile(tx, { id: document.id, originalName: document.originalName, wardAssignmentId: row.id }, actor.id, meta);
      await this.audit.log(
        { userId: actor.id, action: WARD_DOCS_AUDIT.FILE_REMOVED, subject: 'WardAssignment', subjectId: row.id, metadata: { documentId: document.id } },
        tx,
      );
      return { id: document.id };
    });
  }

  /** The bytes of a result file, for whoever may read the request (asked again after the bytes are read). */
  async download(
    actor: { id: string; ipAddress?: string; userAgent?: string },
    scope: Scope,
    assignmentId: string,
    fileId: string,
  ): Promise<{ stream: Readable; originalName: string; mimeType: string }> {
    await requestForRead(this.prisma, scope, assignmentId);
    const document = await this.prisma.document.findFirst({
      where: { id: fileId, wardAssignmentId: assignmentId, deletedAt: null },
      select: { id: true, wardSlipOf: { select: { id: true } } },
    });
    // A slip is downloaded through its decision (`GET …/decisions/:decisionId/slip`), never as a result file.
    if (!document || document.wardSlipOf) throw new NotFoundException(wardBody(WARD_DOCS_ERROR.FILE_NOT_FOUND));
    return this.documents.openWardFile(fileId, assignmentId, { userId: actor.id, ipAddress: actor.ipAddress, userAgent: actor.userAgent }, async () => {
      const row = await this.prisma.wardAssignment.findUnique({ where: { id: assignmentId }, select: { assignedTeamId: true, enteredById: true } });
      if (!row || !readableRequest(row, scope)) throw new NotFoundException(wardBody(WARD_DOCS_ERROR.FILE_NOT_FOUND));
    });
  }
}
