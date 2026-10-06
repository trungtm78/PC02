// Requirements oracle: approved amendment A01/A02/A03. Isolated synthetic DB only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('../backend/node_modules/pg');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { PrismaPg } = require('../backend/node_modules/@prisma/adapter-pg');
const ExcelJS = require('../backend/node_modules/exceljs');

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55441'); assert.equal(url.pathname, '/pc02_incident_release_uat');
  const f = JSON.parse(fs.readFileSync(process.env.INCIDENT_BROWSER_FIXTURE, 'utf8'));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const sql = new Client({ connectionString: url.toString() });
  const out = path.resolve('docs/test-evidence/incident-intake/continuation');
  const tag = 'zz' + randomUUID().replaceAll('-', '');
  const base = 'http://127.0.0.1:5179/api/v1';
  const checks = [];
  const api = async (actor, endpoint, method = 'GET', payload) => {
    const response = await fetch(base + endpoint, { method, headers: { Authorization: 'Bearer ' + f[actor].token, 'Content-Type': 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const check = async (id, action) => { try { await action(); checks.push({ id, result: 'PASS' }); } catch (error) { checks.push({ id, result: 'FAIL', message: error.message }); } };
  try {
    await sql.connect();
    const outside = await db.userTeam.findFirstOrThrow({ where: { userId: f.outsider.user.id } });
    const makeCase = (suffix, team, extra = {}) => db.case.create({ data: { caseCode: tag + suffix, name: 'Synthetic amendment ' + suffix, caseType: 'UY_THAC_DIEU_TRA', caseProvenance: 'UY_THAC_DIEU_TRA', assignedTeamId: team, createdById: f.admin.user.id, ngayDeXuat: new Date(), ketQuaUyThac: 'Đã xác minh ' + tag, ngayTraKetQua: new Date(), ...extra } });
    const old = await makeCase('old', f.toTeamId);
    // A2's shadow/backfill is already deployed on the live baseline. Preserve and verify its actual trigger contract;
    // the release adds only the handoff migration and must not overwrite production's search functions.
    await check('A02-EXISTING-DEPLOYED-SEARCH-CONTRACT', async () => {
      const row = await db.case.findUniqueOrThrow({ where: { id: old.id } });
      assert.ok(row.ketQuaUyThacBd?.includes('da xac minh ' + tag), 'Existing row must receive new text shadow');
      assert.ok(row.timKiemBd?.includes(tag), 'Existing aggregate must include new field');
      assert.equal(row.updatedAt.toISOString(), old.updatedAt.toISOString(), 'Refresh must preserve business version');
    });
    if (process.argv.includes('--migration-only')) return;
    const fresh = await makeCase('fresh', f.toTeamId);
    const hidden = await makeCase('hidden', outside.teamId);
    const query = new URLSearchParams({ caseType: 'UY_THAC_DIEU_TRA', tk: 'ketQuaUyThac~da xac minh ' + tag, limit: '100' });
    await check('A02-ACCENT-SCOPE-LIST-STATS-EXCEL', async () => {
      const list = await api('editorTarget', '/cases?' + query);
      assert.equal(list.status, 200);
      assert.deepEqual(list.body.data.map(x => x.id).sort(), [old.id, fresh.id].sort());
      const statsQuery = new URLSearchParams(query); statsQuery.delete('limit');
      const stats = await api('editorTarget', '/cases/utdt-stats?' + statsQuery);
      assert.equal(stats.status, 200); assert.equal(stats.body.total, 2);
      const admin = await api('admin', '/cases?' + query);
      assert.equal(admin.status, 200); assert.equal(admin.body.total, 3);
      const exported = await fetch(base + '/cases/export/danh-sach?' + query, { headers: { Authorization: 'Bearer ' + f.editorTarget.token } });
      assert.equal(exported.status, 200);
      const bytes = Buffer.from(await exported.arrayBuffer()); fs.writeFileSync(path.join(out, 'amendment-utdt-search.xlsx'), bytes);
      const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes);
      const texts = []; book.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => texts.push(cell.value == null ? '' : cell.text))));
      assert.ok(texts.includes(old.caseCode)); assert.ok(texts.includes(fresh.caseCode)); assert.ok(!texts.includes(hidden.caseCode));
      const all = await api('editorTarget', '/cases?' + new URLSearchParams({ caseType: 'UY_THAC_DIEU_TRA', tk: '*~' + tag, limit: '100' }));
      assert.equal(all.status, 200); assert.deepEqual(all.body.data.map(x => x.id).sort(), [old.id, fresh.id].sort());
      const unknown = await api('editorTarget', '/cases?' + new URLSearchParams({ tk: 'unknownColumn~x' })); assert.equal(unknown.status, 400);
      const unchanged = await db.case.findUniqueOrThrow({ where: { id: old.id } }); assert.equal(unchanged.ketQuaUyThac, old.ketQuaUyThac);
    });
    const makeIncident = (suffix, extra = {}) => db.incident.create({ data: { code: tag + suffix, name: 'Synthetic restored source ' + suffix, assignedTeamId: f.toTeamId, intakeStage: 'DA_NHAN', status: 'PHUC_HOI_NGUON_TIN', createdById: f.admin.user.id, ngayDeXuat: new Date('2026-09-12'), ...extra } });
    for (const [suffix, status, endpoint, method, data] of [
      ['nokt', 'KHONG_KHOI_TO', 'status', 'PATCH', { status: 'KHONG_KHOI_TO', decisionNumber: 'UAT-NOKT', decisionDate: '2026-10-06', lyDoKhongKhoiTo: 'KHONG_CO_SU_VIEC' }],
      ['tdc', 'TAM_DINH_CHI', 'status', 'PATCH', { status: 'TAM_DINH_CHI', decisionNumber: 'UAT-TDC', decisionDate: '2026-10-06', lyDoTamDinhChiVuViec: ['CHUA_CO_KET_QUA_GIAM_DINH'] }],
      ['transfer', 'DA_CHUYEN_DON_VI', 'transfer', 'PATCH', { donViMoi: 'Synthetic receiving unit' }],
      ['prosecute', 'DA_CHUYEN_VU_AN', 'prosecute', 'POST', { caseName: 'Synthetic restored case', prosecutionDecision: 'UAT-PROSECUTE', prosecutionDate: '2026-10-06' }],
    ]) await check('A03-DIRECT-' + suffix.toUpperCase(), async () => {
      const record = await makeIncident(suffix);
      const invalid = await api('editorTarget', `/incidents/${record.id}/${endpoint}`, method, endpoint === 'transfer' ? { donViMoi: '   ' } : endpoint === 'prosecute' ? { ...data, prosecutionDate: '2026-02-30' } : { status });
      assert.equal(invalid.status, 400);
      assert.equal((await api('grantee', `/incidents/${record.id}/${endpoint}`, method, data)).status, 403);
      assert.equal((await api('editorTarget', `/incidents/${record.id}/${endpoint}`, method, { ...data, expectedUpdatedAt: '2000-01-01T00:00:00Z' })).status, 409);
      const result = await api('editorTarget', `/incidents/${record.id}/${endpoint}`, method, { ...data, expectedUpdatedAt: record.updatedAt.toISOString() });
      assert.equal(result.status, method === 'POST' ? 201 : 200, JSON.stringify(result.body));
      const stored = await db.incident.findUniqueOrThrow({ where: { id: record.id } });
      assert.equal(stored.status, status); assert.equal(stored.ngayDeXuat.toISOString(), record.ngayDeXuat.toISOString());
      assert.equal(await db.incidentStatusHistory.count({ where: { incidentId: record.id, fromStatus: 'PHUC_HOI_NGUON_TIN', toStatus: status } }), 1);
      assert.equal(await db.auditLog.count({ where: { subjectId: record.id, action: endpoint === 'transfer' ? 'INCIDENT_TRANSFERRED' : endpoint === 'prosecute' ? 'INCIDENT_PROSECUTED' : 'INCIDENT_STATUS_CHANGED' } }), 1);
      if (endpoint === 'prosecute') {
        const linked = await db.case.findUniqueOrThrow({ where: { id: stored.linkedCaseId } }); assert.equal(linked.linkedIncidentId, record.id);
        assert.equal(linked.soQuyetDinhKhoiTo, data.prosecutionDecision); assert.equal(linked.ngayKhoiTo.toISOString().slice(0, 10), data.prosecutionDate);
        assert.equal((await api('editorTarget', `/incidents/${record.id}/transfer`, 'PATCH', { donViMoi: 'Unit' })).status, 400);
        assert.equal(await db.case.count({ where: { linkedIncidentId: record.id } }), 1);
      }
    });
    await check('A03-PENDING-AND-TERMINAL-GUARDS', async () => {
      for (const status of ['TAM_DINH_CHI', 'KHONG_KHOI_TO', 'DA_CHUYEN_DON_VI']) {
        const record = await makeIncident('terminal-' + status, { status });
        assert.equal((await api('editorTarget', `/incidents/${record.id}/transfer`, 'PATCH', { donViMoi: 'Unit' })).status, 400);
        assert.equal((await db.incident.findUniqueOrThrow({ where: { id: record.id } })).status, status);
      }
      const pending = await makeIncident('pending', { intakeStage: 'CHO_NHAN' });
      for (const [endpoint, method, payload] of [['transfer', 'PATCH', { donViMoi: 'Unit' }], ['status', 'PATCH', { status: 'TAM_DINH_CHI', decisionNumber: 'QD', decisionDate: '2026-10-06', lyDoTamDinhChiVuViec: ['CHUA_CO_KET_QUA_GIAM_DINH'] }], ['prosecute', 'POST', { caseName: 'Case', prosecutionDecision: 'QD', prosecutionDate: '2026-10-06' }]]) {
        // A pending dossier is never writable: real scoped HTTP access rejects it before business validation.
        assert.equal((await api('editorTarget', `/incidents/${pending.id}/${endpoint}`, method, payload)).status, 403);
      }
      assert.equal(await db.incidentStatusHistory.count({ where: { incidentId: pending.id } }), 0);
    });
  } finally {
    const verdict = checks.length && checks.every(x => x.result === 'PASS') ? 'PASS' : 'FAIL';
    fs.writeFileSync(path.join(out, process.argv.includes('--migration-only') ? 'amendment-migration-regression.json' : 'amendment-http-uat.json'), JSON.stringify({ timestamp: new Date().toISOString(), target: base, verdict, cases: checks }, null, 2));
    console.log(`${verdict}: ${checks.filter(x => x.result === 'PASS').length}/${checks.length} amendment acceptance groups`);
    for (const failed of checks.filter(x => x.result === 'FAIL')) console.error(failed.id + ': ' + failed.message);
    if (verdict !== 'PASS') process.exitCode = 1;
    await sql.end(); await db.$disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
