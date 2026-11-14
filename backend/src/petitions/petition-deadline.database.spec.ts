import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import {
  dropOwnDeadlineRules,
  openScratchDatabase,
  ownActiveDeadlineRules,
  type ScratchDatabase,
} from '../common/testing/scratch-database';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import type { CreatePetitionDto } from './dto/create-petition.dto';
import { PetitionsService } from './petitions.service';

/**
 * REGRESSION CONTRACT: the deadline of a petition (Đơn thư) as the system computes and writes it TODAY, on a real
 * PostgreSQL. A record that has no processing flow must keep exactly this once flows exist.
 *
 * These tests state what the code does, including what looks odd; they do not say it is right.
 *
 * The active rule versions are this suite's own (see `ownActiveDeadlineRules`), with four different numbers of days so
 * that a deadline says which rule produced it, none of them the default (30 / 30 / 15 / 15): a product with the
 * defaults written into it, instead of reading the active rule, must not pass. Every petition is created with a number of its own (`stt`), which is
 * the manual-number path of the service: no shared counter is advanced. The information types carry the suite's tag,
 * so no entry of the shared `LOAI_THONG_TIN` directory can match them and the rule "by name" decides.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

// In CI a missing database is a failure, not a suite silently skipped.
if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

const DAYS = { THOI_HAN_TO_CAO: 33, THOI_HAN_KHIEU_NAI: 45, THOI_HAN_KIEN_NGHI: 12, THOI_HAN_PHAN_ANH: 19 } as const;

run('the deadline of a petition, on PostgreSQL', () => {
  jest.setTimeout(60_000);
  let scratch: ScratchDatabase;
  let petitions: PetitionsService;
  const tag = `pdl-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  let rules: Record<keyof typeof DAYS, { id: string; value: number }>;
  let n = 0;

  /** A new petition through the service, received on 5 January 2026 unless said otherwise. */
  const create = async (over: Partial<CreatePetitionDto> = {}) => {
    n += 1;
    const dto = { stt: `${tag}-${n}`, receivedDate: '2026-01-05', senderName: `${tag} người gửi ${n}`, ...over };
    const result = await petitions.create(dto as CreatePetitionDto, id.officer);
    return (result as { data: { id: string } }).data.id;
  };
  const stored = (petitionId: string) => scratch.db.petition.findUniqueOrThrow({ where: { id: petitionId } });
  const iso = (value: Date | null) => value?.toISOString() ?? null;

  beforeAll(async () => {
    scratch = await openScratchDatabase(url!);
    const { db } = scratch;
    rules = await ownActiveDeadlineRules(scratch, tag, DAYS);

    const role = await db.role.create({ data: { name: `${tag}-officer` } });
    id.officer = (await db.user.create({ data: { username: `${tag}-officer`, passwordHash: 'x', roleId: role.id } })).id;
    id.leader = (await db.user.create({ data: { username: `${tag}-leader`, passwordHash: 'x', roleId: role.id } })).id;
    id.team = (await db.team.create({ data: { code: `${tag}-T`, name: `${tag} Tổ` } })).id;
    await db.userTeam.create({ data: { userId: id.leader, teamId: id.team, isLeader: true } });

    const audit = new AuditService(db as never);
    petitions = new PetitionsService(
      db as never,
      audit,
      {} as never,
      new DeadlineRulesService(db as never, audit, {} as never),
      {} as never,
      { emit: () => false } as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  afterAll(async () => {
    const { db } = scratch;
    const mine = await db.petition.findMany({ where: { stt: { startsWith: tag } }, select: { id: true } });
    await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: [id.officer, id.leader] } }, { subjectId: { in: mine.map((m) => m.id) } }] } });
    await db.petition.deleteMany({ where: { stt: { startsWith: tag } } });
    await dropOwnDeadlineRules(scratch, tag);
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await scratch.close();
  });

  describe('at creation: the information type decides the rule', () => {
    it('a denunciation (Tố cáo) is due the received date plus the days of THOI_HAN_TO_CAO', async () => {
      const row = await stored(await create({ loaiThongTin: `Tố cáo ${tag}` }));
      expect(row.petitionType).toBe('TO_CAO');
      expect(iso(row.deadline)).toBe('2026-02-07T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_TO_CAO.id);
    });

    it('a complaint (Khiếu nại) is due the received date plus the days of THOI_HAN_KHIEU_NAI', async () => {
      const row = await stored(await create({ loaiThongTin: `Khiếu nại ${tag}` }));
      expect(row.petitionType).toBe('KHIEU_NAI');
      expect(iso(row.deadline)).toBe('2026-02-19T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_KHIEU_NAI.id);
    });

    it('a recommendation (Kiến nghị) is due the received date plus the days of THOI_HAN_KIEN_NGHI', async () => {
      const row = await stored(await create({ loaiThongTin: `Kiến nghị ${tag}` }));
      expect(row.petitionType).toBe('KIEN_NGHI');
      expect(iso(row.deadline)).toBe('2026-01-17T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_KIEN_NGHI.id);
    });

    it('any other information type (here "Trình báo") is due like a report (Phản ánh): THOI_HAN_PHAN_ANH', async () => {
      const row = await stored(await create({ loaiThongTin: `Trình báo ${tag}` }));
      expect(row.petitionType).toBe('PHAN_ANH');
      expect(iso(row.deadline)).toBe('2026-01-24T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_PHAN_ANH.id);
    });

    it('"Đơn tố cáo" is a denunciation: a leading "Đơn" does not change the rule', async () => {
      const row = await stored(await create({ loaiThongTin: `Đơn tố cáo ${tag}` }));
      expect(row.petitionType).toBe('TO_CAO');
      expect(iso(row.deadline)).toBe('2026-02-07T00:00:00.000Z');
    });

    it('a petition with no information type and no type still gets a deadline: the one of a report (Phản ánh)', async () => {
      const row = await stored(await create());
      expect(row.petitionType).toBeNull();
      expect(row.loaiThongTin).toBeNull();
      expect(iso(row.deadline)).toBe('2026-01-24T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_PHAN_ANH.id);
    });

    it('with no information type, the type the client sends decides the rule', async () => {
      const row = await stored(await create({ petitionType: 'KHIEU_NAI' } as never));
      expect(row.petitionType).toBe('KHIEU_NAI');
      expect(iso(row.deadline)).toBe('2026-02-19T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_KHIEU_NAI.id);
    });

    it('with an information type, the type the client sends is ignored', async () => {
      const row = await stored(await create({ loaiThongTin: `Kiến nghị ${tag}`, petitionType: 'TO_CAO' } as never));
      expect(row.petitionType).toBe('KIEN_NGHI');
      expect(iso(row.deadline)).toBe('2026-01-17T00:00:00.000Z');
    });
  });

  describe('at creation: what the deadline is counted from', () => {
    it('it is counted from the received date, at 00:00 UTC of the day it falls on', async () => {
      const row = await stored(await create({ receivedDate: '2026-03-01' }));
      expect(iso(row.receivedDate)).toBe('2026-03-01T00:00:00.000Z');
      expect(iso(row.deadline)).toBe('2026-03-20T00:00:00.000Z');
    });

    it('the declared time of reception does not move the deadline', async () => {
      const row = await stored(await create({ gioTiepNhan: '16:45' }));
      expect(row.gioTiepNhan).toBe('16:45');
      expect(iso(row.deadline)).toBe('2026-01-24T00:00:00.000Z');
    });

    it('the proposal date plays no part (unlike an incident)', async () => {
      const row = await stored(await create({ ngayDeXuat: '2026-01-09' } as never));
      expect(iso(row.ngayDeXuat)).toBe('2026-01-09T00:00:00.000Z');
      expect(iso(row.deadline)).toBe('2026-01-24T00:00:00.000Z');
    });

    it('a deadline sent with the petition is stored as sent, and no rule version is recorded', async () => {
      const row = await stored(await create({ loaiThongTin: `Tố cáo ${tag}`, deadline: '2026-04-01' }));
      expect(iso(row.deadline)).toBe('2026-04-01T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBeNull();
      // The type is still derived from the information type.
      expect(row.petitionType).toBe('TO_CAO');
    });
  });

  describe('editing (PUT /petitions/:id)', () => {
    it('changing the information type changes the type but NOT the deadline, and the old rule version stays', async () => {
      const petitionId = await create({ loaiThongTin: `Tố cáo ${tag}` });
      await petitions.update(petitionId, { loaiThongTin: `Khiếu nại ${tag}` } as never, id.officer);
      const row = await stored(petitionId);
      expect(row.petitionType).toBe('KHIEU_NAI');
      expect(row.loaiThongTin).toBe(`Khiếu nại ${tag}`);
      expect(iso(row.deadline)).toBe('2026-02-07T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_TO_CAO.id);
    });

    it('changing the received date does NOT move the deadline', async () => {
      const petitionId = await create({ loaiThongTin: `Tố cáo ${tag}` });
      await petitions.update(petitionId, { receivedDate: '2026-01-10' } as never, id.officer);
      const row = await stored(petitionId);
      expect(iso(row.receivedDate)).toBe('2026-01-10T00:00:00.000Z');
      expect(iso(row.deadline)).toBe('2026-02-07T00:00:00.000Z');
    });

    it('saving the same information type again changes nothing about the deadline', async () => {
      const petitionId = await create({ loaiThongTin: `Tố cáo ${tag}` });
      await petitions.update(petitionId, { loaiThongTin: `Tố cáo ${tag}`, senderPhone: '0900000001' } as never, id.officer);
      const row = await stored(petitionId);
      expect(row.petitionType).toBe('TO_CAO');
      expect(iso(row.deadline)).toBe('2026-02-07T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_TO_CAO.id);
    });

    it('clearing the information type keeps the type and the deadline', async () => {
      const petitionId = await create({ loaiThongTin: `Tố cáo ${tag}` });
      await petitions.update(petitionId, { loaiThongTin: '' } as never, id.officer);
      const row = await stored(petitionId);
      expect(row.petitionType).toBe('TO_CAO');
      expect(iso(row.deadline)).toBe('2026-02-07T00:00:00.000Z');
    });

    it('a deadline sent with an edit replaces the deadline as sent, and the rule version of the old one stays', async () => {
      const petitionId = await create({ loaiThongTin: `Tố cáo ${tag}` });
      await petitions.update(petitionId, { deadline: '2026-05-01' } as never, id.officer);
      const row = await stored(petitionId);
      expect(iso(row.deadline)).toBe('2026-05-01T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_TO_CAO.id);
    });

    it('an edit that sends an empty deadline clears it', async () => {
      const petitionId = await create({ loaiThongTin: `Tố cáo ${tag}` });
      await petitions.update(petitionId, { deadline: '' } as never, id.officer);
      const row = await stored(petitionId);
      expect(row.deadline).toBeNull();
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_TO_CAO.id);
    });

    it('an edit that does not mention the deadline leaves it alone', async () => {
      const petitionId = await create({ loaiThongTin: `Tố cáo ${tag}` });
      await petitions.update(petitionId, { summary: `${tag} sửa tóm tắt` } as never, id.officer);
      expect(iso((await stored(petitionId)).deadline)).toBe('2026-02-07T00:00:00.000Z');
    });
  });

  describe('assigning (PATCH /petitions/:id/assign)', () => {
    it('a deadline sent with the assignment replaces the deadline as sent', async () => {
      const petitionId = await create({ loaiThongTin: `Tố cáo ${tag}` });
      await petitions.assignPetition(petitionId, { assignedTeamId: id.team, deadline: '2026-06-01' } as never, id.officer);
      const row = await stored(petitionId);
      expect(iso(row.deadline)).toBe('2026-06-01T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_TO_CAO.id);
      // With nobody named, the leader of the team becomes the assignee.
      expect(row).toMatchObject({ assignedTeamId: id.team, assignedToId: id.leader });
    });

    it('an assignment without a deadline keeps the deadline the petition had', async () => {
      const petitionId = await create({ loaiThongTin: `Tố cáo ${tag}` });
      await petitions.assignPetition(petitionId, { assignedTeamId: id.team } as never, id.officer);
      expect(iso((await stored(petitionId)).deadline)).toBe('2026-02-07T00:00:00.000Z');
    });
  });
});
