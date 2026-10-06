// Expected outcomes: approved AC-02/03/05/06/07/09/10. Local fixtures only.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { PrismaPg } = require('../backend/node_modules/@prisma/adapter-pg');
const ExcelJS = require('../backend/node_modules/exceljs');

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1'); assert.equal(target.port, '55441'); assert.equal(target.pathname, '/pc02_incident_release_uat');
  const f = JSON.parse(fs.readFileSync(process.env.INCIDENT_BROWSER_FIXTURE, 'utf8'));
  const base = 'http://127.0.0.1:5179/api/v1';
  const out = path.resolve('docs/test-evidence/incident-intake/continuation');
  fs.mkdirSync(out, { recursive: true });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString() }) });
  const cases = [];
  const api = async (actor, endpoint, method = 'GET', payload) => {
    const response = await fetch(base + endpoint, { method, headers: { Authorization: 'Bearer ' + f[actor].token, 'Content-Type': 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const check = async (id, action) => {
    try { await action(); cases.push({ id, result: 'PASS' }); }
    catch (e) { cases.push({ id, result: 'FAIL', message: e.message, stack: e.stack }); }
  };
  const handoff = async (record) => {
    const result = await api('sender', `/incidents/${record.id}/handoffs`, 'POST', { toTeamId: f.toTeamId, expectedUpdatedAt: record.updatedAt, requestKey: randomUUID() });
    assert.equal(result.status, 201, 'Synthetic send must succeed');
    const current = await api('sender', `/incidents/${record.id}`);
    assert.equal(current.status, 200);
    return { record: current.body.data, ledger: result.body.data };
  };
  try {
    const p = await handoff(f.uat.pending);
    const mismatch = await handoff(f.uat.mismatch);
    const acceptPath = `/incidents/${p.record.id}/handoffs/${p.ledger.id}/accept`;
    const versions = { expectedUpdatedAt: p.record.updatedAt, expectedHandoffUpdatedAt: p.ledger.updatedAt };
    await check('HTTP-ROLE-READ-MEMBER', async () => {
      const inbox = await api('reader', '/incidents/handoffs/inbox');
      assert.equal(inbox.status, 200); assert.ok(inbox.body.data.some(x => x.id === p.ledger.id));
      assert.equal((await api('reader', acceptPath, 'POST', versions)).status, 403);
    });
    await check('HTTP-ROLE-READ-GRANT', async () => {
      assert.equal((await api('grantee', `/incidents/${p.record.id}`)).status, 200);
      assert.equal((await api('grantee', acceptPath, 'POST', versions)).status, 403);
      assert.equal((await api('grantee', `/incidents/${p.record.id}`, 'PUT', { description: 'Must not write' })).status, 403);
      const writableId = f.uat.prosecution.id;
      assert.equal((await api('grantee', `/incidents/${writableId}`)).status, 200);
      const before = await db.incident.findUniqueOrThrow({ where: { id: writableId } });
      assert.equal(before.intakeStage, 'DA_NHAN'); assert.equal(before.status, 'DANG_XAC_MINH');
      assert.equal((await api('grantee', `/incidents/${writableId}`, 'PUT', { ghiChuKhac: 'Unauthorized change' })).status, 403);
      assert.equal((await db.incident.findUniqueOrThrow({ where: { id: writableId } })).ghiChuKhac, before.ghiChuKhac);
      const authorized = await api('receiver', `/incidents/${writableId}`, 'PUT', { ghiChuKhac: 'Authorized write control' });
      assert.equal(authorized.status, 200, JSON.stringify(authorized.body));
      assert.equal((await db.incident.findUniqueOrThrow({ where: { id: writableId } })).ghiChuKhac, 'Authorized write control');
      assert.equal(await db.auditLog.count({ where: { subjectId: writableId, userId: f.grantee.user.id, action: 'INCIDENT_UPDATED' } }), 0);
    });
    await check('HTTP-ROLE-OUTSIDE', async () => {
      assert.equal((await api('outsider', `/incidents/${p.record.id}`)).status, 403);
      assert.equal((await api('outsider', acceptPath, 'POST', versions)).status, 403);
      const inbox = await api('outsider', '/incidents/handoffs/inbox');
      assert.equal(inbox.status, 200); assert.ok(!inbox.body.data.some(x => x.id === p.ledger.id));
    });
    await check('HTTP-STALE-AND-IDOR', async () => {
      assert.equal((await api('receiver', acceptPath, 'POST', { ...versions, expectedUpdatedAt: '2000-01-01T00:00:00Z' })).status, 409);
      assert.equal((await api('receiver', `/incidents/${p.record.id}/handoffs/${mismatch.ledger.id}/accept`, 'POST', versions)).status, 404);
      assert.equal((await db.incident.findUniqueOrThrow({ where: { id: p.record.id } })).intakeStage, 'CHO_NHAN');
      assert.equal(await db.auditLog.count({ where: { subjectId: p.record.id, action: 'INCIDENT_HANDOFF_ACCEPTED' } }), 0);
    });
    await check('HTTP-RECEIVE-REPLAY', async () => {
      assert.equal((await api('receiver', acceptPath, 'POST', versions)).status, 201);
      assert.equal((await api('receiver', acceptPath, 'POST', versions)).status, 201);
      const after = await db.incident.findUniqueOrThrow({ where: { id: p.record.id } });
      for (const field of ['code', 'status']) assert.equal(after[field], p.record[field]);
      for (const field of ['ngayDeXuat', 'deadline']) assert.equal(after[field].toISOString(), p.record[field]);
      const audit = await db.auditLog.findMany({ where: { subjectId: p.record.id, action: 'INCIDENT_HANDOFF_ACCEPTED' } });
      assert.equal(audit.length, 1); assert.equal(audit[0].userId, f.receiver.user.id);
    });
    await check('HTTP-ADMIN-NONMEMBER', async () => {
      const a = await handoff(f.uat.admin);
      assert.equal(await db.userTeam.count({ where: { userId: f.admin.user.id, teamId: f.toTeamId } }), 0);
      assert.equal((await api('admin', `/incidents/${a.record.id}/handoffs/${a.ledger.id}/accept`, 'POST', { expectedUpdatedAt: a.record.updatedAt, expectedHandoffUpdatedAt: a.ledger.updatedAt })).status, 201);
      assert.equal((await db.incidentHandoff.findUniqueOrThrow({ where: { id: a.ledger.id } })).receivedById, f.admin.user.id);
    });
    await check('HTTP-PERMISSION-REVOKED-ACTIVE-TEAM', async () => {
      const sourceTeam = await db.userTeam.findFirstOrThrow({ where: { userId: f.sender.user.id } });
      const record = await db.incident.create({ data: { name: 'UAT changed permission ' + randomUUID(), code: 'UAT-REVOKE-' + randomUUID(), intakeStage: 'PHAN_LOAI', assignedTeamId: sourceTeam.teamId, status: 'TIEP_NHAN' } });
      const sent = await handoff(record);
      const endpoint = `/incidents/${record.id}/handoffs/${sent.ledger.id}/accept`;
      const version = { expectedUpdatedAt: sent.record.updatedAt, expectedHandoffUpdatedAt: sent.ledger.updatedAt };
      const editor = await db.user.findUniqueOrThrow({ where: { id: f.editorTarget.user.id }, include: { role: true } });
      const reader = await db.user.findUniqueOrThrow({ where: { id: f.reader.user.id } });
      assert.ok(editor.role.name.startsWith('UAT_INCIDENT_EDITOR_'));
      try {
        await db.user.update({ where: { id: editor.id }, data: { roleId: reader.roleId } });
        assert.equal((await api('editorTarget', endpoint, 'POST', version)).status, 403, 'Old JWT must not retain revoked edit permission');
      } finally { await db.user.update({ where: { id: editor.id }, data: { roleId: editor.roleId } }); }
      const team = await db.team.findUniqueOrThrow({ where: { id: f.toTeamId } });
      try {
        await db.team.update({ where: { id: team.id }, data: { isActive: false } });
        assert.equal((await api('editorTarget', endpoint, 'POST', version)).status, 403, 'Inactive receiving team must be denied');
      } finally { await db.team.update({ where: { id: team.id }, data: { isActive: team.isActive } }); }
      assert.equal(await db.auditLog.count({ where: { subjectId: record.id, action: 'INCIDENT_HANDOFF_ACCEPTED' } }), 0);
      assert.equal((await api('editorTarget', endpoint, 'POST', version)).status, 201, 'Restored permission and active team can accept');
    });
    await check('HTTP-RESULT-BYPASS', async () => {
      for (const status of ['DA_CHUYEN_VU_AN', 'DA_NHAP_VU_KHAC', 'DA_CHUYEN_DON_VI']) {
        assert.equal((await api('receiver', `/incidents/${f.uat.prosecution.id}/status`, 'PATCH', { status })).status, 400);
      }
      assert.equal((await api('receiver', `/incidents/${f.uat.prosecution.id}`, 'PUT', { status: 'DA_CHUYEN_VU_AN' })).status, 400);
      assert.equal(await db.case.count({ where: { linkedIncidentId: f.uat.prosecution.id } }), 0);
    });
    await check('HTTP-DECISION-VALIDATION', async () => {
      assert.equal((await api('receiver', `/incidents/${f.uat.history.id}/status`, 'PATCH', { status: 'TAM_DINH_CHI' })).status, 400);
      assert.equal((await api('receiver', `/incidents/${f.uat.prosecution.id}/prosecute`, 'POST', { caseName: 'Invalid date', prosecutionDecision: 'QD-UAT', prosecutionDate: '2026-02-30' })).status, 400);
      assert.equal((await db.incident.findUniqueOrThrow({ where: { id: f.uat.history.id } })).status, 'DANG_XAC_MINH');
    });
    await check('HTTP-HISTORY-LIST-STATS-EXCEL', async () => {
      const resource = `/incidents/${f.uat.history.id}/status`;
      assert.equal((await api('receiver', resource, 'PATCH', { status: 'TAM_DINH_CHI', decisionNumber: 'QD-UAT-TDC', decisionDate: '2026-10-06', lyDoTamDinhChiVuViec: ['CHUA_CO_KET_QUA_GIAM_DINH'] })).status, 200);
      assert.equal((await api('receiver', resource, 'PATCH', { status: 'PHUC_HOI_NGUON_TIN', decisionNumber: 'QD-UAT-PH', decisionDate: '2026-10-06' })).status, 200);
      const query = new URLSearchParams({ view: 'management', historyStatus: 'TAM_DINH_CHI' });
      const listed = await api('receiver', '/incidents?' + query + '&limit=100');
      assert.equal(listed.status, 200, 'Historical list'); assert.ok(listed.body.historyNotice.includes('chưa xác minh'));
      assert.ok(listed.body.data.some(x => x.id === f.uat.history.id)); assert.ok(!listed.body.data.some(x => x.id === f.uat.noHistory.id));
      const stats = await api('receiver', '/incidents/stats?' + query);
      assert.equal(stats.status, 200, 'Historical stats'); assert.equal(stats.body.total, listed.body.total);
      const response = await fetch(base + '/incidents/export/danh-sach?' + query, { headers: { Authorization: 'Bearer ' + f.receiver.token } });
      assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(path.join(out, 'historical-incidents.xlsx'), bytes);
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
      const cells = []; workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => cells.push(cell.value == null ? '' : cell.text))));
      assert.ok(cells.some(x => x.includes('chưa xác minh')));
      assert.ok(cells.some(x => x.includes(f.uat.history.code)));
      assert.ok(!cells.some(x => x.includes(f.uat.noHistory.code)));
    });
    const verdict = cases.every(x => x.result === 'PASS') ? 'PASS' : 'FAIL';
    fs.writeFileSync(path.join(out, 'http-uat.json'), JSON.stringify({ timestamp: new Date().toISOString(), target: base, verdict, cases }, null, 2));
    console.log(`${verdict}: ${cases.filter(x => x.result === 'PASS').length}/${cases.length} HTTP acceptance groups`);
    for (const failed of cases.filter(x => x.result === 'FAIL')) console.error(failed.id + ': ' + failed.stack);
    if (verdict === 'FAIL') process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
