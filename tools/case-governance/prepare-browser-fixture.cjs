const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const { PrismaPg } = require('../../backend/node_modules/@prisma/adapter-pg');
const jwt = require('../../backend/node_modules/jsonwebtoken');
const bcrypt = require('../../backend/node_modules/bcrypt');
const root = path.resolve(__dirname, '../..');
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55441');
  assert.equal(url.pathname, '/pc02_case_governance_uat');
  const runtime = path.resolve(process.env.CASE_UAT_RUNTIME || '');
  assert.ok(runtime.includes('pc02-incident-uat-'), 'Private runtime required');
  assert.ok(!runtime.toLowerCase().startsWith(root.toLowerCase()), 'Keys and tokens must remain outside repository');
  const key = fs.readFileSync(path.join(runtime, 'jwt-private.pem'), 'utf8');
  const dest = path.join(runtime, 'case-browser-fixture.json');
  if (fs.existsSync(dest)) throw new Error('Browser fixture already exists; never overwrite an earlier run');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const namespace = 'case-browser-' + crypto.randomUUID();
  const fixture = { namespace, database: url.pathname.slice(1), api: 'http://127.0.0.1:3001/api/v1', frontend: 'http://127.0.0.1:5280', actors: {}, cases: {}, synthetic: true };
  try {
    const result = await db.$transaction(async tx => {
      const team = await tx.team.create({ data: { name: namespace + '-team', code: namespace + '-unit', isActive: true } });
      const otherTeam = await tx.team.create({ data: { name: namespace + '-other-team', code: namespace + '-other-unit', isActive: true } });
      const baseReads = ['Case', 'Document', 'Subject', 'Lawyer', 'Conclusion', 'SupplementaryInvestigation', 'Reinvestigation', 'Proposal', 'Delegation', 'Crime', 'Directory', 'User', 'Team', 'AuditLog', 'Dashboard', 'Notification'];
      const writers = ['Case', 'Document', 'Subject', 'Lawyer', 'Conclusion', 'SupplementaryInvestigation', 'Reinvestigation', 'Proposal', 'Delegation'];
      const roleSpecs = {
        author: ['operate','share','download','custody','dispose','read_sensitive'],
        reviewer: ['review','download','read_sensitive'],
        publisher: ['publish','download','read_sensitive'],
        readonly: [], wrongUnit: [], limitedSensitive: [], inactive: ['operate']
      };
      const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 4);
      for (const [name, capabilities] of Object.entries(roleSpecs)) {
        const role = await tx.role.create({ data: { name: namespace + '-' + name } });
        const pairs = baseReads.map(subject => [subject, 'read']);
        if (['author','reviewer','publisher','limitedSensitive'].includes(name)) for (const subject of writers) for (const action of ['write','edit','delete','restore']) pairs.push([subject, action]);
        for (const cap of capabilities) pairs.push(['CaseGovernance', cap]);
        for (const [subject, action] of pairs) {
          const permission = await tx.permission.upsert({ where: { action_subject: { action, subject } }, create: { action, subject }, update: {} });
          await tx.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
        }
        const actor = await tx.user.create({ data: { username: namespace + '-' + name, email: namespace + '-' + name + '@example.invalid', passwordHash, roleId: role.id, firstName: 'Synthetic', lastName: name, isActive: name !== 'inactive' } });
        await tx.userTeam.create({ data: { userId: actor.id, teamId: name === 'wrongUnit' ? otherTeam.id : team.id } });
        fixture.actors[name] = { id: actor.id, role: role.name, username: actor.username, email: actor.email, teamId: name === 'wrongUnit' ? otherTeam.id : team.id, accessToken: jwt.sign({ sub: actor.id, email: actor.email, role: role.name, tokenVersion: actor.tokenVersion, type: 'access' }, key, { algorithm: 'RS256', expiresIn: '8h' }) };
      }
      const data = { name: namespace + ' synthetic dossier', assignedTeamId: team.id, investigatorId: fixture.actors.author.id, createdById: fixture.actors.author.id, caseProvenance: 'DIRECT_DISCOVERY', sourceDocumentNote: 'Synthetic local UAT provenance, no actual dossier', intakeStage: 'PHAN_LOAI', status: 'DANG_DIEU_TRA', investigationPhase: 'INITIAL', ngayDeXuat: new Date('2026-09-12T00:00:00Z'), ngayKhoiTo: new Date('2026-10-01T00:00:00Z'), deadline: new Date('2026-12-01T00:00:00Z'), metadata: { description: 'Synthetic unverified legacy statement', ngayXayRa: '198X' } };
      const normal = await tx.case.create({ data });
      const restricted = await tx.case.create({ data: { ...data, name: namespace + ' restricted dossier', sensitivity: 'RESTRICTED' } });
      fixture.cases.normal = { id: normal.id }; fixture.cases.restricted = { id: restricted.id };
      fixture.teamId = team.id; fixture.otherTeamId = otherTeam.id;
      return { actors: Object.keys(fixture.actors).length, cases: 2 };
    });
    fs.writeFileSync(dest, JSON.stringify(fixture, null, 2), { flag: 'wx' });
    const report = { timestamp: new Date().toISOString(), namespace, database: 'loopback55441/pc02_case_governance_uat', actors: result.actors, cases: result.cases, synthetic: true, publishedConfiguration: false, tokens: 'private runtime only', verdict: 'PREPARED_NOT_UAT_PASS' };
    const reportPath = path.join(root, 'docs/test-evidence/case-governance/private-db/browser-preparation.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[redacted]')); process.exitCode = 1; });
