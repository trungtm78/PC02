const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const { PrismaPg } = require('../../backend/node_modules/@prisma/adapter-pg');
const jwt = require('../../backend/node_modules/jsonwebtoken');

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55441');
  assert.equal(url.pathname, '/pc02_case_governance_uat');
  const runtime = path.resolve(process.env.CASE_UAT_RUNTIME || '');
  assert.ok(runtime.includes('pc02-incident-uat-'));
  const file = path.join(runtime, 'case-browser-fixture.json');
  const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(fixture.synthetic, true);
  const key = fs.readFileSync(path.join(runtime, 'jwt-private.pem'), 'utf8');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  try {
    for (const actor of Object.values(fixture.actors)) {
      const current = await db.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { id: true, email: true, tokenVersion: true, isActive: true, role: { select: { name: true } } },
      });
      actor.accessToken = jwt.sign(
        { sub: current.id, email: current.email, role: current.role.name, tokenVersion: current.tokenVersion, type: 'access' },
        key,
        { algorithm: 'RS256', expiresIn: '8h' },
      );
    }
    const backup = `${file}.expired-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(file, JSON.stringify(fixture, null, 2));
    console.log(JSON.stringify({ refreshed: Object.keys(fixture.actors).length, synthetic: true, backup: path.basename(backup) }));
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[redacted]'));
  process.exitCode = 1;
});
