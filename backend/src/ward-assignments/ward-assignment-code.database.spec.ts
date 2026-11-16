import { randomUUID } from 'node:crypto';
import { buildSegmentsForTest, TEMPLATES_FOR_TEST } from '../../prisma/seed-document-numbers';
import { openScratchDatabase, type ScratchDatabase } from '../common/testing/scratch-database';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { WARD_ASSIGNMENT_NUMBER_SERIES } from './ward-assignment.codes';

/**
 * The code of a request ("Mã", `năm-số`) on a real PostgreSQL, from the series exactly as the seed builds it.
 *
 * What only the database shows: a counter behind the codes already stored (a code written by a migration, a restore, a
 * counter reset) would hand out a code that exists, and the submission would fail on the unique key (it happened to
 * petitions on 25/08/2026). The allocator compares with the largest code of this year in `ward_assignments`.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('the code of a ward assignment request, on PostgreSQL', () => {
  jest.setTimeout(60_000);
  let scratch: ScratchDatabase;
  const tag = `wan-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const year = new Date().getFullYear();

  beforeAll(async () => {
    scratch = await openScratchDatabase(url!);
    const { db } = scratch;
    const active = await db.documentNumberTemplate.count({ where: { documentType: WARD_ASSIGNMENT_NUMBER_SERIES, isActive: true } });
    if (active > 0) throw new Error('the scratch database already has a WARD_ASSIGNMENT series: this suite would not test its own');
    const role = await db.role.create({ data: { name: `${tag}-r` } });
    id.user = (await db.user.create({ data: { username: `${tag}-u`, passwordHash: 'x', roleId: role.id } })).id;
    id.team = (await db.team.create({ data: { code: `${tag}-W`, name: `${tag} W` } })).id;
    const spec = TEMPLATES_FOR_TEST.find((t) => t.documentType === WARD_ASSIGNMENT_NUMBER_SERIES);
    if (!spec) throw new Error('the seed declares no WARD_ASSIGNMENT series');
    id.template = (
      await db.documentNumberTemplate.create({
        data: {
          name: `${tag} ${spec.name}`,
          documentType: spec.documentType,
          separator: spec.separator,
          inputMode: spec.inputMode,
          createdById: id.user,
          segments: buildSegmentsForTest(spec),
          counterConfig: { resetPeriod: spec.resetPeriod, minValue: 1, maxValue: 99999, padding: spec.padding },
        },
      })
    ).id;
  });

  afterAll(async () => {
    const { db } = scratch;
    await db.wardAssignment.deleteMany({ where: { summary: { startsWith: tag } } });
    await db.documentNumberLog.deleteMany({ where: { templateId: id.template } });
    await db.documentNumberCounter.deleteMany({ where: { templateId: id.template } });
    await db.documentNumberTemplate.deleteMany({ where: { id: id.template } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await scratch.close();
  });

  const next = () =>
    scratch.db.$transaction(async (tx) => new DocumentNumbersService(scratch.db as never).commitWithTx(WARD_ASSIGNMENT_NUMBER_SERIES, { userId: id.user }, tx));

  it('the series of the seed gives `năm-số`, no prefix, no padding', async () => {
    const first = await next();
    expect(first.number).toMatch(new RegExp(`^${year}-\\d+$`));
  });

  it('a code already stored ahead of the counter is not handed out again: the next one follows the largest', async () => {
    await scratch.db.wardAssignment.create({
      data: { code: `${year}-777`, assignedTeamId: id.team, enteredById: id.user, caseType: 'CASE', summary: `${tag} x`, content: 'c', entryOfficerName: 'x' },
    });
    expect((await next()).number).toBe(`${year}-778`);
    expect((await next()).number).toBe(`${year}-779`);
  });
});
