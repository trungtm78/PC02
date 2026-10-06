const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { PrismaPg } = require('../backend/node_modules/@prisma/adapter-pg');
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55441'); assert.equal(url.pathname, '/pc02_incident_release_uat');
  const f = JSON.parse(fs.readFileSync(process.env.INCIDENT_BROWSER_FIXTURE, 'utf8'));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const base = 'http://127.0.0.1:5179/api/v1'; const key = 'INCIDENT_INTAKE_HANDOFF';
  const api = async (actor, endpoint, body) => {
    const response = await fetch(base + endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + f[actor].token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const prior = await db.featureFlag.findUniqueOrThrow({ where: { key } });
  try {
    const sourceTeam = await db.userTeam.findFirstOrThrow({ where: { userId: f.sender.user.id } });
    const create = () => db.incident.create({ data: { name: 'UAT rollback ' + randomUUID(), code: 'UAT-RB-' + randomUUID(), assignedTeamId: sourceTeam.teamId, intakeStage: 'PHAN_LOAI', status: 'TIEP_NHAN', ngayDeXuat: new Date('2026-10-06'), deadline: new Date('2026-10-26') } });
    const cancelSource = await create(), acceptSource = await create(), blockedSource = await create();
    await db.featureFlag.update({ where: { key }, data: { enabled: true } });
    const send = async source => {
      const sent = await api('sender', `/incidents/${source.id}/handoffs`, { toTeamId: f.toTeamId, expectedUpdatedAt: source.updatedAt.toISOString(), requestKey: randomUUID() });
      assert.equal(sent.status, 201);
      const current = await db.incident.findUniqueOrThrow({ where: { id: source.id } });
      return { ledger: sent.body.data, versions: { expectedUpdatedAt: current.updatedAt.toISOString(), expectedHandoffUpdatedAt: sent.body.data.updatedAt } };
    };
    const cancellation = await send(cancelSource), acceptance = await send(acceptSource);
    await db.featureFlag.update({ where: { key }, data: { enabled: false } });
    assert.equal((await api('sender', `/incidents/${blockedSource.id}/handoffs`, { toTeamId: f.toTeamId, expectedUpdatedAt: blockedSource.updatedAt.toISOString(), requestKey: randomUUID() })).status, 403);
    assert.equal((await api('sender', '/incidents/intake', { name: 'UAT intake while disabled' })).status, 403);
    assert.equal((await api('sender', `/incidents/${cancelSource.id}/handoffs/${cancellation.ledger.id}/cancel`, { ...cancellation.versions, reason: 'Rollback testing' })).status, 201);
    assert.equal((await api('receiver', `/incidents/${acceptSource.id}/handoffs/${acceptance.ledger.id}/accept`, acceptance.versions)).status, 201);
    for (const original of [cancelSource, acceptSource]) {
      const current = await db.incident.findUniqueOrThrow({ where: { id: original.id } });
      assert.equal(current.code, original.code); assert.equal(current.status, original.status);
      assert.equal(current.ngayDeXuat.getTime(), original.ngayDeXuat.getTime()); assert.equal(current.deadline.getTime(), original.deadline.getTime());
    }
    assert.equal((await db.incident.findUniqueOrThrow({ where: { id: cancelSource.id } })).intakeStage, 'PHAN_LOAI');
    assert.equal((await db.incident.findUniqueOrThrow({ where: { id: acceptSource.id } })).intakeStage, 'DA_NHAN');
    assert.equal(await db.incidentHandoff.count({ where: { incidentId: { in: [cancelSource.id, acceptSource.id] } } }), 2);
    const out = path.resolve('docs/test-evidence/incident-intake/continuation/rollback-uat.json');
    fs.writeFileSync(out, JSON.stringify({ timestamp: new Date().toISOString(), verdict: 'PASS', target: base, cases: ['OFF blocks new sends/intake', 'OFF permits cancellation', 'OFF permits clearing existing pending by receipt', 'Identity/status/dates/deadline preserved', 'Handoff history retained'] }, null, 2));
    console.log('PASS: reversible feature OFF rehearsal, existing ledgers retained');
  } finally { await db.featureFlag.update({ where: { key }, data: { enabled: prior.enabled } }); await db.$disconnect(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
