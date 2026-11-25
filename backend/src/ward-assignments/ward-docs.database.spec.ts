import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Prisma } from '@prisma/client';
import PizZip from 'pizzip';
import { AuditService } from '../audit/audit.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { NOTHING, type PreciseScope } from '../common/utils/precise-scope';
import { openScratchDatabase, type ScratchDatabase } from '../common/testing/scratch-database';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { DynamicExportService } from '../document-templates/dynamic-export.service';
import { DocumentsService } from '../documents/documents.service';
import { wardSlipVariables } from '../../prisma/seed-document-templates';
import { WARD_ERROR } from './ward-assignment.codes';
import { WardAssignmentCommandService, type WardAssignmentInput } from './ward-assignment-command.service';
import { WARD_DOCS_AUDIT, WARD_DOCS_ERROR } from './ward-docs.codes';
import { WardFilesService } from './ward-files.service';
import { manualSlipNumber, WardSlipService } from './ward-slip.service';

/**
 * The result files and the request slips of a ward assignment request, on a real PostgreSQL, with the real
 * documents store (in a directory of the suite's own), the real renderer and the template built from PC02's Word file.
 *
 * Expected values come from the contract (lane C) and the plan (C2, C5, C6, R7), not from running the code:
 *   a ward officer lists and downloads their own unit's files, never adds or removes; another unit gets 404;
 *   PC02 adds and removes only on an approved request, never somebody of the request's own ward unit;
 *   a slip is issued once per decision: twice gives the same number and the same file; a number written by hand is
 *   unique in its year; the slip of an old decision is the file issued for it; a reissue keeps the number.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

const ALL: PreciseScope = { ...NOTHING, all: true };
const tree = (teamIds: string[]): PreciseScope => ({ ...NOTHING, tree: { teamIds, userIds: [], includeUnassigned: false } });
const TEMPLATE_FILE = path.resolve(__dirname, '..', '..', 'prisma', 'seed-assets', 'ward-docx', 'PHIEU_YEU_CAU.docx');

/** The text of a .docx (every `<w:t>`, a soft break as "\n", paragraphs on lines of their own). */
function docxText(buffer: Buffer): string {
  const xml = new PizZip(buffer).file('word/document.xml')!.asText();
  return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [])
    .map((p) => (p.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:br\/>/g) ?? []).map((n) => (n === '<w:br/>' ? '\n' : n.replace(/<[^>]+>/g, ''))).join(''))
    .join('\n');
}

async function bytesOf(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

run('ward assignment requests: result files and request slips, on PostgreSQL', () => {
  jest.setTimeout(90_000);
  let scratch: ScratchDatabase;
  let commands: WardAssignmentCommandService;
  let files: WardFilesService;
  let slips: WardSlipService;
  let documents: DocumentsService;
  let uploadRoot: string;
  const tag = `wdc-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const scope: Record<string, DataScope | null> = {};
  let templateCreated = false;
  const series = `PYC_SPEC_${tag}`;
  const suffix = `PYC-${tag}`;

  const enforced = (userId: string, ward: { read: PreciseScope; write: PreciseScope; review?: PreciseScope }, wardTeamId: string | null, extra: Partial<DataScope> = {}): DataScope => ({
    teamIds: [],
    userIds: [userId],
    writableTeamIds: [],
    writableUserIds: [userId],
    isWardOfficer: wardTeamId !== null,
    wardTeamId,
    ...extra,
    precise: {
      userId,
      subjects: {
        Case: { read: NOTHING, write: NOTHING },
        Incident: { read: NOTHING, write: NOTHING },
        Petition: { read: NOTHING, write: NOTHING },
        WardAssignment: { read: ward.read, write: ward.write, actions: { review: ward.review ?? NOTHING, matchSubjects: NOTHING } },
      },
    },
  });

  const input = (over: Partial<WardAssignmentInput> = {}): WardAssignmentInput => ({
    caseType: 'CASE',
    kind: 'NEW',
    crimeId: id.crime,
    summary: `${tag} Nhóm đánh bạc`,
    content: 'Ngày 10/11/2026, tổ tuần tra phát hiện một nhóm người đánh bạc.',
    discoveredOn: '2026-04-11',
    place: 'giao lộ Lý Thái Tổ - Lê Hồng Phong',
    subjectsUnknown: false,
    subjects: [{ fullName: 'Nguyễn Chí Kiệt', birthYear: 1990 }, { fullName: 'Trần Văn Bảy' }],
    proposedInvestigatorId: id.investigator,
    entryOfficerName: 'Phạm Thị D',
    ...over,
  });

  const fails = async (promise: Promise<unknown>) => {
    try {
      await promise;
      return 'resolved';
    } catch (e) {
      const err = e as { getStatus?: () => number; getResponse?: () => unknown; message?: string };
      return { status: err.getStatus?.(), body: err.getResponse?.() ?? err.message };
    }
  };

  const stamp = async (assignmentId: string) => (await scratch.db.wardAssignment.findUniqueOrThrow({ where: { id: assignmentId } })).updatedAt.toISOString();

  /** PC02's decision on the pending round, written as the review commands of lane A write it. */
  const decide = async (assignmentId: string, kind: 'RETURN' | 'APPROVE', data: { requirements: string[]; reasonText?: string }) => {
    const { db } = scratch;
    const round = await db.wardAssignmentRound.findFirstOrThrow({ where: { assignmentId, status: 'PENDING' }, orderBy: { sequence: 'desc' } });
    await db.wardAssignmentRound.update({ where: { id: round.id }, data: { status: 'DECIDED' } });
    const decision = await db.wardAssignmentDecision.create({
      data: {
        roundId: round.id,
        kind,
        decidedById: id.reviewer,
        requirements: data.requirements,
        reasonText: data.reasonText ?? null,
        assignedInvestigatorId: kind === 'APPROVE' ? id.investigator : null,
      },
    });
    await db.wardAssignment.update({
      where: { id: assignmentId },
      data: kind === 'APPROVE' ? { status: 'APPROVED', assignedInvestigatorId: id.investigator } : { status: 'RETURNED' },
    });
    return decision.id;
  };

  /** A request of ward unit W, submitted once. */
  const submitted = async (over: Partial<WardAssignmentInput> = {}) => {
    const made = await commands.create({ id: id.wardy }, scope.wardy, input(over));
    await commands.submit({ id: id.wardy }, scope.wardy, made.id, made.updatedAt.toISOString());
    return made.id;
  };

  /** A file as multer leaves it: written to the store's directory, its name read as latin1. */
  const multerFile = (name: string, content: string, mimetype = 'text/plain') => {
    const filename = `${Date.now()}-${randomUUID()}${path.extname(name)}`;
    const full = path.join(uploadRoot, 'uploads', 'documents', filename);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    return { filename, originalname: Buffer.from(name, 'utf8').toString('latin1'), mimetype, size: Buffer.byteLength(content), path: full, documentType: 'VAN_BAN' as const };
  };

  beforeAll(async () => {
    scratch = await openScratchDatabase(url!);
    const { db } = scratch;
    uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${tag}-`));
    jest.spyOn(process, 'cwd').mockReturnValue(uploadRoot);

    const role = await db.role.create({ data: { name: `${tag}-officer` } });
    for (const name of ['wardy', 'otherWard', 'reviewer', 'wardReviewer', 'dispatcher']) {
      id[name] = (await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId: role.id, isActive: true, firstName: 'Văn A', lastName: 'Nguyễn', rank: 'Đại úy' } })).id;
    }
    const ward = async (key: string) => (await db.directory.create({ data: { type: 'WARD', code: `${tag}-${key}`, name: `${tag} ${key}` } })).id;
    id.wardW = await ward('w');
    id.W = (await db.team.create({ data: { code: `${tag}-W`, name: `Công an P.Vườn Lài ${tag}`, wardId: id.wardW } })).id;
    id.V = (await db.team.create({ data: { code: `${tag}-V`, name: `Công an P.Tân Định ${tag}`, wardId: await ward('v') } })).id;
    id.P = (await db.team.create({ data: { code: `${tag}-P`, name: `${tag} Đội 1 PC02` } })).id;
    // The PC02 team in charge of W's ward: the slip's closing item names it.
    id.M = (await db.team.create({ data: { code: `${tag}-M`, name: `Tổ công tác Số 4 ${tag}` } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.wardy, teamId: id.W },
        { userId: id.otherWard, teamId: id.V },
        { userId: id.reviewer, teamId: id.P },
        { userId: id.wardReviewer, teamId: id.W },
        { userId: id.dispatcher, teamId: id.P },
      ],
    });
    await db.teamWardCharge.create({ data: { wardDirectoryId: id.wardW, managerTeamId: id.M, createdById: id.reviewer } });
    id.crime = (await db.crime.create({ data: { code: `${tag}-D322`, name: 'Tội đánh bạc', articleNo: 322, chapter: 'XXI' } })).id;
    id.investigator = (
      await db.wardInvestigator.create({
        data: { teamId: id.W, fullName: 'Mai Trọng Hạnh', rank: 'Thượng tá', position: 'Trưởng Công an P.Vườn Lài', grade: 'Điều tra viên cao cấp', createdById: id.wardy },
      })
    ).id;

    scope.wardy = enforced(id.wardy, { read: tree([id.W]), write: tree([id.W]) }, id.W);
    scope.otherWard = enforced(id.otherWard, { read: tree([id.V]), write: tree([id.V]) }, id.V);
    scope.reviewer = enforced(id.reviewer, { read: ALL, write: NOTHING, review: ALL }, null);
    // Somebody of the ward unit W who also holds the review grant: segregation of duties refuses them.
    scope.wardReviewer = enforced(id.wardReviewer, { read: ALL, write: NOTHING, review: ALL }, null);
    // A dispatcher with no grant on ward requests: the generic documents rules let a dispatcher read "no parent".
    scope.dispatcher = enforced(id.dispatcher, { read: NOTHING, write: NOTHING }, null, { canDispatch: true });

    // The suite's own number series, shaped as PHIEU_YEU_CAU (`<n>/<suffix>`), so its numbers are its own.
    id.series = (
      await db.documentNumberTemplate.create({
        data: {
          name: `${tag} slips`,
          documentType: series,
          createdById: id.reviewer,
          separator: '/',
          segments: [{ type: 'COUNTER' }, { type: 'LITERAL', value: suffix }],
          // Four digits, as the series is seeded (the standard of the system's slips).
          counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 99999, padding: 4 },
        },
      })
    ).id;
    // The requests' codes (năm-số) on a series of their own too, so that they do not take numbers of the slips'.
    id.codeSeries = (
      await db.documentNumberTemplate.create({
        data: {
          name: `${tag} codes`,
          documentType: `${series}_CODE`,
          createdById: id.reviewer,
          separator: '-',
          segments: [{ type: 'LITERAL', value: tag }, { type: 'COUNTER' }],
          counterConfig: { resetPeriod: 'NEVER', minValue: 1, maxValue: 999999, padding: 1 },
        },
      })
    ).id;
    const numbers = new DocumentNumbersService(db as never);
    const ownNumbers = {
      commitWithTx: (type: string, context: { userId: string }, tx: Prisma.TransactionClient, options?: object) =>
        numbers.commitWithTx(type === 'PHIEU_YEU_CAU' ? series : type, context, tx, options),
    };
    const codes = {
      commitWithTx: (_type: string, context: { userId: string }, tx: Prisma.TransactionClient, options?: object) =>
        numbers.commitWithTx(`${series}_CODE`, context, tx, options),
    };

    // The template built from PC02's Word file, active, as the deploy seeds it.
    const bytes = fs.readFileSync(TEMPLATE_FILE);
    const existing = await db.documentTemplate.findFirst({ where: { entityType: 'HO_SO_PHAN_CONG', code: 'PHIEU_YEU_CAU', deletedAt: null } });
    if (existing) {
      id.templateKept = existing.id;
    } else {
      id.template = (
        await db.documentTemplate.create({
          data: {
            code: 'PHIEU_YEU_CAU',
            name: 'Phiếu yêu cầu',
            entityType: 'HO_SO_PHAN_CONG',
            category: 'Khác',
            fileBytes: bytes,
            fileSha: 'spec',
            fileName: 'PHIEU_YEU_CAU.docx',
            variables: wardSlipVariables(bytes) as never,
            numberSeriesId: 'PHIEU_YEU_CAU',
            status: 'active',
            createdById: id.reviewer,
          },
        })
      ).id;
      templateCreated = true;
    }

    const audit = new AuditService(db as never);
    commands = new WardAssignmentCommandService(db as never, codes as never, audit);
    documents = new DocumentsService(db as never, audit, {} as never, {} as never, { authorizeLegacyDocumentRead: async () => ({ scope: scope.reviewer }) } as never);
    files = new WardFilesService(db as never, documents, audit);
    slips = new WardSlipService(db as never, ownNumbers as never, new DynamicExportService(db as never, ownNumbers as never, {} as never), documents, audit);

    id.A = await submitted();
  });

  afterAll(async () => {
    const { db } = scratch;
    const mine = await db.wardAssignment.findMany({ where: { assignedTeam: { code: { startsWith: tag } } }, select: { id: true } });
    const ids = mine.map((m) => m.id);
    await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: Object.values(id) } }, { subjectId: { in: ids } }] } });
    await db.documentRenderLog.deleteMany({ where: { wardAssignmentId: { in: ids } } });
    await db.wardAssignmentDecision.deleteMany({ where: { round: { assignmentId: { in: ids } } } });
    const docs = await db.document.findMany({ where: { wardAssignmentId: { in: ids } }, select: { id: true } });
    await db.auditLog.deleteMany({ where: { subjectId: { in: docs.map((d) => d.id) } } });
    await db.document.deleteMany({ where: { wardAssignmentId: { in: ids } } });
    await db.wardAssignmentRound.deleteMany({ where: { assignmentId: { in: ids } } });
    await db.wardAssignmentSubject.deleteMany({ where: { assignmentId: { in: ids } } });
    await db.wardAssignment.deleteMany({ where: { id: { in: ids } } });
    await db.wardInvestigator.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    if (templateCreated) await db.documentTemplate.deleteMany({ where: { id: id.template } });
    const series_ = [id.series, id.codeSeries];
    await db.documentNumberLog.deleteMany({ where: { templateId: { in: series_ } } });
    await db.documentNumberCounter.deleteMany({ where: { templateId: { in: series_ } } });
    await db.documentNumberTemplate.deleteMany({ where: { id: { in: series_ } } });
    await db.crime.deleteMany({ where: { code: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.teamWardCharge.deleteMany({ where: { managerTeam: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.directory.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await scratch.close();
    fs.rmSync(uploadRoot, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  describe('the result files', () => {
    it('nobody adds a file before the request is approved', async () => {
      expect(await fails(files.add({ id: id.reviewer }, scope.reviewer, id.A, multerFile('ket-qua.txt', 'x')))).toMatchObject({
        status: 409,
        body: { code: WARD_DOCS_ERROR.FILES_NOT_APPROVED },
      });
    });

    it('once approved: PC02 adds a file (its Vietnamese name read right); the ward officer lists and downloads it', async () => {
      id.dReturn = await decide(id.A, 'RETURN', { requirements: ['Bổ sung lời khai bị hại', 'Xác minh nhân thân đối tượng'], reasonText: 'Thiếu tài liệu chứng minh' });
      // The ward unit corrects the place and submits again: the second round says something else.
      await commands.update({ id: id.wardy }, scope.wardy, id.A, { ...input({ place: 'số 12 đường Cô Giang' }), expectedUpdatedAt: await stamp(id.A) });
      await commands.submit({ id: id.wardy }, scope.wardy, id.A, await stamp(id.A));
      id.dApprove = await decide(id.A, 'APPROVE', { requirements: ['Hỏi cung bị can', 'Trưng cầu giám định dữ liệu điện tử', 'Nhập kho vật chứng'] });

      const added = await files.add({ id: id.reviewer }, scope.reviewer, id.A, multerFile('Báo cáo kết quả.txt', 'nội dung kết quả'));
      expect(added).toMatchObject({ originalName: 'Báo cáo kết quả.txt', mimeType: 'text/plain' });
      id.file = added.id;

      const listed = await files.list(scope.wardy, id.A);
      expect(listed.map((f) => f.id)).toEqual([id.file]);
      const got = await files.download({ id: id.wardy }, scope.wardy, id.A, id.file);
      expect((await bytesOf(got.stream)).toString('utf8')).toBe('nội dung kết quả');
      const audit = await scratch.db.auditLog.findMany({ where: { subjectId: id.A, action: WARD_DOCS_AUDIT.FILE_ADDED } });
      expect(audit).toHaveLength(1);
      expect(JSON.stringify(audit[0].metadata)).not.toContain('Báo cáo');
    });

    it('a ward officer neither adds nor removes; another ward unit sees no request at all (404)', async () => {
      const file = multerFile('x.txt', 'x');
      expect(await fails(files.add({ id: id.wardy }, scope.wardy, id.A, file))).toMatchObject({ status: 403, body: { code: WARD_ERROR.FORBIDDEN } });
      // A refused upload leaves nothing on the disk.
      expect(fs.existsSync(file.path)).toBe(false);
      expect(await fails(files.remove({ id: id.wardy }, scope.wardy, id.A, id.file))).toMatchObject({ status: 403 });
      expect(await fails(files.list(scope.otherWard, id.A))).toMatchObject({ status: 404, body: { code: WARD_ERROR.NOT_FOUND } });
      expect(await fails(files.download({ id: id.otherWard }, scope.otherWard, id.A, id.file))).toMatchObject({ status: 404 });
      expect(await fails(files.add({ id: id.otherWard }, scope.otherWard, id.A, multerFile('y.txt', 'y')))).toMatchObject({ status: 404 });
    });

    it('somebody of the request\'s own ward unit is refused even with the review grant', async () => {
      expect(await fails(files.add({ id: id.wardReviewer }, scope.wardReviewer, id.A, multerFile('z.txt', 'z')))).toMatchObject({
        status: 403,
        body: { code: WARD_ERROR.REVIEW_OWN_UNIT_FORBIDDEN },
      });
    });

    it('the generic document routes neither show nor change a ward file', async () => {
      // A dispatcher reads every "orphan" through the generic rules; a ward file is not one.
      expect(await fails(documents.getById(id.file, scope.dispatcher))).toMatchObject({ status: 403 });
      expect(await fails(documents.getById(id.file, scope.otherWard))).toMatchObject({ status: 403 });
      await expect(documents.getById(id.file, scope.wardy)).resolves.toMatchObject({ data: { id: id.file } });
      expect(await fails(documents.delete(id.file, id.reviewer, {}, scope.reviewer))).toMatchObject({ status: 409 });
      expect(await fails(documents.update(id.file, { title: 'đổi' }, id.reviewer, {}, scope.reviewer))).toMatchObject({ status: 409 });
    });

    it('two uploads at once never both pass a quota that has room for one', async () => {
      const before = process.env.MAX_DOCUMENTS_PER_ENTITY;
      process.env.MAX_DOCUMENTS_PER_ENTITY = '2'; // one file on record: room for one more
      try {
        const results = await Promise.allSettled([
          files.add({ id: id.reviewer }, scope.reviewer, id.A, multerFile('q1.txt', 'a')),
          files.add({ id: id.reviewer }, scope.reviewer, id.A, multerFile('q2.txt', 'b')),
        ]);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        const refused = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
        expect((refused.reason as { getResponse: () => unknown }).getResponse()).toMatchObject({ code: WARD_DOCS_ERROR.FILES_TOO_MANY });
        const extra = (results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ id: string }>).value.id;
        await files.remove({ id: id.reviewer }, scope.reviewer, id.A, extra);
      } finally {
        if (before === undefined) delete process.env.MAX_DOCUMENTS_PER_ENTITY;
        else process.env.MAX_DOCUMENTS_PER_ENTITY = before;
      }
    });

    it('PC02 removes a file: soft deleted (row and bytes kept), gone from the list', async () => {
      await expect(files.remove({ id: id.reviewer }, scope.reviewer, id.A, id.file)).resolves.toEqual({ id: id.file });
      expect(await files.list(scope.wardy, id.A)).toEqual([]);
      const row = await scratch.db.document.findUniqueOrThrow({ where: { id: id.file } });
      expect(row.deletedAt).not.toBeNull();
      expect(fs.existsSync(path.join(uploadRoot, 'uploads', 'documents', row.fileName))).toBe(true);
      expect(await fails(files.download({ id: id.wardy }, scope.wardy, id.A, id.file))).toMatchObject({ status: 404 });
    });
  });

  describe('the request slip', () => {
    let returnSlip: { number: string; documentId: string; bytes: Buffer };

    it('before issuing, the dialog is told the names the slip would take, that a template is in use, and nothing is written', async () => {
      const before = await scratch.db.documentNumberLog.count({ where: { templateId: id.series } });
      const told = await slips.defaults({ id: id.reviewer }, scope.reviewer, id.A, id.dReturn);
      expect(told).toMatchObject({ decisionId: id.dReturn, kind: 'RETURN', revoked: false, slipNumber: null, templateReady: true });
      expect(told.signers.canBoThamDinh).toBe('Đại úy Nguyễn Văn A');
      // What the slip would leave empty is read from what the round submitted (what the slip prints), not from the
      // request as it reads today.
      const round = await scratch.db.wardAssignmentRound.findFirstOrThrow({ where: { decisions: { some: { id: id.dReturn } } } });
      const today = await scratch.db.wardAssignment.findUniqueOrThrow({ where: { id: id.A } });
      expect((round.snapshot as { place?: string }).place).toBeTruthy();
      expect(told.missing).toEqual([]);
      await scratch.db.wardAssignment.update({ where: { id: id.A }, data: { place: null, updatedAt: today.updatedAt } });
      expect((await slips.defaults({ id: id.reviewer }, scope.reviewer, id.A, id.dReturn)).missing).toEqual([]);
      await scratch.db.wardAssignmentRound.update({ where: { id: round.id }, data: { snapshot: { ...(round.snapshot as object), place: null } } });
      expect((await slips.defaults({ id: id.reviewer }, scope.reviewer, id.A, id.dReturn)).missing).toEqual(['place']);
      await scratch.db.wardAssignmentRound.update({ where: { id: round.id }, data: { snapshot: round.snapshot as object } });
      await scratch.db.wardAssignment.update({ where: { id: id.A }, data: { place: today.place, updatedAt: today.updatedAt } });
      expect(await scratch.db.documentNumberLog.count({ where: { templateId: id.series } })).toBe(before);
      // The ward unit reads its request, but is not told (nor may issue).
      expect(await fails(slips.defaults({ id: id.wardy }, scope.wardy, id.A, id.dReturn))).toMatchObject({ status: 403 });
    });

    it('issued once: the next number of the series; asking again gives the same number and the same stored file', async () => {
      const first = await slips.issue({ id: id.reviewer }, scope.reviewer, id.A, id.dReturn, {});
      expect(first.slipNumber).toBe(`0001/${suffix}`);
      // The file is named by the slip's own number, not by a digit of the unit's mark ("02" of PC02).
      const named = await scratch.db.document.findUniqueOrThrow({ where: { id: first.slipDocumentId! }, select: { originalName: true } });
      expect(named.originalName).toMatch(/_0001\.docx$/);
      expect(first.slipDocumentId).toBeTruthy();
      const again = await slips.issue({ id: id.reviewer }, scope.reviewer, id.A, id.dReturn, {});
      expect(again).toMatchObject({ slipNumber: first.slipNumber, slipDocumentId: first.slipDocumentId });
      // The same number by hand is the same slip; another number is refused.
      expect(await fails(slips.issue({ id: id.reviewer }, scope.reviewer, id.A, id.dReturn, { slipNumber: '77' }))).toMatchObject({
        status: 409,
        body: { code: WARD_DOCS_ERROR.SLIP_ALREADY_ISSUED },
      });
      const got = await slips.download({ id: id.wardy }, scope.wardy, id.A, id.dReturn);
      returnSlip = { number: first.slipNumber!, documentId: first.slipDocumentId!, bytes: await bytesOf(got.stream) };
      expect(await slips.defaults({ id: id.reviewer }, scope.reviewer, id.A, id.dReturn)).toMatchObject({ slipNumber: first.slipNumber, signers: { canBoThamDinh: 'Đại úy Nguyễn Văn A' } });
      expect(await scratch.db.documentNumberLog.count({ where: { templateId: id.series } })).toBe(1);
      const log = await scratch.db.documentRenderLog.findMany({ where: { wardAssignmentId: id.A } });
      expect(log).toEqual([expect.objectContaining({ documentType: 'PHIEU_YEU_CAU', generatedNumber: first.slipNumber })]);
    });

    it('the slip of a return reads as PC02\'s Word slip: number, unit, investigator, crime, dates, numbered requirements, reason, signers', () => {
      const text = docxText(returnSlip.bytes);
      expect(text).toContain(`Số: 0001/${suffix}`);
      expect(text).toMatch(/Thành phố Hồ Chí Minh, ngày \d{2} tháng \d{2} năm \d{4}/);
      expect(text).toContain('Căn cứ các Điều 36, 37, 145 Bộ luật Tố tụng Hình sự;');
      expect(text).toMatch(new RegExp(`Ngày \\d{2}/\\d{2}/\\d{4}, Công an P\\.Vườn Lài ${tag} có Báo cáo đề xuất`));
      expect(text).toContain('Thượng tá Mai Trọng Hạnh - Điều tra viên cao cấp là Trưởng Công an P.Vườn Lài khởi tố, điều tra vụ án: “Đánh bạc”, phát hiện ngày 11/04/2026');
      // Block 1 as the FIRST round submitted it (the place was corrected afterwards).
      expect(text).toContain('tại giao lộ Lý Thái Tổ - Lê Hồng Phong, do Nguyễn Chí Kiệt, Trần Văn Bảy thực hiện.\nLý do trả về: Thiếu tài liệu chứng minh.');
      expect(text).toContain('1. Bổ sung lời khai bị hại\n2. Xác minh nhân thân đối tượng');
      // The closing item: N + 1, naming the PC02 team in charge of the request's ward, joined like the requirements.
      expect(text).toContain(
        `2. Xác minh nhân thân đối tượng\n3. Trong quá trình điều tra, trường hợp gặp khó khăn, vướng mắc, cần kịp thời báo cáo về Phòng PC02 (qua Tổ công tác Số 4 ${tag} hoặc Đội 1) để được hướng dẫn, phối hợp, hỗ trợ.`,
      );
      expect(text).not.toContain('{');
      // Signers by default: the reviewer as "Cán bộ thẩm định".
      expect(text).toContain('Đại úy Nguyễn Văn A');
    });

    it('steps over a number already carried by a slip of the year; the approval names the assigned investigator and the new round', async () => {
      // A slip of another request already carries the next number (written by hand in the series' own form).
      id.B = await submitted();
      id.dB = await decide(id.B, 'RETURN', { requirements: ['Bổ sung'], reasonText: 'Thiếu' });
      const year = (await scratch.db.wardAssignmentDecision.findUniqueOrThrow({ where: { id: id.dReturn } })).slipYear!;
      await scratch.db.wardAssignmentDecision.update({ where: { id: id.dB }, data: { slipYear: year, slipNumber: `0002/${suffix}` } });

      const approved = await slips.issue({ id: id.reviewer }, scope.reviewer, id.A, id.dApprove, { signers: { chiHuyDoi: 'Trung tá Hoàng Công Việt', lanhDaoPhong: 'Thượng tá Nguyễn Trung Hoà' } });
      expect(approved.slipNumber).toBe(`0003/${suffix}`);
      const text = docxText(await bytesOf((await slips.download({ id: id.reviewer }, scope.reviewer, id.A, id.dApprove)).stream));
      expect(text).toContain(`Số: 0003/${suffix}`);
      expect(text).toContain('tại số 12 đường Cô Giang');
      expect(text).not.toContain('Lý do trả về');
      expect(text).toContain('1. Hỏi cung bị can\n2. Trưng cầu giám định dữ liệu điện tử\n3. Nhập kho vật chứng');
      expect(text).toContain('Trung tá Hoàng Công Việt');
      expect(text).toContain('Thượng tá Nguyễn Trung Hoà');
      expect(approved.signers).toMatchObject({ canBoThamDinh: 'Đại úy Nguyễn Văn A', chiHuyDoi: 'Trung tá Hoàng Công Việt' });
    });

    it('the reprint of the old decision is the file issued for it, unchanged', async () => {
      const again = await bytesOf((await slips.download({ id: id.wardy }, scope.wardy, id.A, id.dReturn)).stream);
      expect(again.equals(returnSlip.bytes)).toBe(true);
    });

    it('a number by hand: normalised, unique in its year (a second use refused), malformed refused', async () => {
      const n = `${Math.floor(Math.random() * 90000) + 10000}A`;
      id.C = await submitted();
      id.dC = await decide(id.C, 'RETURN', { requirements: ['Bổ sung'], reasonText: 'Thiếu' });
      const manual = await slips.issue({ id: id.reviewer }, scope.reviewer, id.C, id.dC, { slipNumber: n.toLowerCase() });
      expect(manual.slipNumber).toBe(`${n}/PYC-PC02-Đ1`);
      expect(await fails(slips.issue({ id: id.reviewer }, scope.reviewer, id.B, id.dB, { slipNumber: `${n}/PYC-PC02-Đ1` }))).toMatchObject({
        status: 409,
        body: { code: WARD_DOCS_ERROR.SLIP_NUMBER_TAKEN },
      });
      for (const bad of ['19 49', '0', '000', 'A12', '12ABCD', '1234567']) {
        expect({ bad, r: await fails(slips.issue({ id: id.reviewer }, scope.reviewer, id.B, id.dB, { slipNumber: bad })) }).toMatchObject({ bad, r: { status: 400, body: { code: WARD_DOCS_ERROR.SLIP_NUMBER_INVALID } } });
      }
      // Written as the series writes: four digits. 7, 07 and 0007 are one number.
      expect(['7', '07', '0007', '7/PYC-PC02-Đ1', ' 7 '].map(manualSlipNumber)).toEqual(Array(5).fill('0007/PYC-PC02-Đ1'));
      expect(manualSlipNumber('1949a')).toBe('1949A/PYC-PC02-Đ1');
      expect(manualSlipNumber('12345')).toBe('12345/PYC-PC02-Đ1');
      // No number of the series was spent by hand.
      expect(await scratch.db.documentNumberLog.count({ where: { templateId: id.series } })).toBe(3);
    });

    it('a ward officer downloads their slips but issues none; another unit gets 404; the issued file is not a result file', async () => {
      expect(await fails(slips.issue({ id: id.wardy }, scope.wardy, id.B, id.dB, {}))).toMatchObject({ status: 403 });
      expect(await fails(slips.download({ id: id.otherWard }, scope.otherWard, id.A, id.dReturn))).toMatchObject({ status: 404 });
      expect(await fails(slips.download({ id: id.wardy }, scope.wardy, id.A, id.dB))).toMatchObject({ status: 404, body: { code: WARD_DOCS_ERROR.SLIP_DECISION_NOT_FOUND } });
      expect(await files.list(scope.wardy, id.A)).toEqual([]);
      expect(await fails(files.remove({ id: id.reviewer }, scope.reviewer, id.A, returnSlip.documentId))).toMatchObject({ status: 409, body: { code: WARD_DOCS_ERROR.FILE_IS_SLIP } });
    });

    it('reissue: a reason is required; same number, a new stored file replacing the old one (kept, out of the lists), audited', async () => {
      expect(await fails(slips.reissue({ id: id.reviewer }, scope.reviewer, id.A, id.dReturn, { reason: '  ' }))).toMatchObject({
        status: 400,
        body: { code: WARD_DOCS_ERROR.SLIP_REASON_REQUIRED },
      });
      expect(await fails(slips.reissue({ id: id.reviewer }, scope.reviewer, id.B, id.dB, { reason: 'x' }))).toMatchObject({ status: 409, body: { code: WARD_DOCS_ERROR.SLIP_NOT_ISSUED } });
      // The investigator is renamed after the slip was issued: the reissue still prints the name the slip printed.
      await scratch.db.wardInvestigator.update({ where: { id: id.investigator }, data: { fullName: 'Tên Đã Đổi' } });
      const re = await slips.reissue({ id: id.reviewer }, scope.reviewer, id.A, id.dReturn, { reason: 'Sửa tên chỉ huy', signers: { chiHuyDoi: 'Thiếu tá Lê Văn Mới' } });
      expect(re.slipNumber).toBe(returnSlip.number);
      expect(re.slipDocumentId).not.toBe(returnSlip.documentId);
      const old = await scratch.db.document.findUniqueOrThrow({ where: { id: returnSlip.documentId } });
      expect(old.deletedAt).not.toBeNull();
      const text = docxText(await bytesOf((await slips.download({ id: id.wardy }, scope.wardy, id.A, id.dReturn)).stream));
      expect(text).toContain(`Số: ${returnSlip.number}`);
      expect(text).toContain('Thiếu tá Lê Văn Mới');
      expect(text).toContain('Thượng tá Mai Trọng Hạnh');
      expect(text).not.toContain('Tên Đã Đổi');
      await scratch.db.wardInvestigator.update({ where: { id: id.investigator }, data: { fullName: 'Mai Trọng Hạnh' } });
      const audit =await scratch.db.auditLog.findMany({ where: { subjectId: id.A, action: WARD_DOCS_AUDIT.SLIP_REISSUED } });
      expect(audit).toHaveLength(1);
      expect(audit[0].metadata).toMatchObject({ decisionId: id.dReturn, slipNumber: returnSlip.number, replacedDocumentId: returnSlip.documentId });
      // Metadata only: never the requirements nor the subjects of the request.
      const issued = await scratch.db.auditLog.findMany({ where: { subjectId: id.A, action: { in: [WARD_DOCS_AUDIT.SLIP_ISSUED, WARD_DOCS_AUDIT.SLIP_REISSUED] } } });
      for (const a of issued) {
        expect(JSON.stringify(a.metadata)).not.toContain('Nguyễn Chí Kiệt');
        expect(JSON.stringify(a.metadata)).not.toContain('Bổ sung lời khai');
      }
    });

    it('a slip whose bytes changed on the disk (same length) is refused, never served', async () => {
      const decision = await scratch.db.wardAssignmentDecision.findUniqueOrThrow({ where: { id: id.dApprove } });
      const doc = await scratch.db.document.findUniqueOrThrow({ where: { id: decision.slipDocumentId! } });
      const full = path.join(uploadRoot, 'uploads', 'documents', doc.fileName);
      const original = fs.readFileSync(full);
      const tampered = Buffer.from(original);
      tampered[tampered.length - 10] ^= 0xff;
      fs.writeFileSync(full, tampered);
      try {
        expect(await fails(slips.download({ id: id.wardy }, scope.wardy, id.A, id.dApprove))).toMatchObject({ status: 409, body: { code: WARD_DOCS_ERROR.FILE_UNAVAILABLE } });
      } finally {
        fs.writeFileSync(full, original);
      }
      await expect(slips.download({ id: id.wardy }, scope.wardy, id.A, id.dApprove)).resolves.toBeTruthy();
    });

    describe('the closing item (report difficulties to PC02 through the team in charge of the ward)', () => {
      const CLOSING = 'Trong quá trình điều tra, trường hợp gặp khó khăn, vướng mắc, cần kịp thời báo cáo về Phòng PC02';
      const slipText = async (assignmentId: string, decisionId: string) =>
        docxText(await bytesOf((await slips.download({ id: id.reviewer }, scope.reviewer, assignmentId, decisionId)).stream));

      it('with no requirement at all, the item is "1."', async () => {
        id.D = await submitted();
        id.dD = await decide(id.D, 'RETURN', { requirements: [], reasonText: 'Thiếu' });
        expect((await slips.defaults({ id: id.reviewer }, scope.reviewer, id.D, id.dD)).missing).toEqual([]);
        await slips.issue({ id: id.reviewer }, scope.reviewer, id.D, id.dD, {});
        const text = await slipText(id.D, id.dD);
        expect(text).toContain(`1. ${CLOSING} (qua Tổ công tác Số 4 ${tag} hoặc Đội 1) để được hướng dẫn, phối hợp, hỗ trợ.`);
        expect(text).not.toContain(`2. ${CLOSING}`);
      });

      it('nobody in charge of the ward: the dialog lists it as missing, the slip says "(qua Đội 1)", and a reissue keeps what was issued', async () => {
        await scratch.db.teamWardCharge.deleteMany({ where: { wardDirectoryId: id.wardW } });
        try {
          id.E = await submitted();
          id.dE = await decide(id.E, 'APPROVE', { requirements: ['Hỏi cung bị can'] });
          expect((await slips.defaults({ id: id.reviewer }, scope.reviewer, id.E, id.dE)).missing).toEqual(['wardChargeTeam']);
          await slips.issue({ id: id.reviewer }, scope.reviewer, id.E, id.dE, {});
          expect(await slipText(id.E, id.dE)).toContain(`1. Hỏi cung bị can\n2. ${CLOSING} (qua Đội 1) để được hướng dẫn, phối hợp, hỗ trợ.`);
        } finally {
          await scratch.db.teamWardCharge.create({ data: { wardDirectoryId: id.wardW, managerTeamId: id.M, createdById: id.reviewer } });
        }
        // A team is in charge NOW; the issued slip is not looked up again: the reissue prints what the issue printed.
        await slips.reissue({ id: id.reviewer }, scope.reviewer, id.E, id.dE, { reason: 'In lại' });
        const text = await slipText(id.E, id.dE);
        expect(text).toContain(`2. ${CLOSING} (qua Đội 1) để`);
        expect(text).not.toContain(`Tổ công tác Số 4 ${tag}`);
        expect((await slips.defaults({ id: id.reviewer }, scope.reviewer, id.E, id.dE)).missing).toEqual(['wardChargeTeam']);
        const stored = (await scratch.db.wardAssignmentDecision.findUniqueOrThrow({ where: { id: id.dE } })).signers as { used: object };
        expect(stored.used).toMatchObject({ version: 2, chargeTeamName: null });
      });

      it('a slip issued before the item existed (snapshot without a version) is reissued WITHOUT it, unchanged', async () => {
        const decision = await scratch.db.wardAssignmentDecision.findUniqueOrThrow({ where: { id: id.dApprove } });
        const state = decision.signers as { used: Record<string, unknown> };
        const { version: _v, chargeTeamName: _c, ...oldUsed } = state.used;
        expect(_v).toBe(2);
        await scratch.db.wardAssignmentDecision.update({ where: { id: id.dApprove }, data: { signers: { ...state, used: oldUsed } as never } });

        expect((await slips.defaults({ id: id.reviewer }, scope.reviewer, id.A, id.dApprove)).missing).toEqual([]);
        await slips.reissue({ id: id.reviewer }, scope.reviewer, id.A, id.dApprove, { reason: 'Phiếu cũ in lại' });
        const text = await slipText(id.A, id.dApprove);
        expect(text).toContain('1. Hỏi cung bị can\n2. Trưng cầu giám định dữ liệu điện tử\n3. Nhập kho vật chứng');
        expect(text).not.toContain(CLOSING);
        // Still an old snapshot: no version is invented at reissue.
        const after = (await scratch.db.wardAssignmentDecision.findUniqueOrThrow({ where: { id: id.dApprove } })).signers as { used: object };
        expect(after.used).not.toHaveProperty('version');
      });
    });

    it('a revoked decision gets no slip', async () => {
      await scratch.db.wardAssignmentDecision.update({ where: { id: id.dB }, data: { revokedAt: new Date(), revokedById: id.reviewer, revokeReason: 'thu hồi', slipYear: null, slipNumber: null } });
      expect(await fails(slips.issue({ id: id.reviewer }, scope.reviewer, id.B, id.dB, {}))).toMatchObject({ status: 409, body: { code: WARD_DOCS_ERROR.SLIP_DECISION_REVOKED } });
    });
  });
});
