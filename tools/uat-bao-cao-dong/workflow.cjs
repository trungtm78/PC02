/**
 * Báo cáo động end to end, through the real HTTP API, on a LOCAL stack only.
 *
 * It follows the business workflow in the order people do it: an admin sets a report up and publishes it, an officer
 * enters and submits, the manager returns it with a correction deadline, the officer corrects over several saves
 * (after the original deadline has passed), the manager approves, the summary and the status screen show the figures,
 * and then the people who type are changed, first in the configuration (periods that have not opened) and then in the
 * period that is running (the mid-period action).
 *
 *   E2E_ADMIN_USER=admin@pc02.local E2E_ADMIN_PASS=... E2E_DB=postgresql://postgres:postgres@127.0.0.1:5433/pc02_ocr_uat \
 *     node tools/uat-bao-cao-dong/workflow.cjs
 *
 * REFUSES any address that is not localhost: it writes data (a report, users, periods). It creates two officer users
 * of its own (`e2e.<run>.a`, `e2e.<run>.b`) in the database named by E2E_DB and a report with a unique code.
 * Exit code 0 = every check passed.
 */
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const BASE = process.env.E2E_BASE || 'http://localhost:3000/api/v1';
const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin@pc02.local';
const ADMIN_PASS = process.env.E2E_ADMIN_PASS;
const DB_URL = process.env.E2E_DB;
const BACKEND = path.join(__dirname, '../../backend');

function isLocal(url) {
  try {
    const h = new URL(url).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
  } catch {
    return false;
  }
}
if (!isLocal(BASE) || (DB_URL && !isLocal(DB_URL))) {
  console.error(`REFUSED: ${BASE} / ${DB_URL} is not a local address; this script writes data.`);
  process.exit(2);
}
if (!ADMIN_PASS || !DB_URL) {
  console.error('Set E2E_ADMIN_PASS and E2E_DB (see the header of this file).');
  process.exit(2);
}

const ExcelJS = require(path.join(BACKEND, 'node_modules/exceljs'));
const bcrypt = require(path.join(BACKEND, 'node_modules/bcrypt'));
const { Client } = require(path.join(BACKEND, 'node_modules/pg'));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : `\n        -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

async function http(token, method, url, body) {
  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${url}`, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

const codeOf = (r) => r.body?.error?.code ?? r.body?.code;
const messageOf = (r) => r.body?.error?.message ?? r.body?.message;

(async () => {
  const run = randomUUID().slice(0, 6);
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();

  // --- people: two officers of our own, same password as the admin (local database only)
  const hash = await bcrypt.hash(ADMIN_PASS, 10);
  const officerRole = (await pg.query(`select id from roles where name='OFFICER'`)).rows[0]?.id;
  if (!officerRole) throw new Error('no OFFICER role in this database');
  const makeUser = async (suffix) => {
    const username = `e2e.${run}.${suffix}`;
    const { rows } = await pg.query(
      `insert into users (id, username, email, "passwordHash", "roleId", "isActive", "mustChangePassword", "firstName", "lastName", "updatedAt", "twoFaSetupRequired")
       values ($1, $2, $3, $4, $5, true, false, 'E2E', $6, now(), false) returning id`,
      [randomUUID(), username, `${username}@example.invalid`, hash, officerRole, suffix.toUpperCase()],
    );
    return { id: rows[0].id, username };
  };
  const a = await makeUser('a');
  const b = await makeUser('b');

  const login = async (username) => {
    const r = await http('', 'POST', '/auth/login', { username, password: ADMIN_PASS });
    const token = r.body?.accessToken ?? r.body?.data?.accessToken;
    if (!token) throw new Error(`login ${username} -> ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    return token;
  };
  const admin = await login(ADMIN_USER);
  const tokenA = await login(a.username);
  const tokenB = await login(b.username);
  check('log in as the admin and two officers', true);
  const me = await http(admin, 'GET', '/auth/me');
  const adminId = me.body?.id ?? me.body?.data?.id;

  const teams = await http(admin, 'GET', '/teams');
  const teamList = Array.isArray(teams.body) ? teams.body : (teams.body?.data ?? []);
  const team = teamList.find((t) => t.isActive !== false && !t.wardId);
  if (!team) throw new Error('no usable team in this database');

  // --- permissions: what an officer may and may not do in the module
  const officerSetup = await http(tokenA, 'GET', '/bao-cao-dong/reports?mode=setup');
  check('an officer cannot open the setup list (needs manage:DynamicReport)', officerSetup.status === 404 || officerSetup.status === 403, officerSetup.status);
  const officerInput = await http(tokenA, 'GET', '/bao-cao-dong/submissions');
  check('an officer can open the module (read:DynamicReport): the input list answers 200', officerInput.status === 200, officerInput.status);

  // --- set up and publish
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('S');
  sheet.getCell('A1').value = 'Số vụ';
  sheet.getCell('A2').value = 'Số người';
  for (const addr of ['B1', 'B2']) sheet.getCell(addr).protection = { locked: false };
  const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());

  const firstOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
  const config = {
    code: `E2E-${run}`,
    name: `E2E ${run}`,
    selectedSheets: ['S'],
    dateSystem: '1900',
    fields: ['B1', 'B2'].map((address, i) => ({
      sheetKey: 'S', address, fieldKey: `S!${address}`, label: i === 0 ? 'Số vụ' : 'Số người', type: 'NUM', aggregate: 'SUM', source: 'WEB',
    })),
    layout: {},
    formulas: [],
    schedule: { periodType: 'MONTHLY', dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' }, openRule: { kind: 'AT_PERIOD_START' }, shiftNonWorking: false },
    roles: [{ userId: adminId, role: 'MANAGER' }],
    targets: [{ teamId: team.id, editorUserIds: [a.id] }],
    effectiveFrom: firstOfMonth,
    publish: true,
    idempotencyKey: randomUUID(),
  };
  const form = new FormData();
  form.append('config', JSON.stringify(config));
  form.append('file', new Blob([xlsx], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'mau.xlsx');
  const created = await http(admin, 'POST', '/bao-cao-dong/reports', form);
  check('the admin sets a report up and publishes it', created.status === 201 && created.body?.status === 'PUBLISHED', created.body);
  const reportId = created.body?.reportId;
  if (!reportId) throw new Error('report was not created, cannot go on');

  const setupList = await http(admin, 'GET', '/bao-cao-dong/reports?mode=setup');
  check('the setup list shows it as PUBLISHED', Array.isArray(setupList.body) && setupList.body.some((r) => r.id === reportId && r.status === 'PUBLISHED'), setupList.status);

  // --- periods exist at once (not at the next hourly tick), with the editor on the assignment
  const listA = await http(tokenA, 'GET', '/bao-cao-dong/submissions');
  const mine = (Array.isArray(listA.body) ? listA.body : []).filter((r) => r.reportId === reportId);
  check('publishing made the periods at once: the officer already sees assignments', mine.length > 0, listA.body);
  const open = mine.filter((r) => r.notYetOpen === false);
  check('the officer\'s list puts what is open first and marks the periods that have not opened', mine.length > 0 && mine.slice(0, open.length).every((r) => r.notYetOpen === false) && mine.slice(open.length).every((r) => r.notYetOpen === true), mine.map((r) => [r.periodKey, r.notYetOpen]));
  const current = open[0];
  if (!current) throw new Error('no open period to work with');
  const assignmentId = current.assignmentId;
  const periodId = current.periodId;

  const managerList = await http(admin, 'GET', '/bao-cao-dong/submissions/manager');
  check('the manager sees the same assignment', Array.isArray(managerList.body) && managerList.body.some((r) => r.assignmentId === assignmentId), managerList.status);

  // --- the officer enters and submits
  let view = (await http(tokenA, 'GET', `/bao-cao-dong/submissions/${assignmentId}`)).body;
  check('the officer can edit the open period', view?.editable === true, view?.editable);
  let saved = await http(tokenA, 'PATCH', `/bao-cao-dong/submissions/${assignmentId}/values`, { values: { 'S!B1': '12', 'S!B2': '3' }, expectedRevision: view.revision, idempotencyKey: randomUUID() });
  check('first save works and the state becomes DRAFT', saved.status === 200 && saved.body?.state === 'DRAFT', saved.body);
  const submitted = await http(tokenA, 'POST', `/bao-cao-dong/submissions/${assignmentId}/submit`, { expectedRevision: saved.body?.revision });
  check('the officer submits', submitted.status === 201 || submitted.status === 200, submitted.body);

  // --- the manager returns it AFTER the original deadline has passed (what happens in real life)
  await pg.query(`update dyn_report_periods set "dueAt" = now() - interval '1 day' where id = $1`, [periodId]);
  view = (await http(admin, 'GET', `/bao-cao-dong/submissions/${assignmentId}/review`)).body;
  const until = new Date(Date.now() + 3 * 3600_000).toISOString();
  const returned = await http(admin, 'POST', `/bao-cao-dong/submissions/${assignmentId}/return`, { expectedRevision: view.revision, reason: 'Sửa lại số liệu', returnDueAt: until });
  check('the manager returns it with a correction deadline', returned.status === 201 || returned.status === 200, returned.body);

  // --- the officer corrects over SEVERAL saves, the original deadline is long past: the correction deadline must hold
  view = (await http(tokenA, 'GET', `/bao-cao-dong/submissions/${assignmentId}`)).body;
  check('the returned report is editable although the original deadline passed', view?.editable === true, [view?.state, view?.editable]);
  const first = await http(tokenA, 'PATCH', `/bao-cao-dong/submissions/${assignmentId}/values`, { values: { 'S!B1': '7' }, expectedRevision: view.revision, idempotencyKey: randomUUID() });
  const second = await http(tokenA, 'PATCH', `/bao-cao-dong/submissions/${assignmentId}/values`, { values: { 'S!B1': '8' }, expectedRevision: first.body?.revision, idempotencyKey: randomUUID() });
  check('the second save after the first correction is accepted (used to be REPORT_LOCKED)', first.status === 200 && second.status === 200, [first.status, codeOf(first), second.status, codeOf(second)]);
  const resubmitted = await http(tokenA, 'POST', `/bao-cao-dong/submissions/${assignmentId}/submit`, { expectedRevision: second.body?.revision });
  check('and the officer can submit it again', resubmitted.status === 201 || resubmitted.status === 200, resubmitted.body);

  // --- approval, summary, status
  view = (await http(admin, 'GET', `/bao-cao-dong/submissions/${assignmentId}/review`)).body;
  const approved = await http(admin, 'POST', `/bao-cao-dong/submissions/${assignmentId}/approve`, { expectedRevision: view.revision });
  check('the manager approves', approved.status === 201 || approved.status === 200, approved.body);
  const summary = await http(admin, 'GET', `/bao-cao-dong/periods/${periodId}/summary?mode=APPROVED`);
  const field = (summary.body?.fields ?? []).find((f) => f.fieldKey === 'S!B1');
  check('the summary shows the corrected figure (8) for the approved team', field && Number(field.value) === 8, field ?? summary.body);
  const status = await http(admin, 'GET', '/bao-cao-dong/status');
  check('the status screen answers', status.status === 200, status.status);

  // --- who types: the configuration reaches periods that have not opened, the mid-period action reaches the running one
  const detail = await http(admin, 'GET', `/bao-cao-dong/reports/${reportId}`);
  const configVersion = detail.body?.configVersion;
  const patched = await http(admin, 'PATCH', `/bao-cao-dong/reports/${reportId}`, { expectedConfigVersion: configVersion, targets: [{ teamId: team.id, editorUserIds: [b.id] }] });
  check('the admin changes the editor in the configuration (a -> b)', patched.status === 200, patched.body);
  const listB = await http(tokenB, 'GET', '/bao-cao-dong/submissions');
  const rowsB = (Array.isArray(listB.body) ? listB.body : []).filter((r) => r.reportId === reportId);
  check('b sees the periods that have not opened, and not the running one (D09)', rowsB.length > 0 && rowsB.every((r) => r.notYetOpen === true) && !rowsB.some((r) => r.assignmentId === assignmentId), rowsB.map((r) => [r.periodKey, r.notYetOpen]));
  const bBefore = await http(tokenB, 'GET', `/bao-cao-dong/submissions/${assignmentId}`);
  check('b cannot open the running period yet (404)', bBefore.status === 404, bBefore.status);

  const noReason = await http(admin, 'POST', `/bao-cao-dong/periods/${periodId}/assignments/${assignmentId}/editors`, { editorUserIds: [b.id], reason: '' });
  check('the mid-period change needs a reason', noReason.status === 400, noReason.status);
  const none = await http(admin, 'POST', `/bao-cao-dong/periods/${periodId}/assignments/${assignmentId}/editors`, { editorUserIds: [], reason: 'x' });
  check('and at least one editor (EDITORS_REQUIRED)', none.status === 400 && codeOf(none) === 'EDITORS_REQUIRED', [none.status, codeOf(none)]);
  const swapped = await http(admin, 'POST', `/bao-cao-dong/periods/${periodId}/assignments/${assignmentId}/editors`, { editorUserIds: [b.id], reason: 'Cán bộ a đi công tác' });
  check('the manager changes who types in the running period (a -> b)', swapped.status === 201 || swapped.status === 200, swapped.body);
  const bAfter = await http(tokenB, 'GET', `/bao-cao-dong/submissions/${assignmentId}`);
  const aAfter = await http(tokenA, 'GET', `/bao-cao-dong/submissions/${assignmentId}`);
  check('b now opens it and a no longer does', bAfter.status === 200 && aAfter.status === 404, [bAfter.status, aAfter.status]);
  const kept = await pg.query(`select "isActive", "replaceReason" from dyn_report_assignment_editors where "assignmentId"=$1 and "userId"=$2`, [assignmentId, a.id]);
  check('a stays in the history with the reason', kept.rows[0] && kept.rows[0].isActive === false && kept.rows[0].replaceReason === 'Cán bộ a đi công tác', kept.rows);

  // --- a team added mid-period must have people to type for it
  // A second team of our own, so this step is always exercised.
  const otherTeamId = randomUUID();
  await pg.query(`insert into teams (id, code, name, "updatedAt") values ($1, $2, $3, now())`, [otherTeamId, `E2E-${run}`, `E2E tổ ${run}`]);
  const otherTeam = { id: otherTeamId };
  if (otherTeam) {
    const bare = await http(admin, 'POST', `/bao-cao-dong/periods/${periodId}/assignments/add-team`, { teamId: otherTeam.id, reason: 'Bổ sung tổ' });
    check('adding a team that has no editor is refused (EDITORS_REQUIRED), nothing created', bare.status === 400 && codeOf(bare) === 'EDITORS_REQUIRED', [bare.status, codeOf(bare), messageOf(bare)]);
    const chosen = await http(admin, 'POST', `/bao-cao-dong/periods/${periodId}/assignments/add-team`, { teamId: otherTeam.id, reason: 'Bổ sung tổ', editorUserIds: [a.id] });
    check('and with an editor chosen it works, and that editor can open it', chosen.status === 201 || chosen.status === 200, chosen.body);
    if (chosen.body?.assignmentId) {
      const opened = await http(tokenA, 'GET', `/bao-cao-dong/submissions/${chosen.body.assignmentId}`);
      check('the chosen editor opens the new team\'s assignment', opened.status === 200, opened.status);
    }
  } else {
    console.log('SKIP  adding a team mid-period (this database has only one usable team)');
  }

  await pg.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `; FAILED: ${failed.map((f) => f.name).join(' | ')}` : ''}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});
