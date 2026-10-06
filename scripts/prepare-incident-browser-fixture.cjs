const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { PrismaPg } = require('../backend/node_modules/@prisma/adapter-pg');
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55441' || url.pathname !== '/pc02_incident_release_uat') throw new Error('Refuse non-isolated DB');
  const fixturePath = process.env.INCIDENT_BROWSER_FIXTURE;
  if (!fixturePath) throw new Error('Private runtime fixture required');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  try {
    const source = await db.userTeam.findFirstOrThrow({ where: { userId: fixture.sender.user.id } });
    const incident = await db.incident.create({ data: {
      code: 'UAT-BROWSER-' + randomUUID(), name: 'Vụ việc UAT giao nhận trên giao diện',
      description: 'Dữ liệu kiểm thử cục bộ, không phải hồ sơ thật',
      assignedTeamId: source.teamId, createdById: fixture.sender.user.id,
      intakeStage: 'PHAN_LOAI', status: 'TIEP_NHAN',
      ngayDeXuat: new Date('2026-10-06'), deadline: new Date('2026-10-26'),
    } });
    fixture.incidentId = incident.id; fixture.code = incident.code;
    fs.writeFileSync(fixturePath, JSON.stringify(fixture));
    console.log('Prepared new synthetic local browser incident');
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
