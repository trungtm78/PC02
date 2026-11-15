import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { openScratchDatabase, type ScratchDatabase } from '../../common/testing/scratch-database';
import { takeTurnOnSharedRow } from '../../common/testing/shared-row-turn';
import { LOAI_DANH_MUC_LOAI_THONG_TIN } from '../../common/utils/khoa-loai-thong-tin.util';
import { TeamsService } from '../../teams/teams.service';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { ProcessingFlowsService } from '../config/processing-flows.service';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import { FlowApplicationService } from './flow-application.service';
import { RecordDeadlineWriter } from './record-deadline-writer.service';
import { MAX_ATTEMPTS, ProcessingOutboxService } from './processing-outbox.service';

/**
 * The outbox that applies a flow after a record is saved, on a REAL PostgreSQL: written only while the switch is on,
 * written in the record's own transaction (so it vanishes with a rolled-back save), one row per waiting record,
 * claimed without double work, retried with a pause, and given up on after a number of attempts.
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

const PREFIX = 'pfo-test-';

run('ProcessingOutboxService on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let outbox: ProcessingOutboxService;
  let failing: ProcessingOutboxService;
  let applier: FlowApplicationService;
  let flows: ProcessingFlowsService;
  let switchOn = true;
  let failure: Error | null = null;
  const tag = `${PREFIX}${randomUUID().slice(0, 8)}`;
  let actor = '';
  let roleId = '';
  let unit = '';
  let typeId = '';
  let counter = 0;
  const recordIds: string[] = [];
  const fresh = (what: string) => `${tag} ${what} ${++counter}`;

  const petition = async (over: Record<string, unknown> = {}) => {
    const row = await scratch.db.petition.create({
      data: {
        stt: fresh('p'),
        receivedDate: new Date('2026-12-01T00:00:00Z'),
        senderName: `${tag} sender`,
        loaiThongTin: `Tố cáo ${tag}`,
        enteredById: actor,
        assignedTeamId: unit,
        status: 'DANG_XU_LY',
        ...over,
      } as never,
    });
    recordIds.push(row.id);
    return row.id;
  };

  const rowsOf = (recordId: string) => scratch.db.procOutbox.findMany({ where: { recordId }, orderBy: { createdAt: 'asc' } });
  const enqueue = (recordId: string, service = outbox) => scratch.db.$transaction((tx) => service.enqueue(tx, 'PETITION', recordId, 'CREATED'));

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

    roleId = (await db.role.create({ data: { name: `${tag}-role` } })).id;
    actor = (await db.user.create({ data: { username: `${tag}-actor`, passwordHash: 'x', roleId, isActive: true } })).id;
    unit = (await db.team.create({ data: { name: `${tag} unit`, code: `${tag}-U` } })).id;
    typeId = (await db.directory.create({ data: { type: LOAI_DANH_MUC_LOAI_THONG_TIN, code: `${tag}-t`, name: `Tố cáo ${tag}` } })).id;

    const prisma = db as never;
    const audit = new AuditService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    flows = new ProcessingFlowsService(prisma, audit, calendars);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    applier = new FlowApplicationService(prisma, gateway, calendars, audit, new RecordDeadlineWriter(prisma, gateway));
    const flags = { isEnabled: () => Promise.resolve(switchOn) } as never;
    outbox = new ProcessingOutboxService(prisma, flags, applier);
    outbox.nudgeEnabled = false;
    // The same outbox with an applier that fails whenever `failure` is set.
    failing = new ProcessingOutboxService(prisma, flags, {
      apply: (input: Parameters<FlowApplicationService['apply']>[0]) => (failure ? Promise.reject(failure) : applier.apply(input)),
    } as never);
    failing.nudgeEnabled = false;

    const flow = await flows.create(actor, { name: `${tag} flow`, recordKind: 'PETITION' });
    const saved = await flows.replaceSteps(flow.id, flow.draft!.id, actor, {
      steps: [{ name: 'Check', durationValue: 10, durationUnit: 'DAY', anchor: 'RECEIVED', redDays: 1, yellowDays: 2, greenDays: 3, legalBasis: 'Article 1', parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }] }],
      expectedRevision: flow.draft!.revision,
    });
    const published = await flows.publish(flow.id, saved.flow.draft!.id, actor, saved.flow.draft!.revision);
    await flows.setBindings(published.id, actor, { directoryIds: [typeId], deadlineGroups: [], expectedRevision: published.revision });
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    const flowIds = (await db.procRecordFlow.findMany({ where: { recordId: { in: recordIds } }, select: { id: true } })).map((row) => row.id);
    await db.auditLog.deleteMany({ where: { subject: 'ProcRecordFlow', subjectId: { in: flowIds } } });
    await db.procStepChange.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordId: { in: recordIds } } } });
    await db.procRecordStep.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procRecordFlow.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procOutbox.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.petition.deleteMany({ where: { id: { in: recordIds } } });
    await dropFlows();
    await db.directory.deleteMany({ where: { code: { startsWith: tag } } });
    await db.auditLog.deleteMany({ where: { userId: actor } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.role.deleteMany({ where: { id: roleId } });
    await scratch.close();
  });

  beforeEach(async () => {
    switchOn = true;
    failure = null;
    await outbox.refreshSwitch();
    await failing.refreshSwitch();
  });

  describe('writing the request', () => {
    it('writes nothing while the switch is off: records are saved exactly as before', async () => {
      switchOn = false;
      await outbox.refreshSwitch();
      const recordId = await petition();
      await enqueue(recordId);
      expect(await rowsOf(recordId)).toHaveLength(0);
    });

    it('never waits for anything but its own write: the switch is not read while the record is being saved (found by Codex)', async () => {
      const recordId = await petition();
      let reads = 0;
      const counting = new ProcessingOutboxService(scratch.db as never, { isEnabled: () => { reads += 1; return Promise.resolve(true); } } as never, applier);
      counting.nudgeEnabled = false;
      await counting.refreshSwitch();
      const before = reads;
      await scratch.db.$transaction((tx) => counting.enqueue(tx, 'PETITION', recordId, 'CREATED'));
      expect(reads).toBe(before);
      expect(await rowsOf(recordId)).toHaveLength(1);
    });

    it('writes one PENDING row, and a second request for the same record while it waits adds nothing', async () => {
      const recordId = await petition();
      await enqueue(recordId);
      await enqueue(recordId);
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'PENDING', reason: 'CREATED', attempts: 0, recordKind: 'PETITION' }]);
    });

    it('is part of the record transaction: a save that rolls back leaves no request behind', async () => {
      const recordId = await petition();
      await expect(
        scratch.db.$transaction(async (tx) => {
          await outbox.enqueue(tx, 'PETITION', recordId, 'CREATED');
          throw new Error('the save failed');
        }),
      ).rejects.toThrow('the save failed');
      expect(await rowsOf(recordId)).toHaveLength(0);
    });
  });

  describe('applying', () => {
    it('applies the flow, marks the row DONE with what came of it, and the record has its steps', async () => {
      const recordId = await petition();
      await enqueue(recordId);
      expect(await outbox.drain()).toMatchObject({ done: expect.any(Number) });
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'DONE', outcome: 'APPLIED', lastError: null }]);
      expect(await scratch.db.procRecordStep.count({ where: { recordId } })).toBe(1);
    });

    it('a record the configuration has no flow for is DONE too, saying NO_FLOW: nothing to retry', async () => {
      const recordId = await petition({ loaiThongTin: `Chưa ai nghe ${tag}` });
      await enqueue(recordId);
      await outbox.drain();
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'DONE', outcome: 'NO_FLOW' }]);
    });

    it('several workers at once never apply the same row twice', async () => {
      const ids = await Promise.all(Array.from({ length: 8 }, () => petition()));
      for (const id of ids) await enqueue(id);
      const results = await Promise.all([outbox.drain(20), outbox.drain(20), outbox.drain(20)]);
      expect(results.reduce((sum, r) => sum + r.done, 0)).toBeGreaterThanOrEqual(8);
      for (const id of ids) {
        expect(await rowsOf(id)).toMatchObject([{ status: 'DONE', outcome: 'APPLIED', attempts: 1 }]);
        expect(await scratch.db.procRecordFlow.count({ where: { recordId: id } })).toBe(1);
      }
    });

    it('a switch turned off after the request was written stops the work: nothing is claimed, nothing applied (found by Codex)', async () => {
      const recordId = await petition();
      await enqueue(recordId);
      switchOn = false;
      expect(await outbox.drain()).toEqual({ done: 0, retried: 0, dead: 0 });
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'PENDING', attempts: 0 }]);
      expect(await scratch.db.procRecordFlow.count({ where: { recordId } })).toBe(0);
    });

    it('a row that is not due yet is left alone', async () => {
      const recordId = await petition();
      await enqueue(recordId);
      await scratch.db.procOutbox.updateMany({ where: { recordId }, data: { availableAt: new Date(Date.now() + 3_600_000) } });
      await outbox.drain();
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'PENDING', attempts: 0 }]);
    });
  });

  describe('when applying fails', () => {
    it('is tried again later with the reason kept, and the record is never touched', async () => {
      const recordId = await petition();
      await enqueue(recordId);
      failure = new Error('the calendar could not be read');
      const result = await failing.drain();
      expect(result.retried).toBeGreaterThanOrEqual(1);
      const [row] = await rowsOf(recordId);
      expect(row).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'the calendar could not be read' });
      expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
      expect(await scratch.db.procRecordFlow.count({ where: { recordId } })).toBe(0);

      // Later, when it works, the same row finishes.
      failure = null;
      await scratch.db.procOutbox.updateMany({ where: { recordId }, data: { availableAt: new Date(Date.now() - 1000) } });
      await failing.drain();
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'DONE', outcome: 'APPLIED', attempts: 2, lastError: null }]);
    });

    it('is given up on after the last attempt: DEAD, with the reason, for an administrator to see', async () => {
      const recordId = await petition();
      await enqueue(recordId);
      await scratch.db.procOutbox.updateMany({ where: { recordId }, data: { attempts: MAX_ATTEMPTS - 1 } });
      failure = new Error('still broken');
      const result = await failing.drain();
      expect(result.dead).toBeGreaterThanOrEqual(1);
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'DEAD', lastError: 'still broken' }]);
      // A dead request does not stop a fresh one for the same record.
      failure = null;
      await enqueue(recordId);
      expect((await rowsOf(recordId)).map((row) => row.status)).toEqual(['DEAD', 'PENDING']);
    });

    it('a process that died after claiming a row only delays it: the lease runs out and the row is taken again', async () => {
      const recordId = await petition();
      await enqueue(recordId);
      // Claimed and abandoned: attempts counted, the lease in the future.
      await scratch.db.procOutbox.updateMany({ where: { recordId }, data: { attempts: 1, availableAt: new Date(Date.now() + 300_000) } });
      await outbox.drain();
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'PENDING', attempts: 1 }]);
      await scratch.db.procOutbox.updateMany({ where: { recordId }, data: { availableAt: new Date(Date.now() - 1000) } });
      await outbox.drain();
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'DONE', outcome: 'APPLIED', attempts: 2 }]);
    });
  });
});
