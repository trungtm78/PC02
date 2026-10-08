const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const { PrismaPg } = require('../../backend/node_modules/@prisma/adapter-pg');
const root = path.resolve(__dirname, '../..');
const runtime = path.resolve(process.env.CASE_UAT_RUNTIME || '');
const database = new URL(process.env.DATABASE_URL || '');
assert.ok(runtime.includes('pc02-incident-uat-'));
assert.equal(database.hostname, '127.0.0.1');
assert.equal(database.port, '55441');
assert.equal(database.pathname, '/pc02_case_governance_uat');
const fixture = JSON.parse(fs.readFileSync(path.join(runtime, 'case-browser-fixture.json'), 'utf8'));
assert.equal(fixture.synthetic, true);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: database.toString() }) });
async function main() {
  let template = await prisma.documentNumberTemplate.findFirst({ where: { documentType: 'CASE', isActive: true } });
  let created = false;
  if (!template) {
    template = await prisma.documentNumberTemplate.create({ data: {
      name: 'Synthetic private UAT Case number', documentType: 'CASE', isActive: true,
      separator: '-', inputMode: 'AUTO',
      segments: [{ type: 'LITERAL', value: 'UAT-VA' }, { type: 'FORMULA', fn: 'FORMAT', source: 'NOW', pattern: 'YYYY' }, { type: 'COUNTER' }],
      counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 99999, padding: 5 },
      createdById: fixture.actors.author.id,
    }});
    created = true;
  }
  const report = { timestamp: new Date().toISOString(), synthetic: true, database: 'pc02_case_governance_uat', documentType: 'CASE', templateId: template.id, created };
  fs.writeFileSync(path.join(root, 'docs/test-evidence/case-governance/private-db/uat-number-template.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
main().finally(() => prisma.$disconnect());
