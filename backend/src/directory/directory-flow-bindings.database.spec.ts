import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { openScratchDatabase, type ScratchDatabase } from '../common/testing/scratch-database';
import { takeTurnOnSharedRow } from '../common/testing/shared-row-turn';
import { LOAI_DANH_MUC_LOAI_THONG_TIN } from '../common/utils/khoa-loai-thong-tin.util';
import { WorkingCalendarService } from '../processing-flow/calendar/working-calendar.service';
import { ProcessingFlowsService } from '../processing-flow/config/processing-flows.service';
import { DirectoryService } from './directory.service';

/**
 * What the catalogue of information types does to the processing flows bound to its entries, on a REAL PostgreSQL:
 * a rename that would make two flows read the same text is refused, and deleting an entry a flow is bound to says why.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database. Works on rows of its own and removes them.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

/** Flows of an earlier run that was killed carry this prefix too. */
const PREFIX = 'dfb-test-';

run('DirectoryService and the flows bound to its entries on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  let directory: DirectoryService;
  const tag = `${PREFIX}${randomUUID().slice(0, 8)}`;
  let actor = '';
  let roleId = '';
  let counter = 0;

  const refusalOf = async (attempt: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> } | 'RESOLVED'> => {
    try {
      await attempt;
    } catch (error) {
      const http = error as { getStatus?: () => number; getResponse?: () => unknown };
      if (typeof http.getStatus !== 'function') throw error;
      return { status: http.getStatus(), body: http.getResponse?.() as Record<string, unknown> };
    }
    return 'RESOLVED';
  };

  const entry = (name: string) =>
    scratch.db.directory.create({ data: { type: LOAI_DANH_MUC_LOAI_THONG_TIN, code: `${tag}-${++counter}`, name: `${name} ${tag}` } });

  const dropFlows = async (): Promise<void> => {
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
    const audit = new AuditService(db as never);
    flows = new ProcessingFlowsService(db as never, audit, new WorkingCalendarService(db as never, audit));
    directory = new DirectoryService(db as never);
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    await dropFlows();
    await db.directory.deleteMany({ where: { code: { startsWith: tag } } });
    await db.auditLog.deleteMany({ where: { userId: actor } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.role.deleteMany({ where: { id: roleId } });
    await scratch.close();
  });

  it('renaming an entry bound to a flow so that it reads like an entry another flow holds is refused, naming that flow', async () => {
    const mine = await entry('Alpha');
    const theirs = await entry('Beta');
    const a = await flows.create(actor, { name: `${tag} A`, recordKind: 'PETITION' });
    const b = await flows.create(actor, { name: `${tag} B`, recordKind: 'PETITION' });
    await flows.setBindings(a.id, actor, { directoryIds: [mine.id], deadlineGroups: [], expectedRevision: a.revision });
    await flows.setBindings(b.id, actor, { directoryIds: [theirs.id], deadlineGroups: [], expectedRevision: b.revision });

    const result = await refusalOf(directory.update(mine.id, { name: `Beta ${tag}` }));
    expect(result).not.toBe('RESOLVED');
    expect(result).toMatchObject({ status: 409, body: { code: 'TYPE_ALREADY_BOUND', details: [{ directoryId: mine.id, flowId: b.id, flowName: `${tag} B` }] } });
    // Nothing changed: the name is the old one.
    expect((await scratch.db.directory.findUniqueOrThrow({ where: { id: mine.id } })).name).toBe(`Alpha ${tag}`);
  });

  it('a rename that collides with nothing goes through; the key the binding was made with is kept', async () => {
    const e = await entry('Gamma');
    const flow = await flows.create(actor, { name: `${tag} C`, recordKind: 'PETITION' });
    await flows.setBindings(flow.id, actor, { directoryIds: [e.id], deadlineGroups: [], expectedRevision: flow.revision });

    await directory.update(e.id, { name: `Delta ${tag}` });
    const bound = (await flows.get(flow.id)).boundTypes[0];
    expect(bound).toMatchObject({ directoryId: e.id, renamed: true });
  });

  it('an entry nothing is bound to is renamed as before, to anything', async () => {
    const free = await entry('Epsilon');
    const taken = await entry('Zeta');
    const flow = await flows.create(actor, { name: `${tag} D`, recordKind: 'PETITION' });
    await flows.setBindings(flow.id, actor, { directoryIds: [taken.id], deadlineGroups: [], expectedRevision: flow.revision });
    await directory.update(free.id, { name: `Zeta ${tag}` });
    expect((await scratch.db.directory.findUniqueOrThrow({ where: { id: free.id } })).name).toBe(`Zeta ${tag}`);
  });

  it('a rename that does not change the name (only the description, say) is not looked at', async () => {
    const e = await entry('Eta');
    const flow = await flows.create(actor, { name: `${tag} E`, recordKind: 'PETITION' });
    await flows.setBindings(flow.id, actor, { directoryIds: [e.id], deadlineGroups: [], expectedRevision: flow.revision });
    await directory.update(e.id, { description: 'a note' });
    expect((await scratch.db.directory.findUniqueOrThrow({ where: { id: e.id } })).description).toBe('a note');
  });

  it('deleting an entry a flow is bound to answers DIRECTORY_BOUND_TO_FLOW with the flow, not a database error', async () => {
    const e = await entry('Theta');
    const flow = await flows.create(actor, { name: `${tag} F`, recordKind: 'INCIDENT' });
    await flows.setBindings(flow.id, actor, { directoryIds: [e.id], deadlineGroups: [], expectedRevision: flow.revision });

    const result = await refusalOf(directory.remove(e.id));
    expect(result).toMatchObject({ status: 409, body: { code: 'DIRECTORY_BOUND_TO_FLOW', details: [{ flowId: flow.id, flowName: `${tag} F` }] } });
    expect(await scratch.db.directory.count({ where: { id: e.id } })).toBe(1);

    // Free the entry (the flow lets it go) and it is deleted as before.
    const current = await flows.get(flow.id);
    await flows.setBindings(flow.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: current.revision });
    await directory.remove(e.id);
    expect(await scratch.db.directory.count({ where: { id: e.id } })).toBe(0);
  });

  it('two renames to the same name at the same moment: at most one entry of a kind of flows takes it', async () => {
    const one = await entry('Iota');
    const two = await entry('Kappa');
    const fa = await flows.create(actor, { name: `${tag} G`, recordKind: 'PETITION' });
    const fb = await flows.create(actor, { name: `${tag} H`, recordKind: 'PETITION' });
    await flows.setBindings(fa.id, actor, { directoryIds: [one.id], deadlineGroups: [], expectedRevision: fa.revision });
    await flows.setBindings(fb.id, actor, { directoryIds: [two.id], deadlineGroups: [], expectedRevision: fb.revision });

    const outcomes = await Promise.all([directory.update(one.id, { name: `Lambda ${tag}` }), directory.update(two.id, { name: `Lambda ${tag}` })].map((p) => refusalOf(p)));
    expect(outcomes.filter((outcome) => outcome === 'RESOLVED')).toHaveLength(1);
    const refused = outcomes.find((outcome) => outcome !== 'RESOLVED');
    expect(refused).toMatchObject({ status: 409, body: { code: 'TYPE_ALREADY_BOUND' } });
  });
});
