import { HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { CaseEvidenceGovernanceService } from '../../cases/evidence-governance/evidence-governance.service';
import { CaseFieldSchemaService } from '../../cases/governance/case-field-schema.service';
import { CaseGovernanceService } from '../../cases/governance/case-governance.service';
import { ensurePermissions, openScratchDatabase, type EnsuredPermissions, type ScratchDatabase } from '../../common/testing/scratch-database';
import { takeTurnOnSharedRow } from '../../common/testing/shared-row-turn';
import { DocumentsService } from '../../documents/documents.service';
import { TeamsService } from '../../teams/teams.service';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { ProcessingFlowsService } from '../config/processing-flows.service';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import type { RecordKind } from '../gateway/record-snapshot';
import { FlowApplicationService } from './flow-application.service';
import { ProcessingAttachmentsService } from './processing-attachments.service';
import { ProcessingCommandService } from './processing-command.service';
import { ProcessingResultsService } from './processing-results.service';
import { RecordDeadlineWriter } from './record-deadline-writer.service';
import { RecordStepAccessService } from './record-step-access.service';

/**
 * The files of a report of a step (C4), on a REAL PostgreSQL and a real directory: the author attaches to their OWN
 * report while the step is open, without any write on the record; the document is looked up THROUGH the step (an id
 * of another record, another step, or a document that is no attachment is refused); the book of the step lists the
 * files; a case's own policy still decides who gets the bytes.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database; works on rows of its own and removes them.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

const PREFIX = 'pfa-test-';

run('Attachments of a step report on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  let commands: ProcessingCommandService;
  let results: ProcessingResultsService;
  let attachments: ProcessingAttachmentsService;
  let permissions: EnsuredPermissions;
  let root = '';
  const tag = `${PREFIX}${randomUUID().slice(0, 8)}`;
  const user: Record<string, string> = {};
  const team: Record<string, string> = {};
  const roleIds: string[] = [];
  let counter = 0;
  const petitionIds: string[] = [];
  const caseIds: string[] = [];
  const fresh = (what: string) => `${tag} ${what} ${++counter}`;
  const reader = (name: string) => ({ id: user[name], role: '', canDispatch: false });

  const step = (over: Record<string, unknown> = {}) => ({
    name: 'Step',
    durationValue: 10,
    durationUnit: 'DAY',
    rollToWorkingDay: false,
    anchor: 'RECEIVED',
    redDays: 1,
    yellowDays: 2,
    greenDays: 3,
    legalBasis: 'Article 1',
    requiresApproval: true,
    parties: [
      { partyKind: 'TEAM', teamId: team.A, role: 'MAIN' },
      { partyKind: 'TEAM', teamId: team.C, role: 'COORDINATE' },
    ],
    ...over,
  });

  /** A record of `kind` (assigned to unit A) whose flow is `steps`, applied by hand. */
  const withFlow = async (steps: unknown[], kind: RecordKind = 'PETITION') => {
    const created = await flows.create(user.admin, { name: fresh('flow'), recordKind: kind });
    const saved = await flows.replaceSteps(created.id, created.draft!.id, user.admin, { steps, expectedRevision: created.draft!.revision });
    const flow = await flows.publish(created.id, saved.flow.draft!.id, user.admin, saved.flow.draft!.revision);
    let recordId: string;
    if (kind === 'CASE') {
      recordId = (
        await scratch.db.case.create({
          data: { name: fresh('case'), caseCode: `${tag}-c${++counter}`, caseProvenance: 'DIRECT_DISCOVERY', investigatorId: user.admin, assignedTeamId: team.A, status: 'DANG_DIEU_TRA', receiveDate: new Date('2026-12-01T00:00:00Z') } as never,
        })
      ).id;
      caseIds.push(recordId);
    } else {
      recordId = (
        await scratch.db.petition.create({
          data: { stt: fresh('p'), receivedDate: new Date('2026-12-01T00:00:00Z'), senderName: `${tag} sender`, loaiThongTin: `Không ai biết ${tag}`, enteredById: user.admin, assignedTeamId: team.A, status: 'DANG_XU_LY' } as never,
        })
      ).id;
      petitionIds.push(recordId);
    }
    await commands.apply(user.admin, kind, recordId, { flowId: flow.id });
    const get = () => commands.get(kind, recordId);
    return { kind, recordId, get, stepKey: (await get()).steps[0].stepKey };
  };

  /** A progress report of `who` on the first step. */
  const reportOf = async (base: Awaited<ReturnType<typeof withFlow>>, who: string, stepKey = base.stepKey) => {
    const flow = await base.get();
    await results.submitReport(user[who], base.kind, base.recordId, stepKey, { expectedRevision: flow.revision, kind: 'PROGRESS', doneWork: `Work of ${who}` });
    const book = await results.results(base.kind, base.recordId, stepKey);
    return book.reports.filter((r) => r.authorId === user[who]).at(-1)!.id;
  };

  /** A file as multer leaves it: written in the upload directory under a server name. */
  const upload = async (originalname = 'minutes.txt', text = `bytes of ${originalname}`) => {
    const filename = `${randomUUID()}.txt`;
    await writeFile(join(root, filename), text, { flag: 'wx' });
    return { filename, originalname, mimetype: 'text/plain', size: Buffer.byteLength(text) };
  };

  const bytesOf = async (download: Promise<{ data: { stream: AsyncIterable<unknown>; originalName: string } }>) => {
    const { data } = await download;
    const chunks: Buffer[] = [];
    for await (const chunk of data.stream) chunks.push(chunk as Buffer);
    return { name: data.originalName, text: Buffer.concat(chunks).toString('utf8') };
  };

  const failure = async (attempt: Promise<unknown>) => {
    try {
      await attempt;
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      return { status: error.getStatus(), code: (error.getResponse() as { code?: unknown }).code };
    }
    return 'RESOLVED' as const;
  };

  const dropFlows = async () => {
    const { db } = scratch;
    const flow = { name: { startsWith: PREFIX } };
    await db.procFlowStepVariant.deleteMany({ where: { step: { version: { flow } } } });
    await db.procFlowStepParty.deleteMany({ where: { step: { version: { flow } } } });
    await db.procFlowStep.deleteMany({ where: { version: { flow } } });
    await db.procFlowVersion.deleteMany({ where: { flow } });
    await db.procFlowBinding.deleteMany({ where: { flow } });
    await db.procFlow.deleteMany({ where: flow });
  };

  beforeAll(async () => {
    scratch = await openScratchDatabase(url as string);
    const { db } = scratch;
    await takeTurnOnSharedRow(scratch.pg, 'processing-flows');
    await dropFlows();
    root = await mkdtemp(join(tmpdir(), 'pc02-step-attachments-'));

    // Everybody may READ petitions and cases (the route's question); nobody here holds a write on either.
    permissions = await ensurePermissions(scratch, ['read:Petition', 'read:Case']);
    const reads = Object.values(permissions.ids).map((permissionId) => ({ permissionId }));
    const role = await db.role.create({ data: { name: `${tag}-role`, permissions: { create: reads } } });
    roleIds.push(role.id);
    for (const name of ['A', 'C', 'D']) team[name] = (await db.team.create({ data: { name: `${tag} unit ${name}`, code: `${tag}-${name}` } })).id;
    const person = async (name: string, teamName: string | null) => {
      user[name] = (await db.user.create({ data: { username: `${tag}-${name}`, firstName: name, lastName: 'Tester', passwordHash: 'x', roleId: role.id, isActive: true } })).id;
      if (teamName) await db.userTeam.create({ data: { userId: user[name], teamId: team[teamName] } });
    };
    await person('admin', null);
    await person('worker', 'A'); // the unit that works the step (and holds the record)
    await person('colleague', 'A'); // another member of it
    await person('coordinator', 'C'); // a unit that coordinates: no scope over the record, no write on it
    await person('outsider', 'D');

    const prisma = db as never;
    const audit = new AuditService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    flows = new ProcessingFlowsService(prisma, audit, calendars);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const stepAccess = new RecordStepAccessService(prisma, { isEnabled: () => Promise.resolve(true) } as never);
    await stepAccess.refreshSwitch();
    const gateway = new RecordGateway(new PetitionAdapter(prisma, scopes, stepAccess), new IncidentAdapter(prisma, scopes, stepAccess), new CaseAdapter(prisma, scopes, stepAccess));
    const writer = new RecordDeadlineWriter(prisma, gateway);
    const applier = new FlowApplicationService(prisma, gateway, calendars, audit, writer);
    commands = new ProcessingCommandService(prisma, gateway, calendars, applier, audit, writer);
    results = new ProcessingResultsService(prisma, commands);
    const governance = new CaseGovernanceService(prisma);
    const documents = new DocumentsService(prisma, audit, {} as never, governance, new CaseEvidenceGovernanceService(prisma, governance, new CaseFieldSchemaService(prisma, governance)));
    Object.defineProperty(documents, 'uploadDir', { value: root });
    attachments = new ProcessingAttachmentsService(prisma, gateway, results, documents);
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    const recordIds = [...petitionIds, ...caseIds];
    const userIds = Object.values(user);
    const flowIds = (await db.procRecordFlow.findMany({ where: { recordId: { in: recordIds } }, select: { id: true } })).map((row) => row.id);
    await db.auditLog.deleteMany({ where: { subject: 'ProcRecordFlow', subjectId: { in: flowIds } } });
    await db.document.deleteMany({ where: { uploadedById: { in: userIds } } });
    await db.procStepOpinion.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procStepReport.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procCommandKey.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procStepChange.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordId: { in: recordIds } } } });
    await db.procRecordStep.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procRecordFlow.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.petition.deleteMany({ where: { id: { in: petitionIds } } });
    await db.case.deleteMany({ where: { id: { in: caseIds } } });
    await dropFlows();
    await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await db.userTeam.deleteMany({ where: { userId: { in: userIds } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
    await db.role.deleteMany({ where: { id: { in: roleIds } } });
    await permissions.dropCreated();
    await scratch.close();
    if (root.startsWith(join(tmpdir(), 'pc02-step-attachments-'))) await rm(root, { recursive: true, force: true });
  });

  it('a member of a unit that only coordinates, with no write on the record, attaches a file to their own report; the book lists it and it downloads', async () => {
    const base = await withFlow([step()]);
    const reportId = await reportOf(base, 'coordinator');
    const before = await base.get();

    const added = await attachments.attach(user.coordinator, 'PETITION', base.recordId, base.stepKey, reportId, await upload('site-minutes.txt', 'what was seen'));
    expect(added).toMatchObject({ fileName: 'site-minutes.txt', size: 13, uploaderName: 'coordinator Tester' });

    // A document of the record itself (its own foreign key), tied to the report; the audit names it, no content.
    const row = await scratch.db.document.findUniqueOrThrow({ where: { id: added.id } });
    expect(row).toMatchObject({ petitionId: base.recordId, caseId: null, incidentId: null, procStepReportId: reportId, uploadedById: user.coordinator, deletedAt: null });
    const audit = await scratch.db.auditLog.findFirstOrThrow({ where: { subject: 'Document', subjectId: added.id, action: 'DOCUMENT_CREATED' } });
    expect(audit.metadata).toMatchObject({ procStepReportId: reportId, petitionId: base.recordId });
    // Attaching is not a command on the flow: the revision the screens hold is still good.
    expect((await base.get()).revision).toBe(before.revision);

    const book = await results.results('PETITION', base.recordId, base.stepKey);
    expect(book.reports.find((r) => r.id === reportId)!.attachments).toEqual([{ id: added.id, fileName: 'site-minutes.txt', size: 13, uploadedAt: row.createdAt.toISOString(), uploaderName: 'coordinator Tester' }]);

    // The unit that works the step reads the book, so it downloads the file of the unit that coordinates.
    expect(await bytesOf(attachments.openDownload(reader('worker'), 'PETITION', base.recordId, base.stepKey, reportId, added.id))).toEqual({ name: 'site-minutes.txt', text: 'what was seen' });
    expect(await bytesOf(attachments.openDownload(reader('coordinator'), 'PETITION', base.recordId, base.stepKey, reportId, added.id))).toMatchObject({ text: 'what was seen' });
    // Somebody the record is not shown to gets nothing, and learns nothing.
    expect(await failure(attachments.openDownload(reader('outsider'), 'PETITION', base.recordId, base.stepKey, reportId, added.id))).toEqual({ status: 404, code: 'RECORD_FLOW_NOT_FOUND' });
  });

  it('nobody attaches to, or removes from, the report of another person, not even a colleague of the same unit', async () => {
    const base = await withFlow([step()]);
    const reportId = await reportOf(base, 'worker');
    const mine = await attachments.attach(user.worker, 'PETITION', base.recordId, base.stepKey, reportId, await upload());
    for (const who of ['colleague', 'coordinator']) {
      expect(await failure(attachments.attach(user[who], 'PETITION', base.recordId, base.stepKey, reportId, await upload()))).toEqual({ status: 403, code: 'REPORT_NOT_YOURS' });
      expect(await failure(attachments.remove(user[who], 'PETITION', base.recordId, base.stepKey, reportId, mine.id))).toEqual({ status: 403, code: 'REPORT_NOT_YOURS' });
    }
    // Somebody who is no party of the step is told that, before anything about the report.
    expect(await failure(attachments.attach(user.outsider, 'PETITION', base.recordId, base.stepKey, reportId, await upload()))).toEqual({ status: 403, code: 'NOT_A_PARTY_OF_STEP' });
    expect((await results.results('PETITION', base.recordId, base.stepKey)).reports[0].attachments.map((a) => a.id)).toEqual([mine.id]);
  });

  it('after the step is done nothing is attached or removed, and the file still downloads', async () => {
    const base = await withFlow([step({ requiresApproval: false })]);
    const reportId = await reportOf(base, 'worker');
    const kept = await attachments.attach(user.worker, 'PETITION', base.recordId, base.stepKey, reportId, await upload('kept.txt', 'kept'));
    const flow = await base.get();
    const done = await commands.completeStep(user.admin, 'PETITION', base.recordId, base.stepKey, { expectedRevision: flow.revision });
    expect(done.steps[0].status).toBe('DONE');

    expect(await failure(attachments.attach(user.worker, 'PETITION', base.recordId, base.stepKey, reportId, await upload()))).toEqual({ status: 409, code: 'STEP_NOT_OPEN' });
    expect(await failure(attachments.remove(user.worker, 'PETITION', base.recordId, base.stepKey, reportId, kept.id))).toEqual({ status: 409, code: 'STEP_NOT_OPEN' });
    expect(await bytesOf(attachments.openDownload(reader('worker'), 'PETITION', base.recordId, base.stepKey, reportId, kept.id))).toEqual({ name: 'kept.txt', text: 'kept' });
  });

  it('a withdrawn report takes no more files, and a finished or deleted record takes none', async () => {
    const base = await withFlow([step()]);
    const reportId = await reportOf(base, 'worker');
    const flow = await base.get();
    await results.withdrawReport(user.worker, 'PETITION', base.recordId, base.stepKey, reportId, { expectedRevision: flow.revision });
    expect(await failure(attachments.attach(user.worker, 'PETITION', base.recordId, base.stepKey, reportId, await upload()))).toEqual({ status: 404, code: 'REPORT_NOT_FOUND' });

    const other = await withFlow([step()]);
    const standing = await reportOf(other, 'worker');
    await scratch.db.petition.update({ where: { id: other.recordId }, data: { status: 'DA_GIAI_QUYET' } as never });
    expect(await failure(attachments.attach(user.worker, 'PETITION', other.recordId, other.stepKey, standing, await upload()))).toEqual({ status: 409, code: 'RECORD_FINISHED' });
    await scratch.db.petition.update({ where: { id: other.recordId }, data: { status: 'DANG_XU_LY', deletedAt: new Date() } as never });
    expect(await failure(attachments.attach(user.worker, 'PETITION', other.recordId, other.stepKey, standing, await upload()))).toEqual({ status: 404, code: 'RECORD_FLOW_NOT_FOUND' });
    expect(await scratch.db.document.count({ where: { petitionId: { in: [base.recordId, other.recordId] } } })).toBe(0);
  });

  it('a document id of another record, of another step, or of a document that is no attachment is refused on download and on removal', async () => {
    const base = await withFlow([step({ requiresApproval: false }), step({ requiresApproval: false })]);
    const reportId = await reportOf(base, 'worker');
    const secondKey = (await base.get()).steps[1].stepKey;
    const secondReport = await reportOf(base, 'worker', secondKey);
    const onSecond = await attachments.attach(user.worker, 'PETITION', base.recordId, secondKey, secondReport, await upload('second.txt'));

    const elsewhere = await withFlow([step()]);
    const foreignReport = await reportOf(elsewhere, 'worker');
    const foreign = await attachments.attach(user.worker, 'PETITION', elsewhere.recordId, elsewhere.stepKey, foreignReport, await upload('foreign.txt'));

    // A plain document of the SAME record, uploaded through the documents module: no attachment of any report.
    const plainFile = await upload('plain.txt');
    const plain = await scratch.db.document.create({
      data: { title: 'plain', fileName: plainFile.filename, originalName: 'plain.txt', mimeType: 'text/plain', size: plainFile.size, filePath: join(root, plainFile.filename), petitionId: base.recordId, uploadedById: user.worker },
    });

    const missing = { status: 404, code: 'ATTACHMENT_NOT_FOUND' };
    for (const documentId of [foreign.id, onSecond.id, plain.id, 'no-such-document']) {
      expect(await failure(attachments.openDownload(reader('worker'), 'PETITION', base.recordId, base.stepKey, reportId, documentId))).toEqual(missing);
      expect(await failure(attachments.remove(user.worker, 'PETITION', base.recordId, base.stepKey, reportId, documentId))).toEqual(missing);
    }
    // The right report id under the WRONG step of the path opens nothing either.
    expect(await failure(attachments.openDownload(reader('worker'), 'PETITION', base.recordId, base.stepKey, secondReport, onSecond.id))).toEqual(missing);
    // Each is still there, and reachable by its own path.
    expect(await scratch.db.document.count({ where: { id: { in: [foreign.id, onSecond.id, plain.id] }, deletedAt: null } })).toBe(3);
    expect(await bytesOf(attachments.openDownload(reader('worker'), 'PETITION', base.recordId, secondKey, secondReport, onSecond.id))).toMatchObject({ name: 'second.txt' });
  });

  it('the author removes a file: it leaves the book and no longer downloads; the row stays, marked', async () => {
    const base = await withFlow([step()]);
    const reportId = await reportOf(base, 'coordinator');
    const first = await attachments.attach(user.coordinator, 'PETITION', base.recordId, base.stepKey, reportId, await upload('one.txt'));
    const second = await attachments.attach(user.coordinator, 'PETITION', base.recordId, base.stepKey, reportId, await upload('two.txt'));
    const listed = async () => (await results.results('PETITION', base.recordId, base.stepKey)).reports[0].attachments.map((a) => a.fileName);
    expect(await listed()).toEqual(['one.txt', 'two.txt']);

    expect(await attachments.remove(user.coordinator, 'PETITION', base.recordId, base.stepKey, reportId, first.id)).toEqual({ id: first.id });
    expect(await listed()).toEqual(['two.txt']);
    expect((await scratch.db.document.findUniqueOrThrow({ where: { id: first.id } })).deletedAt).not.toBeNull();
    expect(await scratch.db.auditLog.count({ where: { subject: 'Document', subjectId: first.id, action: 'DOCUMENT_DELETED' } })).toBe(1);
    expect(await failure(attachments.openDownload(reader('coordinator'), 'PETITION', base.recordId, base.stepKey, reportId, first.id))).toEqual({ status: 404, code: 'ATTACHMENT_NOT_FOUND' });
    // Removing it twice finds nothing.
    expect(await failure(attachments.remove(user.coordinator, 'PETITION', base.recordId, base.stepKey, reportId, first.id))).toEqual({ status: 404, code: 'ATTACHMENT_NOT_FOUND' });

    // A file that somehow sits under ANOTHER record is not this report's to remove or to open (found by Codex).
    const other = await withFlow([step()]);
    await scratch.db.document.update({ where: { id: second.id }, data: { petitionId: other.recordId } });
    expect(await failure(attachments.remove(user.coordinator, 'PETITION', base.recordId, base.stepKey, reportId, second.id))).toEqual({ status: 404, code: 'ATTACHMENT_NOT_FOUND' });
    expect(await failure(attachments.openDownload(reader('coordinator'), 'PETITION', base.recordId, base.stepKey, reportId, second.id))).toEqual({ status: 404, code: 'ATTACHMENT_NOT_FOUND' });
    expect((await scratch.db.document.findUniqueOrThrow({ where: { id: second.id } })).deletedAt).toBeNull();
    expect(second.id).not.toBe(first.id);
  });

  it('the attachment of a RESTRICTED case is not given to somebody the case policy refuses, who had it while the case was ordinary', async () => {
    const base = await withFlow([step()], 'CASE');
    const reportId = await reportOf(base, 'worker');
    const added = await attachments.attach(user.worker, 'CASE', base.recordId, base.stepKey, reportId, await upload('case-note.txt', 'of the case'));
    expect((await scratch.db.document.findUniqueOrThrow({ where: { id: added.id } })).caseId).toBe(base.recordId);

    // The control: the colleague of the unit that holds the case downloads it through the case's evidence governance.
    expect(await bytesOf(attachments.openDownload(reader('colleague'), 'CASE', base.recordId, base.stepKey, reportId, added.id))).toEqual({ name: 'case-note.txt', text: 'of the case' });

    await scratch.db.case.update({ where: { id: base.recordId }, data: { sensitivity: 'RESTRICTED' } as never });
    // Same person, same unit, same step: the case is now restricted and they hold no right to read sensitive cases.
    expect(await failure(attachments.openDownload(reader('colleague'), 'CASE', base.recordId, base.stepKey, reportId, added.id))).toEqual({ status: 404, code: 'RECORD_FLOW_NOT_FOUND' });
    // The evidence governance refuses on its own as well, were the step rule ever to let the person through.
    const open = { canRead: () => Promise.resolve(true), load: () => Promise.resolve(null) };
    const lax = new ProcessingAttachmentsService(scratch.db as never, open as never, results, (attachments as unknown as { documents: DocumentsService }).documents);
    expect(await failure(lax.openDownload(reader('colleague'), 'CASE', base.recordId, base.stepKey, reportId, added.id))).toMatchObject({ status: 403 });
  });
});
