/**
 * Báo cáo động, "criteria per team", end to end through the real HTTP API, on a LOCAL stack only.
 *
 * In the order people do it: an author picks one column of an Excel file and gets a list of criteria, publishes a
 * report for three teams (A reports three criteria, B and C report everything), the editors of each team enter and
 * submit, the manager takes one criterion away from team C in the running period, approves, closes the period, reads
 * the official file, and finally takes the team-by-criterion matrix out as Excel and puts it back. A report made the
 * old way (no criteria per team) is run next to it to show nothing changed for it.
 *
 * Every expected value is worked out here from what this script typed (the cells of the Excel file, the figures each
 * team saved), never read from one endpoint of the product and compared with another.
 *
 *   E2E_DB=postgresql://postgres:postgres@127.0.0.1:5433/pc02_dynamic_reports_test \
 *   E2E_BASE=http://127.0.0.1:3999/api/v1  node tools/uat-bao-cao-dong/criteria-workflow.cjs
 *
 * The backend must be running against that same database (`PORT=3999 DATABASE_URL=$E2E_DB npx nest start` in
 * `backend/`), with the feature flag `dynamic_reports` on.
 *
 * REFUSES any address that is not local: it writes data. It creates its own accounts (an administrator and one editor
 * per team, `uat-tc-<run>-*`), its own teams and reports, and removes all of them at the end, also when a check fails.
 * Exit code 0 = every check passed.
 */
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3999/api/v1';
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
if (!DB_URL) {
  console.error('Set E2E_DB (see the header of this file).');
  process.exit(2);
}
if (!isLocal(BASE) || !isLocal(DB_URL)) {
  console.error(`REFUSED: ${BASE} / ${DB_URL} is not a local address; this script writes data.`);
  process.exit(2);
}

const ExcelJS = require(path.join(BACKEND, 'node_modules/exceljs'));
const bcrypt = require(path.join(BACKEND, 'node_modules/bcrypt'));
const { Client } = require(path.join(BACKEND, 'node_modules/pg'));

// E2E_CLEAN_TAG=<tag>: remove what an earlier run kept (see E2E_KEEP), and do nothing else.
const CLEAN_TAG = process.env.E2E_CLEAN_TAG;
const RUN = CLEAN_TAG ? CLEAN_TAG.replace(/^uat-tc-/, '') : randomUUID().slice(0, 8);
const TAG = `uat-tc-${RUN}`;
// E2E_KEEP=1: leave the accounts, the teams and the reports in place at the end (to look at the screens with real
// data, or to take screenshots), and print the tag to clean up with later. Local addresses only, like the rest.
const KEEP = process.env.E2E_KEEP === '1';
// A password of this run only: generated, never printed, gone with the accounts. A kept run may be given one
// (E2E_PASSWORD) so that somebody can sign in to the accounts it leaves behind.
const PASSWORD = (KEEP && process.env.E2E_PASSWORD) || `Uat-${randomUUID()}!`;
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : `\n        -> ${(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 700)}`}`);
}
const note = (text) => console.log(`NOTE  ${text}`);

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
async function download(token, url) {
  const res = await fetch(`${BASE}${url}`, { headers: { Authorization: `Bearer ${token}` } });
  const buffer = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buffer };
}
const ok2xx = (r) => r.status === 200 || r.status === 201;
const codeOf = (r) => r.body?.error?.code ?? r.body?.code;
const messageOf = (r) => r.body?.error?.message ?? r.body?.message;
const sameSet = (a, b) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const xlsxPart = (buffer) => new Blob([buffer], { type: XLSX_TYPE });

/** What a cell of a workbook shows, as text ('' when it is empty). */
function shown(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && Array.isArray(v.richText)) return v.richText.map((r) => r.text ?? '').join('').trim();
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim();
  return String(v).trim();
}
/** Every non-empty cell of a sheet as { row, col, text }. */
function cellsOf(sheet) {
  const out = [];
  sheet.eachRow({ includeEmpty: false }, (row, r) => {
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const text = shown(cell);
      if (text !== '') out.push({ row: r, col: c, text });
    });
  });
  return out;
}
async function loadWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

// ── The author's Excel file: what this script knows to be true ─────────────────────────────────────────────────────
const SOURCE_SHEET = 'Danh mục';
// row of the file, the code, the criterion, the unit. "1" has children (1.1, 1.2): nobody types it.
const SOURCE_ROWS = [
  { row: 2, code: '1', name: 'Tin báo tội phạm', unit: 'tin' },
  { row: 3, code: '1.1', name: 'Tin báo mới tiếp nhận', unit: 'tin' },
  { row: 4, code: '1.2', name: 'Tin báo đã giải quyết', unit: 'tin' },
  { row: 5, code: '2', name: 'Số vụ khởi tố', unit: 'vụ' },
  { row: 6, code: '3', name: 'Số bị can', unit: 'người' },
  { row: 7, code: '4', name: 'Số vụ tạm đình chỉ', unit: 'vụ' },
];
const HEADER_NAME = 'Tên tiêu chí';
const PARENT = 'Tin báo tội phạm';
const K11 = 'Tin báo mới tiếp nhận';
const K12 = 'Tin báo đã giải quyết';
const K2 = 'Số vụ khởi tố';
const K3 = 'Số bị can';
const K4 = 'Số vụ tạm đình chỉ';
const LEAVES = [K11, K12, K2, K3, K4];
// What each team is given, and what it types. Team C starts with everything and loses K2 in the running period.
const OWNED = { A: [K11, K12, K2], B: LEAVES, C: [K11, K12, K3, K4] };
const TYPED = {
  A: { [K11]: 11, [K12]: 12, [K2]: 20 },
  B: { [K11]: 101, [K12]: 102, [K2]: 200, [K3]: 300, [K4]: 400 },
  // Saved as a draft, never submitted. 2000 is typed for K2 BEFORE K2 is taken away from the team.
  C: { [K11]: 1001, [K2]: 2000 },
};

async function sourceWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SOURCE_SHEET);
  sheet.getCell('A1').value = 'Mã';
  sheet.getCell('B1').value = HEADER_NAME;
  sheet.getCell('C1').value = 'ĐVT';
  for (const r of SOURCE_ROWS) {
    sheet.getCell(`A${r.row}`).value = r.code;
    sheet.getCell(`B${r.row}`).value = r.name;
    sheet.getCell(`C${r.row}`).value = r.unit;
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function seed(pg) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const adminRole = (await pg.query(`SELECT "id" FROM "roles" WHERE "name" = 'ADMIN'`)).rows[0]?.id;
  if (!adminRole) throw new Error('no ADMIN role in this database');
  const read = (await pg.query(`SELECT "id" FROM "permissions" WHERE "action" = 'read' AND "subject" = 'DynamicReport'`)).rows[0]?.id;
  if (!read) throw new Error('no read:DynamicReport permission in this database');
  // An editor may open the module and nothing else.
  await pg.query(`INSERT INTO "roles" ("id","name","updatedAt") VALUES ($1,$2,now())`, [`${TAG}-editor-role`, `${TAG}-EDITOR`]);
  await pg.query(`INSERT INTO "role_permissions" ("roleId","permissionId") VALUES ($1,$2)`, [`${TAG}-editor-role`, read]);
  for (const letter of ['a', 'b', 'c']) {
    await pg.query(`INSERT INTO "teams" ("id","name","code","updatedAt") VALUES ($1,$2,$1,now())`, [`${TAG}-team-${letter}`, `UAT ${RUN} Tổ ${letter.toUpperCase()}`]);
  }
  for (const [id, role] of [[`${TAG}-admin`, adminRole], [`${TAG}-ed-a`, `${TAG}-editor-role`], [`${TAG}-ed-b`, `${TAG}-editor-role`], [`${TAG}-ed-c`, `${TAG}-editor-role`]]) {
    // Throw-away accounts of a local run: no second factor to set up.
    await pg.query(
      `INSERT INTO "users" ("id","username","email","passwordHash","roleId","isActive","twoFaSetupRequired","updatedAt") VALUES ($1,$1,$2,$3,$4,true,false,now())`,
      [id, `${id}@local.test`, hash, role],
    );
  }
  for (const letter of ['a', 'b', 'c']) {
    await pg.query(`INSERT INTO "user_teams" ("userId","teamId") VALUES ($1,$2)`, [`${TAG}-ed-${letter}`, `${TAG}-team-${letter}`]);
  }
}

/** Everything is Restrict between these tables: the order is the whole job. */
async function cleanUp(pg) {
  const like = `${TAG}-%`;
  const ids = async (sql, params) => (await pg.query(sql, params)).rows.map((r) => r.id);
  const reports = await ids(`SELECT "id" FROM "dyn_reports" WHERE "code" LIKE $1 OR "createdById" LIKE $1`, [like]);
  const versions = await ids(`SELECT "id" FROM "dyn_report_versions" WHERE "reportId" = ANY($1)`, [reports]);
  const periods = await ids(`SELECT "id" FROM "dyn_report_periods" WHERE "reportId" = ANY($1)`, [reports]);
  const assignments = await ids(`SELECT "id" FROM "dyn_report_assignments" WHERE "periodId" = ANY($1)`, [periods]);
  const targets = await ids(`SELECT "id" FROM "dyn_report_targets" WHERE "reportId" = ANY($1)`, [reports]);
  const steps = [
    [`DELETE FROM "dyn_report_exports" WHERE "requestedById" LIKE $1`, [like]],
    [`DELETE FROM "dyn_report_revisions" WHERE "submissionId" IN (SELECT "id" FROM "dyn_report_submissions" WHERE "assignmentId" = ANY($1))`, [assignments]],
    [`DELETE FROM "dyn_report_unlocks" WHERE "assignmentId" = ANY($1)`, [assignments]],
    [`DELETE FROM "dyn_report_comments" WHERE "assignmentId" = ANY($1)`, [assignments]],
    [`DELETE FROM "dyn_report_reminders" WHERE "assignmentId" = ANY($1)`, [assignments]],
    [`DELETE FROM "dyn_report_submissions" WHERE "assignmentId" = ANY($1)`, [assignments]],
    [`DELETE FROM "dyn_report_assignment_editors" WHERE "assignmentId" = ANY($1)`, [assignments]],
    [`DELETE FROM "dyn_report_assignment_scope_changes" WHERE "assignmentId" = ANY($1)`, [assignments]],
    [`DELETE FROM "dyn_report_assignments" WHERE "id" = ANY($1)`, [assignments]],
    [`DELETE FROM "dyn_report_snapshots" WHERE "periodId" = ANY($1)`, [periods]],
    [`DELETE FROM "dyn_report_official_files" WHERE "periodId" = ANY($1)`, [periods]],
    [`DELETE FROM "dyn_report_periods" WHERE "id" = ANY($1)`, [periods]],
    [`DELETE FROM "dyn_report_target_editors" WHERE "targetId" = ANY($1)`, [targets]],
    [`DELETE FROM "dyn_report_targets" WHERE "id" = ANY($1)`, [targets]],
    [`DELETE FROM "dyn_report_roles" WHERE "reportId" = ANY($1)`, [reports]],
    [`DELETE FROM "dyn_report_schedules" WHERE "reportId" = ANY($1)`, [reports]],
    [`DELETE FROM "dyn_report_fields" WHERE "versionId" = ANY($1)`, [versions]],
    [`DELETE FROM "dyn_report_validation_rules" WHERE "versionId" = ANY($1)`, [versions]],
    [`DELETE FROM "dyn_report_version_grids" WHERE "versionId" = ANY($1)`, [versions]],
    [`DELETE FROM "dyn_report_versions" WHERE "id" = ANY($1)`, [versions]],
    [`DELETE FROM "dyn_reports" WHERE "id" = ANY($1)`, [reports]],
    [`DELETE FROM "dyn_report_idempotency_records" WHERE "actorId" LIKE $1`, [like]],
    [`DELETE FROM "audit_logs" WHERE "userId" LIKE $1`, [like]],
    [`DELETE FROM "notifications" WHERE "userId" LIKE $1`, [like]],
    [`DELETE FROM "user_teams" WHERE "userId" LIKE $1 OR "teamId" LIKE $1`, [like]],
    [`DELETE FROM "users" WHERE "id" LIKE $1`, [like]],
    [`DELETE FROM "role_permissions" WHERE "roleId" LIKE $1`, [like]],
    [`DELETE FROM "roles" WHERE "id" LIKE $1`, [like]],
    [`DELETE FROM "teams" WHERE "id" LIKE $1`, [like]],
  ];
  for (const [sql, params] of steps) {
    try {
      await pg.query(sql, params);
    } catch (err) {
      console.error(`CLEAN-UP step failed: ${sql.slice(0, 70)}... -> ${err.message}`);
    }
  }
}

const SCHEDULE = { periodType: 'MONTHLY', dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' }, openRule: { kind: 'AT_PERIOD_START' }, shiftNonWorking: false };
const firstOfMonth = () => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);

async function workflow(pg) {
  const login = async (username) => {
    const r = await http('', 'POST', '/auth/login', { username, password: PASSWORD });
    return r.body?.accessToken ?? r.body?.data?.accessToken ?? '';
  };
  const admin = await login(`${TAG}-admin`);
  const token = { A: await login(`${TAG}-ed-a`), B: await login(`${TAG}-ed-b`), C: await login(`${TAG}-ed-c`) };
  check('an administrator and one editor per team log in', admin && token.A && token.B && token.C, [!!admin, !!token.A, !!token.B, !!token.C]);
  if (!admin || !token.A || !token.B || !token.C) return;
  const teamId = { A: `${TAG}-team-a`, B: `${TAG}-team-b`, C: `${TAG}-team-c` };
  const teamName = { A: `UAT ${RUN} Tổ A`, B: `UAT ${RUN} Tổ B`, C: `UAT ${RUN} Tổ C` };
  const editorId = { A: `${TAG}-ed-a`, B: `${TAG}-ed-b`, C: `${TAG}-ed-c` };
  const TEAMS = ['A', 'B', 'C'];

  // ── 1. criteria come from one column of an Excel file ───────────────────────────────────────────────────────
  const source = await sourceWorkbook();
  const extract = async (selection) => {
    const form = new FormData();
    form.append('file', xlsxPart(source), 'danh-muc.xlsx');
    for (const [key, value] of Object.entries(selection)) form.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    return http(admin, 'POST', '/bao-cao-dong/templates/criteria/extract', form);
  };
  // The request says only WHERE the author picked: a sheet, a column, the rows. No text travels.
  const picked = await extract({ sheet: SOURCE_SHEET, column: 'B', rows: SOURCE_ROWS.map((r) => r.row), codeColumn: 'A', unitColumn: 'C', hierarchy: 'NUMBERING' });
  const criteria = Array.isArray(picked.body?.criteria) ? picked.body.criteria : [];
  check(
    'picking cells of ONE column gives one criterion per text cell, in the order of the rows, with the text that is in the file (the request carries no text, only where was picked)',
    ok2xx(picked) && sameList(criteria.map((c) => c.name), SOURCE_ROWS.map((r) => r.name)),
    [picked.status, picked.body],
  );
  check('the code column and the unit column are read for each criterion', sameList(criteria.map((c) => `${c.code}|${c.unit}`), SOURCE_ROWS.map((r) => `${r.code}|${r.unit}`)), criteria.map((c) => [c.code, c.unit]));
  const nameOfKey = new Map(criteria.map((c) => [c.itemKey, c.name]));
  const parentName = (name) => nameOfKey.get(criteria.find((c) => c.name === name)?.parentItemKey) ?? null;
  check(
    'numbering 1 / 1.1 / 1.2 makes 1.1 and 1.2 children of 1; 2, 3 and 4 have no parent',
    parentName(K11) === PARENT && parentName(K12) === PARENT && [PARENT, K2, K3, K4].every((n) => parentName(n) === null),
    criteria.map((c) => [c.code, c.parentItemKey]),
  );
  const some = await extract({ sheet: SOURCE_SHEET, column: 'B', rows: [6, 5] });
  check('picking only two cells of the column gives exactly those two criteria, in row order', ok2xx(some) && sameList((some.body?.criteria ?? []).map((c) => c.name), [K2, K3]), [some.status, some.body]);
  const whole = await extract({ sheet: SOURCE_SHEET, column: 'B' });
  check(
    'picking the whole column gives every text cell of it as a criterion, top to bottom',
    ok2xx(whole) && sameList((whole.body?.criteria ?? []).map((c) => c.name), [HEADER_NAME, ...SOURCE_ROWS.map((r) => r.name)]),
    [whole.status, whole.body],
  );
  if (criteria.length !== SOURCE_ROWS.length) throw new Error('the criteria were not read, cannot go on');

  // ── the list becomes a workbook, the workbook a report (what the wizard does) ───────────────────────────────
  const drafts = criteria.map((c) => ({
    itemKey: c.itemKey,
    ...(c.code ? { code: c.code } : {}),
    name: c.name,
    ...(c.unit ? { unit: c.unit } : {}),
    ...(c.parentItemKey ? { parentItemKey: c.parentItemKey } : {}),
    origin: c.origin,
    ...(c.sourceRow != null ? { sourceRow: c.sourceRow } : {}),
  }));
  const built = await http(admin, 'POST', '/bao-cao-dong/templates/criteria/workbook', { criteria: drafts });
  const refs = Array.isArray(built.body?.fields) ? built.body.fields : [];
  check(
    'the report gets one input cell per criterion that has no children (five); the parent "1" is not typed',
    ok2xx(built) && sameSet(refs.map((f) => nameOfKey.get(f.itemKey)), LEAVES),
    [built.status, refs.map((f) => f.itemKey)],
  );
  if (!ok2xx(built) || !built.body?.fileBase64) throw new Error('the criteria workbook was not built, cannot go on');
  const generated = Buffer.from(built.body.fileBase64, 'base64');
  const sheetName = built.body.sheetName;
  const previewForm = new FormData();
  previewForm.append('file', xlsxPart(generated), built.body.fileName || 'chi-tieu.xlsx');
  previewForm.append('selectedSheets', JSON.stringify([sheetName]));
  const preview = await http(admin, 'POST', '/bao-cao-dong/templates/preview', previewForm);
  if (!ok2xx(preview) || !Array.isArray(preview.body?.fields)) throw new Error(`the generated workbook was not accepted: ${preview.status} ${JSON.stringify(preview.body).slice(0, 300)}`);

  const refOfFieldKey = new Map(refs.map((f) => [f.fieldKey, f]));
  const codeOfKey = new Map(criteria.map((c) => [c.itemKey, c.code]));
  // Every criterion is marked required: the "required" checks further down depend on it.
  const fieldsOf = (labelOf) =>
    preview.body.fields.map((f) => {
      const ref = refOfFieldKey.get(f.fieldKey);
      if (!ref) return { ...f, required: true };
      const code = ref.code ?? codeOfKey.get(ref.itemKey);
      return {
        ...f,
        label: labelOf ? labelOf(f) : f.label,
        required: true,
        itemKey: ref.itemKey,
        ...(code ? { criterionCode: code } : {}),
        ...(ref.unit ? { unit: ref.unit } : {}),
        ...(ref.parentItemKey ? { parentItemKey: ref.parentItemKey } : {}),
        origin: ref.origin,
      };
    });
  const parents = new Set(criteria.map((c) => c.parentItemKey).filter(Boolean));
  const criteriaGroups = criteria
    .filter((c) => parents.has(c.itemKey))
    .map((c) => ({ itemKey: c.itemKey, ...(c.code ? { code: c.code } : {}), name: c.name, ...(c.parentItemKey ? { parentItemKey: c.parentItemKey } : {}) }));
  const itemKey = Object.fromEntries(criteria.map((c) => [c.name, c.itemKey]));
  const fieldKey = Object.fromEntries(refs.map((f) => [nameOfKey.get(f.itemKey), f.fieldKey]));
  const nameOfFieldKey = new Map(Object.entries(fieldKey).map(([name, key]) => [key, name]));
  const me = await http(admin, 'GET', '/auth/me');
  const adminId = me.body?.id ?? me.body?.data?.id ?? `${TAG}-admin`;

  const publish = async (config, file, fileName) => {
    const form = new FormData();
    form.append('config', JSON.stringify(config));
    form.append('file', xlsxPart(file), fileName);
    return http(admin, 'POST', '/bao-cao-dong/reports', form);
  };
  const criteriaConfig = (suffix, targets, labelOf) => ({
    code: `${TAG}-${suffix}`,
    name: `UAT ${RUN} ${suffix}`,
    selectedSheets: [sheetName],
    sourceKind: 'CRITERIA',
    ...(criteriaGroups.length ? { criteriaGroups } : {}),
    dateSystem: '1900',
    fields: fieldsOf(labelOf),
    layout: preview.body.layout ?? {},
    formulas: preview.body.formulas ?? [],
    schedule: SCHEDULE,
    roles: [{ userId: adminId, role: 'MANAGER' }],
    targets,
    effectiveFrom: firstOfMonth(),
    publish: true,
    idempotencyKey: randomUUID(),
  });
  // Team A is given three criteria. Teams B and C are only SELECTED: nothing is said about their criteria.
  const created = await publish(
    criteriaConfig('TC', [
      { teamId: teamId.A, editorUserIds: [editorId.A], itemKeys: OWNED.A.map((n) => itemKey[n]) },
      { teamId: teamId.B, editorUserIds: [editorId.B] },
      { teamId: teamId.C, editorUserIds: [editorId.C] },
    ]),
    generated,
    'chi-tieu.xlsx',
  );
  check('the report made from the picked criteria is published for three teams', created.status === 201 && created.body?.status === 'PUBLISHED', created.body);
  const reportId = created.body?.reportId;
  if (!reportId) throw new Error('the report was not created, cannot go on');

  const targetsOf = async () => {
    const detail = await http(admin, 'GET', `/bao-cao-dong/reports/${reportId}`);
    const byTeam = {};
    for (const t of TEAMS) {
      const target = (detail.body?.targets ?? []).find((x) => x.teamId === teamId[t]);
      // null = every criterion; else the names of the criteria the keys stand for.
      byTeam[t] = !target ? undefined : target.itemKeys === null ? null : target.itemKeys.map((k) => nameOfKey.get(k) ?? k);
    }
    return { configVersion: detail.body?.configVersion, byTeam };
  };
  const isAll = (names) => names === null || (Array.isArray(names) && sameSet(names, LEAVES));
  let config = await targetsOf();
  check(
    'a team that is only selected reports ALL the criteria by default (B, C); the team given three has exactly those three (A)',
    isAll(config.byTeam.B) && isAll(config.byTeam.C) && Array.isArray(config.byTeam.A) && sameSet(config.byTeam.A, OWNED.A),
    config.byTeam,
  );

  // ── the running period ──────────────────────────────────────────────────────────────────────────────────────
  const assignmentOf = async (team, report) => {
    const list = await http(token[team], 'GET', '/bao-cao-dong/submissions');
    return (Array.isArray(list.body) ? list.body : []).find((r) => r.reportId === report && r.notYetOpen === false);
  };
  const mine = { A: await assignmentOf('A', reportId), B: await assignmentOf('B', reportId), C: await assignmentOf('C', reportId) };
  check('publishing opened the current period for the editor of each team', mine.A && mine.B && mine.C && mine.A.periodId === mine.B.periodId && mine.B.periodId === mine.C.periodId, mine);
  if (!mine.A || !mine.B || !mine.C) throw new Error('no open period for every team, cannot go on');
  const periodId = mine.A.periodId;
  const asg = { A: mine.A.assignmentId, B: mine.B.assignmentId, C: mine.C.assignmentId };

  const viewOf = async (team) => (await http(token[team], 'GET', `/bao-cao-dong/submissions/${asg[team]}`)).body;
  const labelsOf = (view) => (view?.fields ?? []).map((f) => nameOfFieldKey.get(f.fieldKey) ?? f.fieldKey);
  const stored = async (team) => (await pg.query(`SELECT "values", "currentRevision"::text AS revision, "state" FROM "dyn_report_submissions" WHERE "assignmentId" = $1`, [asg[team]])).rows[0];
  const storedValue = async (team, name) => (await stored(team))?.values?.[fieldKey[name]]?.v ?? null;
  const save = async (team, values) => {
    const view = await viewOf(team);
    return http(token[team], 'PATCH', `/bao-cao-dong/submissions/${asg[team]}/values`, {
      values: Object.fromEntries(Object.entries(values).map(([name, v]) => [fieldKey[name], String(v)])),
      expectedRevision: view.revision,
      idempotencyKey: randomUUID(),
    });
  };
  const submit = async (team) => http(token[team], 'POST', `/bao-cao-dong/submissions/${asg[team]}/submit`, { expectedRevision: (await viewOf(team)).revision });
  const gridOf = async (team) => {
    const versionId = (await viewOf(team))?.versionId;
    // As the entry screen asks for it: the sheet of the assignment that is open.
    const grid = await http(token[team], 'GET', `/bao-cao-dong/versions/${versionId}/grid?assignmentId=${encodeURIComponent(asg[team])}`);
    return { status: grid.status, text: JSON.stringify(grid.body) };
  };

  let views = { A: await viewOf('A'), B: await viewOf('B'), C: await viewOf('C') };
  check('ENTRY: the editor of team B is given all five criteria to fill', sameSet(labelsOf(views.B), LEAVES), labelsOf(views.B));
  check('ENTRY: the editor of team C (selected, nothing removed yet) is given all five criteria to fill', sameSet(labelsOf(views.C), LEAVES), labelsOf(views.C));
  check('ENTRY: the editor of team A is given its three criteria and no other', sameSet(labelsOf(views.A), OWNED.A), labelsOf(views.A));

  const gridB = await gridOf('B');
  const gridA = await gridOf('A');
  check('ENTRY: the sheet sent to team B shows all five criteria', gridB.status === 200 && LEAVES.every((n) => gridB.text.includes(n)), [gridB.status, LEAVES.filter((n) => !gridB.text.includes(n))]);
  check(
    'ENTRY: the sheet sent to team A contains its three criteria and does NOT contain the two it was not given (absent from the data, not hidden)',
    gridA.status === 200 && OWNED.A.every((n) => gridA.text.includes(n)) && !gridA.text.includes(K3) && !gridA.text.includes(K4),
    [gridA.status, LEAVES.filter((n) => gridA.text.includes(n))],
  );

  // ── saving a criterion the team was not given ───────────────────────────────────────────────────────────────
  const beforeA = await stored('A');
  const foreign = await save('A', { [K3]: 5 });
  check('SAVE: team A saving a value for a criterion it was not given is refused with FIELD_NOT_ASSIGNED', foreign.status === 400 && codeOf(foreign) === 'FIELD_NOT_ASSIGNED', [foreign.status, foreign.body]);
  const mixed = await save('A', { [K11]: 11, [K3]: 5 });
  const afterA = await stored('A');
  check(
    'SAVE: a save that mixes an own criterion with one not given is refused whole with FIELD_NOT_ASSIGNED and nothing is written (no value, same revision)',
    mixed.status === 400 && codeOf(mixed) === 'FIELD_NOT_ASSIGNED' && afterA.revision === beforeA.revision && Object.keys(afterA.values ?? {}).length === 0,
    [mixed.status, codeOf(mixed), beforeA.revision, afterA],
  );

  // ── required: only the team's own criteria count ────────────────────────────────────────────────────────────
  const partA = await save('A', { [K11]: TYPED.A[K11], [K12]: TYPED.A[K12] });
  check('team A saves two of its three criteria', partA.status === 200 && partA.body?.state === 'DRAFT', partA.body);
  const early = await submit('A');
  check('REQUIRED: team A cannot submit while one of ITS OWN required criteria is empty', early.status === 400 && (await stored('A')).state === 'DRAFT', [early.status, early.body]);
  const restA = await save('A', { [K2]: TYPED.A[K2] });
  const submittedA = await submit('A');
  check(
    'REQUIRED: team A submits once its three criteria are filled, although two other required criteria of the report (not given to A) hold nothing',
    restA.status === 200 && ok2xx(submittedA) && (await stored('A')).state === 'SUBMITTED',
    [restA.status, submittedA.status, submittedA.body],
  );
  const savedB = await save('B', TYPED.B);
  const submittedB = await submit('B');
  check('team B fills all five criteria and submits', savedB.status === 200 && ok2xx(submittedB), [savedB.body, submittedB.body]);

  // ── a criterion is taken away from team C in the running period ─────────────────────────────────────────────
  const savedC = await save('C', TYPED.C);
  check('team C, which still has every criterion, saves a draft with a figure for criterion 2', savedC.status === 200 && (await storedValue('C', K2)) === String(TYPED.C[K2]), savedC.body);
  // Notes are written on team C's submission while it still has criterion 2: two on criterion 2 (the manager's quotes
  // the figure, the editor answers), one on a criterion the team keeps, one on the submission as a whole.
  const commentsUrl = `/bao-cao-dong/submissions/${asg.C}/comments`;
  const NOTES = {
    managerOn2: `Số ${TYPED.C[K2]} ở chỉ tiêu 2 có đúng không? (${RUN})`,
    editorOn2: `Đúng, ${TYPED.C[K2]} vụ theo sổ thụ lý (${RUN})`,
    managerOn11: `Chỉ tiêu 1.1 đã đối chiếu (${RUN})`,
    managerOnAll: `Nộp trước ngày 5 (${RUN})`,
  };
  const noted = [
    await http(admin, 'POST', commentsUrl, { fieldKey: fieldKey[K2], body: NOTES.managerOn2 }),
    await http(token.C, 'POST', commentsUrl, { fieldKey: fieldKey[K2], body: NOTES.editorOn2 }),
    await http(admin, 'POST', commentsUrl, { fieldKey: fieldKey[K11], body: NOTES.managerOn11 }),
    await http(admin, 'POST', commentsUrl, { body: NOTES.managerOnAll }),
  ];
  const notesSeenBy = async (who) => {
    const list = await http(who, 'GET', commentsUrl);
    return Array.isArray(list.body) ? list.body.map((c) => c.body) : [`status ${list.status}`];
  };
  check(
    'NOTES: while team C still has criterion 2, its editor reads all four notes on its submission',
    noted.every(ok2xx) && sameSet(await notesSeenBy(token.C), Object.values(NOTES)),
    [noted.map((r) => r.status), await notesSeenBy(token.C)],
  );
  const setCriteria = (team, names, reason) =>
    http(admin, 'POST', `/bao-cao-dong/periods/${periodId}/assignments/${asg[team]}/criteria`, { itemKeys: names.map((n) => itemKey[n]), ...(reason === undefined ? {} : { reason }) });
  const blankReason = await setCriteria('C', OWNED.C, '');
  const noReason = await setCriteria('C', OWNED.C, undefined);
  check(
    'RUNNING PERIOD: taking a criterion away from a team without a reason is refused, and the team still has all five',
    blankReason.status === 400 && noReason.status === 400 && sameSet(labelsOf(await viewOf('C')), LEAVES),
    [blankReason.status, noReason.status, labelsOf(await viewOf('C'))],
  );
  const REASON = `Tổ C không thụ lý án (${RUN})`;
  const removed = await setCriteria('C', OWNED.C, REASON);
  check('RUNNING PERIOD: with a reason the manager takes criterion 2 away from team C', ok2xx(removed) && removed.body?.changed === true, [removed.status, removed.body]);
  const reasons = (await pg.query(`SELECT "reason" FROM "dyn_report_assignment_scope_changes" WHERE "assignmentId" = $1`, [asg.C])).rows.map((r) => r.reason);
  check('RUNNING PERIOD: the reason is kept with the change', sameList(reasons, [REASON]), reasons);

  views = { A: await viewOf('A'), B: await viewOf('B'), C: await viewOf('C') };
  check('PER TEAM: after the removal team C is given its four criteria, criterion 2 is not among them', sameSet(labelsOf(views.C), OWNED.C), labelsOf(views.C));
  check('PER TEAM: the other teams are unaffected (B still all five, A still its three)', sameSet(labelsOf(views.B), LEAVES) && sameSet(labelsOf(views.A), OWNED.A), [labelsOf(views.B), labelsOf(views.A)]);
  check(
    'ENTRY: the values sent to team C no longer contain the figure typed for the criterion taken away (and still contain its own)',
    views.C?.values?.[fieldKey[K2]] === undefined && !JSON.stringify(views.C?.values ?? {}).includes(String(TYPED.C[K2])) && views.C?.values?.[fieldKey[K11]]?.v === String(TYPED.C[K11]),
    views.C?.values,
  );
  const gridC = await gridOf('C');
  check(
    'ENTRY: the sheet sent to team C contains its four criteria and does NOT contain criterion 2',
    gridC.status === 200 && OWNED.C.every((n) => gridC.text.includes(n)) && !gridC.text.includes(K2),
    [gridC.status, LEAVES.filter((n) => gridC.text.includes(n))],
  );
  if (gridC.text.includes(K2)) {
    // Said only when the check above fails, to place the finding: the sheet is asked for by VERSION, not by period.
    const elsewhere = await pg.query(
      `SELECT count(*)::int AS n FROM "dyn_report_assignments" a JOIN "dyn_report_periods" p ON p."id" = a."periodId"
       WHERE a."teamId" = $1 AND p."reportId" = $2 AND a."id" <> $3 AND a."ownedFieldKeys" IS NULL`,
      [teamId.C, reportId, asg.C],
    );
    note(`team C has ${elsewhere.rows[0].n} other assignment(s) of this report (periods not open yet) where it still has every criterion`);
  }
  const notesOfEditor = await notesSeenBy(token.C);
  check(
    'NOTES: after criterion 2 was taken away, the editor of team C is no longer sent the notes on criterion 2 (neither the manager\'s, which quotes the figure, nor their own); the note on a criterion it keeps and the note on the whole submission stay',
    sameSet(notesOfEditor, [NOTES.managerOn11, NOTES.managerOnAll]) && !JSON.stringify(notesOfEditor).includes(String(TYPED.C[K2])),
    notesOfEditor,
  );
  const notesOfManager = await notesSeenBy(admin);
  check('NOTES: the manager of the report still reads all four notes', sameSet(notesOfManager, Object.values(NOTES)), notesOfManager);
  check(
    'GROUP: a team that has at least one criterion of a group keeps the group\'s row in its sheet (A and C have 1.1 and 1.2, so "1 Tin báo tội phạm" is there)',
    gridA.text.includes(PARENT) && gridC.text.includes(PARENT),
    [gridA.text.includes(PARENT), gridC.text.includes(PARENT)],
  );
  const textsOfExport = async (who, assignmentId) => {
    const file = await download(who, `/bao-cao-dong/submissions/${assignmentId}/export`);
    return { status: file.status, texts: file.status === 200 ? (await loadWorkbook(file.buffer)).worksheets.flatMap((s) => cellsOf(s).map((c) => c.text)) : [] };
  };
  const ownTexts = (team) => textsOfExport(token[team], asg[team]);
  const ownC = await ownTexts('C');
  check(
    'ENTRY: the Excel file team C takes of its own figures holds its own figure and not the figure typed for the criterion taken away',
    ownC.status === 200 && ownC.texts.includes(String(TYPED.C[K11])) && !ownC.texts.includes(String(TYPED.C[K2])),
    [ownC.status, ownC.texts],
  );
  check(
    'ENTRY: the Excel file team C takes of its own figures lists its four criteria only (criterion 2 is not in it)',
    ownC.status === 200 && sameSet(LEAVES.filter((n) => ownC.texts.includes(n)), OWNED.C),
    [ownC.status, LEAVES.filter((n) => ownC.texts.includes(n))],
  );
  const ownA = await ownTexts('A');
  check(
    'ENTRY: the Excel file team A takes of its own figures lists its three criteria only (the two it was never given are not in it)',
    ownA.status === 200 && sameSet(LEAVES.filter((n) => ownA.texts.includes(n)), OWNED.A),
    [ownA.status, LEAVES.filter((n) => ownA.texts.includes(n))],
  );
  const beforeC = await stored('C');
  const lateC = await save('C', { [K2]: 7 });
  const afterC = await stored('C');
  check(
    'SAVE: team C saving criterion 2 after it was taken away is refused with FIELD_NOT_ASSIGNED and nothing is written',
    lateC.status === 400 && codeOf(lateC) === 'FIELD_NOT_ASSIGNED' && afterC.revision === beforeC.revision && afterC.values?.[fieldKey[K2]]?.v === String(TYPED.C[K2]),
    [lateC.status, codeOf(lateC), beforeC.revision, afterC.revision, afterC.values?.[fieldKey[K2]]],
  );

  // ── aggregation: who is in a criterion's total ──────────────────────────────────────────────────────────────
  const sumOf = (name, teams) => teams.filter((t) => OWNED[t].includes(name)).reduce((sum, t) => sum + (TYPED[t][name] ?? 0), 0);
  const summaryField = async (mode, name) => {
    const summary = await http(admin, 'GET', `/bao-cao-dong/periods/${periodId}/summary?mode=${mode}`);
    return (summary.body?.fields ?? []).find((f) => f.fieldKey === fieldKey[name]) ?? { missing: summary.status };
  };
  const teamsIn = (field) => (field.contributors ?? []).map((c) => c.teamName);
  // "Everything saved": A and B submitted, C has a draft. C's 2000 for criterion 2 is still stored, and must not count.
  const all2 = await summaryField('ALL_SAVED', K2);
  check(
    `TOTAL: criterion 2 adds up the two teams that have it (${TYPED.A[K2]} + ${TYPED.B[K2]} = ${sumOf(K2, TEAMS)}); team C, which no longer has it, is not counted although a figure of its own is still stored`,
    Number(all2.value) === sumOf(K2, TEAMS) && all2.countTotal === 2 && sameSet(teamsIn(all2), [teamName.A, teamName.B]),
    all2,
  );
  const all3 = await summaryField('ALL_SAVED', K3);
  check(
    'TOTAL: criterion 3 counts teams B and C only; team A, which was not given it, is not counted at all, not even as a zero',
    Number(all3.value) === sumOf(K3, TEAMS) && all3.countTotal === 2 && sameSet(teamsIn(all3), [teamName.B, teamName.C]),
    all3,
  );
  const all11 = await summaryField('ALL_SAVED', K11);
  check(
    `TOTAL: criterion 1.1, which all three teams have, adds up all three (${TYPED.A[K11]} + ${TYPED.B[K11]} + ${TYPED.C[K11]} = ${sumOf(K11, TEAMS)})`,
    Number(all11.value) === sumOf(K11, TEAMS) && all11.countTotal === 3,
    all11,
  );
  const sub11 = await summaryField('SUBMITTED', K11);
  check(`TOTAL: counting submitted teams only, criterion 1.1 is ${sumOf(K11, ['A', 'B'])} (A and B; C has not submitted)`, Number(sub11.value) === sumOf(K11, ['A', 'B']) && sub11.countTotal === 2, sub11);

  // ── approve, close the period ───────────────────────────────────────────────────────────────────────────────
  for (const team of ['A', 'B']) {
    const review = await http(admin, 'GET', `/bao-cao-dong/submissions/${asg[team]}/review`);
    const approved = await http(admin, 'POST', `/bao-cao-dong/submissions/${asg[team]}/approve`, { expectedRevision: review.body?.revision });
    check(`the manager approves team ${team}`, ok2xx(approved), approved.body);
  }
  const filesWhileOpen = await http(admin, 'GET', `/bao-cao-dong/periods/${periodId}/official-files`);
  check('OFFICIAL FILE: there is none while the period is open', filesWhileOpen.status === 200 && Array.isArray(filesWhileOpen.body) && filesWhileOpen.body.length === 0, [filesWhileOpen.status, filesWhileOpen.body]);
  const ask = await http(admin, 'POST', `/bao-cao-dong/periods/${periodId}/finalize`, {});
  check('closing the period with team C still outstanding first asks the manager to confirm, naming team C', !ok2xx(ask) && String(messageOf(ask) ?? '').includes(teamName.C), [ask.status, ask.body]);
  const closed = await http(admin, 'POST', `/bao-cao-dong/periods/${periodId}/finalize`, { acknowledgedBasis: messageOf(ask) });
  check('the manager confirms and the period is locked', ok2xx(closed) && closed.body?.status === 'FINALIZED', [closed.status, closed.body]);
  const afterLock = await setCriteria('C', LEAVES, 'sau khi khoá');
  check('a locked period no longer lets a team\'s criteria be changed', afterLock.status >= 400 && afterLock.status < 500 && sameSet(labelsOf(await viewOf('C')), OWNED.C), [afterLock.status, afterLock.body]);

  // The file is made by itself right after the lock: wait for it, do not ask for it.
  let official = null;
  for (let i = 0; i < 40 && !official; i += 1) {
    const list = await http(admin, 'GET', `/bao-cao-dong/periods/${periodId}/official-files`);
    official = (Array.isArray(list.body) ? list.body : []).find((f) => f.status === 'READY') ?? null;
    if (!official) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  check('OFFICIAL FILE: once the period is locked the file exists by itself, nobody has to ask for it', !!official, official);
  if (official) await officialFileChecks(official);

  async function officialFileChecks(file) {
    const got = await download(admin, `/bao-cao-dong/official-files/${file.id}/download`);
    check('OFFICIAL FILE: it can be downloaded', got.status === 200 && got.buffer.length > 0, got.status);
    if (got.status !== 200) return;
    const workbook = await loadWorkbook(got.buffer);
    const first = workbook.worksheets[0];
    check('OFFICIAL FILE: its first sheet is "Tổng hợp"', first?.name === 'Tổng hợp', workbook.worksheets.map((s) => s.name));
    const cells = cellsOf(first);
    const at = (row, col) => cells.find((c) => c.row === row && c.col === col)?.text ?? '';
    const headerRow = cells.find((c) => c.text === teamName.A)?.row;
    const col = Object.fromEntries(TEAMS.map((t) => [t, cells.find((c) => c.row === headerRow && c.text === teamName[t])?.col]));
    const rowOf = Object.fromEntries(LEAVES.map((n) => [n, cells.find((c) => c.row > (headerRow ?? 0) && c.text === n)?.row]));
    check('OFFICIAL FILE: "Tổng hợp" has one column per team and one row per criterion (five rows, no other)', headerRow && TEAMS.every((t) => col[t]) && LEAVES.every((n) => rowOf[n]) && new Set(cells.filter((c) => c.row > headerRow).map((c) => c.row)).size === LEAVES.length, { headerRow, col, rowOf });
    if (!headerRow || !TEAMS.every((t) => col[t]) || !LEAVES.every((n) => rowOf[n])) return;
    // The order the owner asked for: total, received/required, %, then the teams.
    const firstTeamCol = Math.min(...TEAMS.map((t) => col[t]));
    const [totalCol, ratioCol, percentCol] = [firstTeamCol - 3, firstTeamCol - 2, firstTeamCol - 1];
    // Official figures are the approved teams': A and B. C was given the criterion but did not submit.
    const APPROVED = ['A', 'B'];
    const expected = LEAVES.map((name) => {
      const owing = TEAMS.filter((t) => OWNED[t].includes(name));
      const received = owing.filter((t) => APPROVED.includes(t));
      return { name, total: sumOf(name, APPROVED), received: received.length, required: owing.length, percent: Math.round((received.length / owing.length) * 100) };
    });
    const percentOf = (text) => (text.includes('%') ? Math.round(parseFloat(text)) : Math.round(Number(text) * 100));
    const actual = expected.map((e) => {
      const ratio = /^(\d+)\s*\/\s*(\d+)$/.exec(at(rowOf[e.name], ratioCol));
      return { name: e.name, total: Number(at(rowOf[e.name], totalCol)), received: ratio ? Number(ratio[1]) : null, required: ratio ? Number(ratio[2]) : null, percent: percentOf(at(rowOf[e.name], percentCol)) };
    });
    check('OFFICIAL FILE: each criterion\'s total is the sum of the approved teams that have it (112, 114, 220, 300, 400)', expected.every((e, i) => actual[i].total === e.total), actual);
    check(
      'COMPLETENESS: "required to submit" counts only the teams given the criterion (3, 3, 2, 2, 2), and "received" those of them that delivered (2, 2, 2, 1, 1)',
      expected.every((e, i) => actual[i].received === e.received && actual[i].required === e.required),
      actual,
    );
    const three = actual.find((a) => a.name === K3);
    check('COMPLETENESS: criterion 3 is given to two teams and one delivered: 1/2 = 50%', three.received === 1 && three.required === 2 && three.percent === 50, three);
    check('COMPLETENESS: the percentage of every criterion is received / required (67%, 67%, 100%, 50%, 50%)', expected.every((e, i) => actual[i].percent === e.percent), actual);
    const teamCell = (team, name) => at(rowOf[name], col[team]);
    const valuesShown = APPROVED.flatMap((t) => OWNED[t].map((n) => [t, n, teamCell(t, n), String(TYPED[t][n])]));
    check('OFFICIAL FILE: under each approved team stands the value it reported for each of its criteria', valuesShown.every(([, , shownValue, typed]) => shownValue === typed), valuesShown);
    const dashes = TEAMS.flatMap((t) => LEAVES.filter((n) => !OWNED[t].includes(n)).map((n) => [t, n, teamCell(t, n)]));
    check('OFFICIAL FILE: a criterion a team was not given shows "—" under that team (A: 3 and 4; C: 2)', dashes.length === 3 && dashes.every(([, , text]) => text === '—'), dashes);
    const missing = OWNED.C.map((n) => [n, teamCell('C', n)]);
    const isMark = (text) => text !== '' && text !== '—' && !/^-?\d+([.,]\d+)?$/.test(text);
    check('OFFICIAL FILE: a criterion team C was given but did not submit carries a "missing" mark under team C (not a number, not "—", not blank)', missing.every(([, text]) => isMark(text)), missing);
    note(`the mark the official file writes for "given but not submitted" is: ${JSON.stringify([...new Set(missing.map(([, text]) => text))])}`);

    const teamSheets = workbook.worksheets.slice(1);
    check('OFFICIAL FILE: after "Tổng hợp" there is one sheet per team (three)', teamSheets.length === 3 && TEAMS.every((t) => teamSheets.some((s) => s.name === teamName[t])), teamSheets.map((s) => s.name));
    const textsOf = (team) => cellsOf(teamSheets.find((s) => s.name === teamName[team]) ?? { eachRow() {} }).map((c) => c.text);
    const perTeam = TEAMS.map((t) => ({ team: t, criteria: LEAVES.filter((n) => textsOf(t).includes(n)) }));
    check('OFFICIAL FILE: each team\'s sheet lists that team\'s criteria only (A three, B five, C four)', perTeam.every((p) => sameSet(p.criteria, OWNED[p.team])), perTeam);
    check('OFFICIAL FILE: team A\'s sheet holds the three figures team A reported', OWNED.A.every((n) => textsOf('A').includes(String(TYPED.A[n]))), textsOf('A'));
    const everything = workbook.worksheets.flatMap((s) => cellsOf(s).map((c) => c.text));
    check('OFFICIAL FILE: the figure team C typed for the criterion that was taken away appears nowhere in the file', !everything.includes(String(TYPED.C[K2])), everything.filter((t) => t === String(TYPED.C[K2])));

    // "Does not expire": the file is made a year and more old, and is still there to take.
    await pg.query(`UPDATE "dyn_report_official_files" SET "createdAt" = now() - interval '400 days' WHERE "id" = $1`, [file.id]);
    const listed = await http(admin, 'GET', `/bao-cao-dong/periods/${periodId}/official-files`);
    const old = (Array.isArray(listed.body) ? listed.body : []).find((f) => f.id === file.id);
    const again = await download(admin, `/bao-cao-dong/official-files/${file.id}/download`);
    check('OFFICIAL FILE: it does not expire: made 400 days ago, it is still listed as ready and still downloads the same file', old?.status === 'READY' && again.status === 200 && again.buffer.equals(got.buffer), [old, again.status]);
  }

  // ── the team x criterion matrix as an Excel file ────────────────────────────────────────────────────────────
  const matrixUrl = `/bao-cao-dong/reports/${reportId}/criteria-matrix`;
  const readMatrix = async (buffer) => {
    const workbook = await loadWorkbook(buffer);
    const sheet = workbook.worksheets[0];
    const cells = cellsOf(sheet);
    const headerRow = cells.find((c) => c.text === teamName.A)?.row;
    const col = Object.fromEntries(TEAMS.map((t) => [t, cells.find((c) => c.row === headerRow && c.text === teamName[t])?.col]));
    const rowOf = Object.fromEntries(LEAVES.map((n) => [n, cells.find((c) => c.row > (headerRow ?? 0) && c.text === n)?.row]));
    const marked = Object.fromEntries(TEAMS.map((t) => [t, LEAVES.filter((n) => cells.some((c) => c.row === rowOf[n] && c.col === col[t]))]));
    return { workbook, sheet, col, rowOf, marked };
  };
  const importMatrix = async (buffer, apply, expectedConfigVersion) => {
    const form = new FormData();
    form.append('file', xlsxPart(buffer), 'ma-tran.xlsx');
    form.append('apply', apply ? 'true' : 'false');
    if (expectedConfigVersion !== undefined) form.append('expectedConfigVersion', String(expectedConfigVersion));
    return http(admin, 'POST', matrixUrl, form);
  };
  /** What the screen does: read the file (preview), then apply it at the revision the preview was shown at. */
  const previewThenApply = async (buffer) => {
    const shownAt = await importMatrix(buffer, false);
    const applied = ok2xx(shownAt) ? await importMatrix(buffer, true, shownAt.body?.configVersion) : shownAt;
    return { preview: shownAt, applied };
  };
  const changesOf = (r) => Object.fromEntries(TEAMS.map((t) => {
    const team = (r.body?.teams ?? []).find((x) => x.teamId === teamId[t]);
    return [t, team ? { added: team.added.map((k) => nameOfKey.get(k)), removed: team.removed.map((k) => nameOfKey.get(k)) } : null];
  }));
  const nothing = (c) => c && c.added.length === 0 && c.removed.length === 0;
  const sameConfig = (byTeam, want) => TEAMS.every((t) => (want[t] === null ? isAll(byTeam[t]) : Array.isArray(byTeam[t]) && sameSet(byTeam[t], want[t])));

  // The configuration as it stands (the removal inside the running period was of that period only).
  const want = { A: OWNED.A, B: null, C: null };
  const file0 = await download(admin, matrixUrl);
  const matrix0 = file0.status === 200 ? await readMatrix(file0.buffer) : null;
  check(
    'MATRIX: the exported Excel has one row per criterion and one column per team, marked where the team reports it (A three marks, B five, C five)',
    matrix0 && sameSet(matrix0.marked.A, OWNED.A) && sameSet(matrix0.marked.B, LEAVES) && sameSet(matrix0.marked.C, LEAVES),
    matrix0 ? matrix0.marked : file0.status,
  );
  if (matrix0) {
    const round = await previewThenApply(file0.buffer);
    config = await targetsOf();
    check(
      'MATRIX: importing the exported file without touching it announces no change and changes nothing',
      ok2xx(round.preview) && TEAMS.every((t) => nothing(changesOf(round.preview)[t])) && ok2xx(round.applied) && sameConfig(config.byTeam, want),
      [round.preview.status, changesOf(round.preview), round.applied.status, round.applied.body, config.byTeam],
    );

    // One cell is cleared: team B no longer reports criterion 4.
    matrix0.sheet.getCell(matrix0.rowOf[K4], matrix0.col.B).value = null;
    const edited = Buffer.from(await matrix0.workbook.xlsx.writeBuffer());
    const change = await previewThenApply(edited);
    const announced = changesOf(change.preview);
    config = await targetsOf();
    const wantEdited = { A: OWNED.A, B: LEAVES.filter((n) => n !== K4), C: null };
    check(
      'MATRIX: importing the file with ONE cell cleared (team B, criterion 4) announces exactly that change and changes exactly that cell',
      ok2xx(change.preview) && nothing(announced.A) && nothing(announced.C) && announced.B && announced.B.added.length === 0 && sameList(announced.B.removed, [K4]) && ok2xx(change.applied) && sameConfig(config.byTeam, wantEdited),
      [change.preview.status, announced, change.applied.status, change.applied.body, config.byTeam],
    );
    check(
      'the change made in the configuration did not reach the locked period: team B\'s closed assignment still has its five criteria',
      sameSet(labelsOf(await viewOf('B')), LEAVES),
      labelsOf(await viewOf('B')),
    );

    // A file taken NOW, read on the screen (preview) ... and then somebody else changes the configuration.
    const file1 = await download(admin, matrixUrl);
    const shownAt = await importMatrix(file1.buffer, false);
    const cWithout3 = LEAVES.filter((n) => n !== K3);
    const other = await http(admin, 'PATCH', `/bao-cao-dong/reports/${reportId}`, {
      expectedConfigVersion: config.configVersion,
      targets: [
        { teamId: teamId.A, editorUserIds: [editorId.A] },
        { teamId: teamId.B, editorUserIds: [editorId.B] },
        { teamId: teamId.C, editorUserIds: [editorId.C], itemKeys: cWithout3.map((n) => itemKey[n]) },
      ],
    });
    const wantAfterOther = { ...wantEdited, C: cWithout3 };
    config = await targetsOf();
    check('somebody else takes criterion 3 away from team C in the configuration; teams A and B are left as they were', other.status === 200 && sameConfig(config.byTeam, wantAfterOther), [other.status, other.body, config.byTeam]);
    const staleApply = await importMatrix(file1.buffer, true, shownAt.body?.configVersion);
    config = await targetsOf();
    check(
      'MATRIX: applying an import that was read on screen BEFORE somebody else changed the configuration is refused, and their change stands',
      staleApply.status === 409 && sameConfig(config.byTeam, wantAfterOther),
      [staleApply.status, staleApply.body, config.byTeam],
    );
    // The same stale FILE, imported from scratch afterwards (read it, apply it): it was taken before the other change.
    const staleFile = await previewThenApply(file1.buffer);
    config = await targetsOf();
    check(
      'MATRIX: importing a STALE FILE (exported before somebody else changed the configuration) afterwards is refused, and their change stands',
      !ok2xx(staleFile.applied) && sameConfig(config.byTeam, wantAfterOther),
      { preview: [staleFile.preview.status, changesOf(staleFile.preview)], applied: [staleFile.applied.status, staleFile.applied.body], configNow: config.byTeam, configBeforeTheImport: wantAfterOther },
    );
  }

  // ── a report made the old way: no criteria per team ─────────────────────────────────────────────────────────
  const legacyBook = new ExcelJS.Workbook();
  const legacySheet = legacyBook.addWorksheet('S');
  legacySheet.getCell('A1').value = 'Số vụ';
  legacySheet.getCell('A2').value = 'Số người';
  for (const address of ['B1', 'B2']) legacySheet.getCell(address).protection = { locked: false };
  const legacyFile = Buffer.from(await legacyBook.xlsx.writeBuffer());
  const legacy = await publish(
    {
      code: `${TAG}-CU`,
      name: `UAT ${RUN} CU`,
      selectedSheets: ['S'],
      dateSystem: '1900',
      fields: ['B1', 'B2'].map((address, i) => ({ sheetKey: 'S', address, fieldKey: `S!${address}`, label: i === 0 ? 'Số vụ' : 'Số người', type: 'NUM', aggregate: 'SUM', source: 'WEB' })),
      layout: {},
      formulas: [],
      schedule: SCHEDULE,
      roles: [{ userId: adminId, role: 'MANAGER' }],
      targets: TEAMS.map((t) => ({ teamId: teamId[t], editorUserIds: [editorId[t]] })),
      effectiveFrom: firstOfMonth(),
      publish: true,
      idempotencyKey: randomUUID(),
    },
    legacyFile,
    'mau.xlsx',
  );
  check('LEGACY: a report made the old way (a template, nothing said about criteria per team) is published for the same three teams', legacy.status === 201 && legacy.body?.status === 'PUBLISHED', legacy.body);
  if (legacy.body?.reportId) {
    const LEGACY = { A: [7, 1], B: [70, 2], C: [700, 4] };
    const seen = [];
    let legacyPeriod = null;
    for (const t of TEAMS) {
      const row = await assignmentOf(t, legacy.body.reportId);
      if (!row) {
        seen.push([t, 'no open assignment']);
        continue;
      }
      legacyPeriod = row.periodId;
      const url = `/bao-cao-dong/submissions/${row.assignmentId}`;
      const view = (await http(token[t], 'GET', url)).body;
      const saved = await http(token[t], 'PATCH', `${url}/values`, { values: { 'S!B1': String(LEGACY[t][0]), 'S!B2': String(LEGACY[t][1]) }, expectedRevision: view?.revision, idempotencyKey: randomUUID() });
      const sent = await http(token[t], 'POST', `${url}/submit`, { expectedRevision: saved.body?.revision });
      seen.push([t, (view?.fields ?? []).map((f) => f.fieldKey).sort().join(','), saved.status, sent.status]);
    }
    check('LEGACY: every team is given every input of the report, saves and submits', seen.every((s) => s[1] === 'S!B1,S!B2' && s[2] === 200 && (s[3] === 200 || s[3] === 201)), seen);
    const summary = await http(admin, 'GET', `/bao-cao-dong/periods/${legacyPeriod}/summary?mode=SUBMITTED`);
    const totals = ['S!B1', 'S!B2'].map((key) => (summary.body?.fields ?? []).find((f) => f.fieldKey === key) ?? {});
    check(
      'LEGACY: it aggregates as before: every team is counted in every total (7 + 70 + 700 = 777 and 1 + 2 + 4 = 7, three teams each)',
      Number(totals[0].value) === 777 && Number(totals[1].value) === 7 && totals.every((f) => f.countTotal === 3 && sameSet((f.contributors ?? []).map((c) => c.teamName), TEAMS.map((t) => teamName[t]))),
      totals,
    );
  }

  // ── a team that has NO criterion of a group does not get the group's row either ─────────────────────────────
  // The same list as a second report: team A is given criteria 2 and 3 only, so nothing of group "1" (1.1, 1.2).
  const GROUPLESS = [K2, K3];
  const grouped = await publish(
    criteriaConfig('NHOM', [
      { teamId: teamId.A, editorUserIds: [editorId.A], itemKeys: GROUPLESS.map((n) => itemKey[n]) },
      { teamId: teamId.B, editorUserIds: [editorId.B] },
    ]),
    generated,
    'chi-tieu.xlsx',
  );
  const groupedAsg = grouped.body?.reportId ? { A: await assignmentOf('A', grouped.body.reportId), B: await assignmentOf('B', grouped.body.reportId) } : {};
  check('GROUP: the same list is published again with team A given criteria 2 and 3 only (nothing of group "1")', grouped.status === 201 && groupedAsg.A && groupedAsg.B, [grouped.status, grouped.body]);
  if (groupedAsg.A && groupedAsg.B) {
    const sheetOf = async (team) => {
      const view = (await http(token[team], 'GET', `/bao-cao-dong/submissions/${groupedAsg[team].assignmentId}`)).body;
      const grid = await http(token[team], 'GET', `/bao-cao-dong/versions/${view?.versionId}/grid?assignmentId=${encodeURIComponent(groupedAsg[team].assignmentId)}`);
      return { status: grid.status, text: JSON.stringify(grid.body) };
    };
    const namesIn = (text) => SOURCE_ROWS.map((r) => r.name).filter((n) => text.includes(n));
    const sheetA = await sheetOf('A');
    const sheetB = await sheetOf('B');
    check(
      'GROUP: the sheet sent to team A holds criteria 2 and 3 and nothing of group "1": neither 1.1, 1.2 nor the row of the group itself',
      sheetA.status === 200 && sameSet(namesIn(sheetA.text), GROUPLESS),
      [sheetA.status, namesIn(sheetA.text)],
    );
    check('GROUP: the sheet sent to team B, which has everything, holds the group and all five criteria', sheetB.status === 200 && sameSet(namesIn(sheetB.text), SOURCE_ROWS.map((r) => r.name)), [sheetB.status, namesIn(sheetB.text)]);
    const fileA = await textsOfExport(token.A, groupedAsg.A.assignmentId);
    const fileB = await textsOfExport(token.B, groupedAsg.B.assignmentId);
    check(
      'GROUP: the Excel file team A takes of its own figures holds criteria 2 and 3 and nothing of group "1": neither 1.1, 1.2 nor the name of the group',
      fileA.status === 200 && sameSet(SOURCE_ROWS.map((r) => r.name).filter((n) => fileA.texts.includes(n)), GROUPLESS),
      [fileA.status, fileA.texts],
    );
    check(
      'GROUP: the Excel file of team B holds the group and all five criteria',
      fileB.status === 200 && SOURCE_ROWS.every((r) => fileB.texts.includes(r.name)),
      [fileB.status, fileB.texts],
    );
  }

  // ── the manager may rename a criterion at the review step; its code and its place stay the file's ───────────
  // What the review screen does: the list read from the file, one name retyped, sent back to become the workbook.
  const RENAMED = `Số vụ án khởi tố mới (${RUN})`;
  const rebuilt = await http(admin, 'POST', '/bao-cao-dong/templates/criteria/workbook', { criteria: drafts.map((d) => (d.name === K2 ? { ...d, name: RENAMED } : d)) });
  const reviewed = Array.isArray(rebuilt.body?.criteria) ? rebuilt.body.criteria : [];
  const namesAfterRename = SOURCE_ROWS.map((r) => (r.name === K2 ? RENAMED : r.name));
  check(
    'REVIEW: a criterion renamed by the manager at the review step keeps the manager\'s name; every other criterion keeps the name read from the file',
    ok2xx(rebuilt) && sameList(reviewed.map((c) => c.name), namesAfterRename),
    [rebuilt.status, reviewed.map((c) => c.name)],
  );
  let kept = [];
  if (ok2xx(rebuilt) && rebuilt.body?.fileBase64) {
    const renamedFile = Buffer.from(rebuilt.body.fileBase64, 'base64');
    const form = new FormData();
    form.append('file', xlsxPart(renamedFile), 'chi-tieu.xlsx');
    form.append('selectedSheets', JSON.stringify([rebuilt.body.sheetName]));
    const renamedPreview = await http(admin, 'POST', '/bao-cao-dong/templates/preview', form);
    const metaOf = new Map((rebuilt.body.fields ?? []).map((f) => [f.fieldKey, f]));
    const renamedReport = await publish(
      {
        ...criteriaConfig('TEN', [{ teamId: teamId.A, editorUserIds: [editorId.A] }]),
        selectedSheets: [rebuilt.body.sheetName],
        // The fields as the preview of the renamed workbook gives them: the label is whatever the server read there.
        fields: (renamedPreview.body?.fields ?? []).map((f) => {
          const ref = metaOf.get(f.fieldKey);
          return ref ? { ...f, itemKey: ref.itemKey, ...(ref.code ? { criterionCode: ref.code } : {}), ...(ref.unit ? { unit: ref.unit } : {}), ...(ref.parentItemKey ? { parentItemKey: ref.parentItemKey } : {}), origin: ref.origin } : f;
        }),
        layout: renamedPreview.body?.layout ?? {},
        formulas: renamedPreview.body?.formulas ?? [],
      },
      renamedFile,
      'chi-tieu.xlsx',
    );
    if (renamedReport.body?.reportId) {
      const detail = await http(admin, 'GET', `/bao-cao-dong/reports/${renamedReport.body.reportId}`);
      const rowOfAddress = (address) => Number(/\d+$/.exec(address)?.[0] ?? 0);
      kept = [...(detail.body?.currentVersion?.fields ?? [])].sort((a, b) => rowOfAddress(a.address) - rowOfAddress(b.address)).map((f) => [f.criterionCode, f.label]);
    }
  }
  // The input cells, top to bottom, as the FILE orders and codes them (the parent "1" has no input cell).
  const leavesInFileOrder = SOURCE_ROWS.filter((r) => r.name !== PARENT).map((r) => [r.code, r.name === K2 ? RENAMED : r.name]);
  check(
    'REVIEW: in the published report the renamed criterion carries the manager\'s name, and every criterion still has the code and the place it has in the file (1.1, 1.2, 2, 3, 4 top to bottom)',
    kept.length === leavesInFileOrder.length && kept.every(([code, label], i) => code === leavesInFileOrder[i][0] && label === leavesInFileOrder[i][1]),
    { kept, expected: leavesInFileOrder },
  );
}

(async () => {
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  if (CLEAN_TAG) {
    await cleanUp(pg);
    await pg.end();
    console.log(`cleaned ${TAG}`);
    return;
  }
  try {
    await seed(pg);
    await workflow(pg);
  } catch (err) {
    check('the workflow ran to its end', false, err instanceof Error ? err.message : String(err));
  } finally {
    if (KEEP) console.log(`\nKEPT ${TAG} (accounts ${TAG}-admin, ${TAG}-ed-a|b|c). Remove with: E2E_CLEAN_TAG=${TAG} node tools/uat-bao-cao-dong/criteria-workflow.cjs`);
    else await cleanUp(pg);
    await pg.end();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? `; FAILED: ${failed.map((f) => f.name).join(' | ')}` : ''}`);
  process.exit(failed.length ? 1 : 0);
})();
