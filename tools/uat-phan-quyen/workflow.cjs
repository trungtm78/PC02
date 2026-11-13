/**
 * Permissions by team end to end, through the real HTTP API, on a LOCAL stack only.
 *
 * It follows the order an administrator works in: build the starter templates, give a team a template, read who
 * would gain and lose what, ask for enforcement, have a SECOND administrator approve it, see an officer of that team
 * hold exactly what the team gives (profile, guarded routes, own records), then switch it off again in one step and
 * see the role come back.
 *
 *   E2E_DB=postgresql://postgres:postgres@127.0.0.1:5433/pc02_dynamic_reports_test \
 *     node tools/uat-phan-quyen/workflow.cjs
 *
 * The backend must be running against that same database (for instance
 * `PORT=3999 DATABASE_URL=$E2E_DB npx nest start` in `backend/`, then `E2E_BASE=http://127.0.0.1:3999/api/v1`).
 *
 * REFUSES any address that is not local: it writes data and it switches the mode of the whole database. It creates
 * its own accounts (two administrators, one officer, `uat-pq-<run>-*`), its own team, role and templates, and removes
 * all of them at the end, also when a check fails. It leaves the mode OFF.
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
  console.error(`REFUSED: ${BASE} / ${DB_URL} is not a local address; this script writes data and switches the mode.`);
  process.exit(2);
}

const bcrypt = require(path.join(BACKEND, 'node_modules/bcrypt'));
const { Client } = require(path.join(BACKEND, 'node_modules/pg'));

const RUN = randomUUID().slice(0, 8);
const TAG = `uat-pq-${RUN}`;
// A password of this run only: generated, never printed, gone with the accounts.
const PASSWORD = `Uat-${randomUUID()}!`;
const MODE_KEY = 'QUYEN_THEO_TO_CHE_DO';
const ROLE_KEYS = ['read:Case', 'read:Petition', 'read:Team', 'read:User'];
const ADMIN_KEYS = [...ROLE_KEYS, 'read:Role', 'write:Role'];

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : `\n        -> ${(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 500)}`}`);
}
const sorted = (xs) => JSON.stringify([...(xs ?? [])].sort());

async function login(username) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  const body = await res.json().catch(() => null);
  return body?.accessToken ?? body?.data?.accessToken ?? '';
}
async function call(token, method, url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function seed(pg) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const key of ADMIN_KEYS) {
    const [action, subject] = key.split(':');
    await pg.query(`INSERT INTO "permissions" ("id","action","subject") VALUES ($1,$2,$3) ON CONFLICT ("action","subject") DO NOTHING`, [`${TAG}-${action}-${subject}`, action, subject]);
  }
  const perms = (await pg.query(`SELECT "id", "action" || ':' || "subject" AS key FROM "permissions" WHERE "action" || ':' || "subject" = ANY($1)`, [ADMIN_KEYS])).rows;
  // The administrator role is the real one (the application knows it by name); it may already exist.
  let adminRole = (await pg.query(`SELECT "id" FROM "roles" WHERE "name" = 'ADMIN'`)).rows[0]?.id;
  const createdAdminRole = !adminRole;
  if (!adminRole) {
    adminRole = `${TAG}-admin-role`;
    await pg.query(`INSERT INTO "roles" ("id","name","updatedAt") VALUES ($1,'ADMIN',now())`, [adminRole]);
  }
  const grantedToAdmin = [];
  for (const p of perms) {
    const added = await pg.query(`INSERT INTO "role_permissions" ("roleId","permissionId") VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING "permissionId"`, [adminRole, p.id]);
    if (added.rowCount) grantedToAdmin.push(p.id);
  }
  await pg.query(`INSERT INTO "roles" ("id","name","updatedAt") VALUES ($1,$2,now())`, [`${TAG}-officer-role`, `${TAG}-OFFICER`]);
  for (const p of perms.filter((x) => ROLE_KEYS.includes(x.key))) {
    await pg.query(`INSERT INTO "role_permissions" ("roleId","permissionId") VALUES ($1,$2)`, [`${TAG}-officer-role`, p.id]);
  }
  await pg.query(`INSERT INTO "teams" ("id","name","code","updatedAt") VALUES ($1,$2,$1,now())`, [`${TAG}-team`, `UAT ${RUN}`]);
  for (const [id, role] of [[`${TAG}-admin-a`, adminRole], [`${TAG}-admin-b`, adminRole], [`${TAG}-officer`, `${TAG}-officer-role`]]) {
    // Throw-away accounts of a local run: no second factor to set up.
    await pg.query(
      `INSERT INTO "users" ("id","username","email","passwordHash","roleId","isActive","twoFaSetupRequired","updatedAt") VALUES ($1,$1,$2,$3,$4,true,false,now())`,
      [id, `${id}@local.test`, hash, role],
    );
  }
  await pg.query(`INSERT INTO "user_teams" ("userId","teamId") VALUES ($1,$2)`, [`${TAG}-officer`, `${TAG}-team`]);
  return { adminRole, createdAdminRole, grantedToAdmin };
}

async function cleanUp(pg, seeded, modeBefore) {
  const like = `${TAG}-%`;
  // The mode first: whatever failed, the database is not left enforcing.
  if (modeBefore === null) await pg.query(`DELETE FROM "system_settings" WHERE "key" = $1`, [MODE_KEY]);
  else await pg.query(`UPDATE "system_settings" SET "value" = $2 WHERE "key" = $1`, [MODE_KEY, modeBefore]);
  await pg.query(`DELETE FROM "authz_mode_changes" WHERE "requestedById" LIKE $1`, [like]);
  await pg.query(`DELETE FROM "permission_change_sets" WHERE "actorId" LIKE $1`, [like]);
  await pg.query(`DELETE FROM "team_permission_configs" WHERE "teamId" LIKE $1`, [like]);
  await pg.query(`DELETE FROM "permission_templates" WHERE "code" LIKE $1`, [`UAT-PQ-${RUN}-%`]);
  await pg.query(`DELETE FROM "user_teams" WHERE "userId" LIKE $1`, [like]);
  await pg.query(`DELETE FROM "users" WHERE "id" LIKE $1`, [like]);
  await pg.query(`DELETE FROM "role_permissions" WHERE "roleId" LIKE $1`, [like]);
  if (seeded?.grantedToAdmin?.length) {
    await pg.query(`DELETE FROM "role_permissions" WHERE "roleId" = $1 AND "permissionId" = ANY($2)`, [seeded.adminRole, seeded.grantedToAdmin]);
  }
  await pg.query(`DELETE FROM "roles" WHERE "id" LIKE $1`, [like]);
  await pg.query(`DELETE FROM "teams" WHERE "id" LIKE $1`, [like]);
  await pg.query(`DELETE FROM "permissions" WHERE "id" LIKE $1 AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp."permissionId" = "permissions"."id")`, [like]);
}

async function workflow() {
  const a = await login(`${TAG}-admin-a`);
  const b = await login(`${TAG}-admin-b`);
  const officer = await login(`${TAG}-officer`);
  check('two administrators and an officer log in', a && b && officer, [!!a, !!b, !!officer]);
  if (!a || !b || !officer) return;

  // ── before anything is configured ───────────────────────────────────────────────────────────────────────────
  let status = await call(a, 'GET', '/authz/mode');
  check('the mode is OFF, nothing is enforced, and this build can enforce', status.status === 200 && status.body.mode === 'OFF' && status.body.enforcing === false && status.body.enforceAvailable === true, status.body);
  check('somebody without read:Role cannot read the mode', (await call(officer, 'GET', '/authz/mode')).status === 403);
  check('...nor the comparison', (await call(officer, 'GET', '/authz/mode/comparison')).status === 403);

  // ── a template for the team ─────────────────────────────────────────────────────────────────────────────────
  const tpl = await call(a, 'POST', '/authz/templates', { code: `UAT-PQ-${RUN}-OWN`, name: `UAT ${RUN} own petitions`, entries: { 'read:Petition': 'OWN' } });
  check('an administrator creates a template', tpl.status === 201 && !!tpl.body?.id, [tpl.status, tpl.body]);
  const team = await call(a, 'PUT', `/authz/teams/${TAG}-team`, { mode: 'EXPLICIT', memberTemplateId: tpl.body?.id, expectedRevision: 0 });
  check('the team is given that template for its members', team.status === 200, [team.status, team.body]);
  let me = await call(officer, 'GET', '/auth/me');
  check('OFF: configuring changes nothing yet; the officer has what the ROLE holds', sorted(me.body?.permissions) === sorted(ROLE_KEYS), me.body?.permissions);

  // ── the comparison ──────────────────────────────────────────────────────────────────────────────────────────
  let cmp = await call(a, 'GET', '/authz/mode/comparison');
  const mine = cmp.body?.impacts?.find((i) => i.userId === `${TAG}-officer`);
  check('the comparison names the officer and exactly what would be lost', sorted(mine?.lost?.map((d) => d.permission)) === sorted(['read:Case', 'read:Team', 'read:User']), mine);
  check('...and that reading petitions gets narrower (the team as a whole -> own records)', mine?.changed?.some((d) => d.permission === 'read:Petition' && d.before === 'TEAM_TREE' && d.after === 'OWN' && d.narrower === true), mine?.changed);
  check('...and counts that officer among the people losing something', cmp.body?.summary?.losing >= 1, cmp.body?.summary);
  check('administrators are not in the comparison', !cmp.body?.impacts?.some((i) => i.userId.startsWith(`${TAG}-admin`)));

  // ── what is refused ─────────────────────────────────────────────────────────────────────────────────────────
  check('enforcing directly is refused', (await call(a, 'POST', '/authz/mode', { mode: 'ENFORCE', reason: 'x' })).status === 400);
  const noReason = await call(a, 'POST', '/authz/mode', { mode: 'SHADOW', reason: '   ' });
  check('a switch without a reason is refused', noReason.status === 400, [noReason.status, noReason.body]);
  const wrong = await call(a, 'POST', '/authz/mode/requests', { reason: 'pilot', acknowledge: 'not-what-the-screen-showed' });
  check('a request on a comparison that was not read is refused', wrong.status === 409 && wrong.body?.code === 'AUTHZ_MODE_COMPARISON_CHANGED', [wrong.status, wrong.body]);
  const generic = await call(a, 'PUT', `/settings/${MODE_KEY}`, { value: 'SHADOW' });
  check('the generic settings form does not change the mode', (await call(a, 'GET', '/authz/mode')).body?.mode === 'OFF', [generic.status, generic.body]);

  // ── SHADOW and back ─────────────────────────────────────────────────────────────────────────────────────────
  check('SHADOW is switched on by one administrator', (await call(a, 'POST', '/authz/mode', { mode: 'SHADOW', reason: 'measuring' })).status === 200);
  me = await call(officer, 'GET', '/auth/me');
  check('SHADOW enforces nothing: the officer still has the role', sorted(me.body?.permissions) === sorted(ROLE_KEYS), me.body?.permissions);
  check('...and switched off again', (await call(a, 'POST', '/authz/mode', { mode: 'OFF', reason: 'done measuring' })).status === 200);

  // ── a request, withdrawn; a request, rejected ───────────────────────────────────────────────────────────────
  const ask = async (token) => {
    const fresh = await call(token, 'GET', '/authz/mode/comparison');
    return call(token, 'POST', '/authz/mode/requests', { reason: 'pilot with one team', acknowledge: fresh.body?.fingerprint });
  };
  const first = await ask(a);
  check('administrator A asks for enforcement', first.status === 201 && !!first.body?.id, [first.status, first.body]);
  check('a second request while one waits is refused', (await ask(b)).body?.code === 'AUTHZ_MODE_REQUEST_PENDING');
  const withdrawn = await call(a, 'POST', `/authz/mode/requests/${first.body?.id}/close`);
  check('A withdraws the request', withdrawn.status === 200 && withdrawn.body?.status === 'WITHDRAWN', [withdrawn.status, withdrawn.body]);
  const second = await ask(a);
  const rejected = await call(b, 'POST', `/authz/mode/requests/${second.body?.id}/close`);
  check('administrator B rejects another request', rejected.status === 200 && rejected.body?.status === 'REJECTED', [rejected.status, rejected.body]);

  // ── enforcing: asked by A, approved by B ────────────────────────────────────────────────────────────────────
  const asked = await ask(a);
  check('A asks again', asked.status === 201, [asked.status, asked.body]);
  cmp = await call(a, 'GET', '/authz/mode/comparison');
  const self = await call(a, 'POST', `/authz/mode/requests/${asked.body?.id}/approve`, { acknowledge: cmp.body?.fingerprint });
  check('A cannot approve their own request', self.status === 403 && self.body?.code === 'AUTHZ_MODE_SECOND_ADMIN_REQUIRED', [self.status, self.body]);
  const byOfficer = await call(officer, 'POST', `/authz/mode/requests/${asked.body?.id}/approve`, { acknowledge: cmp.body?.fingerprint });
  check('the officer cannot approve it', byOfficer.status === 403, byOfficer.status);
  me = await call(officer, 'GET', '/auth/me');
  check('still OFF while the request waits', sorted(me.body?.permissions) === sorted(ROLE_KEYS), me.body?.permissions);
  cmp = await call(b, 'GET', '/authz/mode/comparison');
  const approved = await call(b, 'POST', `/authz/mode/requests/${asked.body?.id}/approve`, { acknowledge: cmp.body?.fingerprint });
  check('B approves: the mode is ENFORCE', approved.status === 200 && approved.body?.mode === 'ENFORCE', [approved.status, approved.body]);
  status = await call(a, 'GET', '/authz/mode');
  check('...and it is in effect', status.body?.mode === 'ENFORCE' && status.body?.enforcing === true, status.body);

  // ── enforced ────────────────────────────────────────────────────────────────────────────────────────────────
  me = await call(officer, 'GET', '/auth/me');
  check('ENFORCED: /auth/me gives the officer only what the team gives', sorted(me.body?.permissions) === sorted(['read:Petition']), me.body?.permissions);
  check('ENFORCED: a route the role allowed and the team does not is refused', (await call(officer, 'GET', '/teams/options')).status === 403);
  check('ENFORCED: the dashboard totals are refused too (they need read:Case)', (await call(officer, 'GET', '/dashboard/stats')).status === 403);
  const petitions = await call(officer, 'GET', '/petitions?limit=5');
  check('ENFORCED: the petition list answers, limited to the officer\'s own records', petitions.status === 200, [petitions.status, JSON.stringify(petitions.body).slice(0, 200)]);
  check('ENFORCED: administrators are not restricted', (await call(a, 'GET', '/teams/options')).status === 200 && (await call(b, 'GET', '/dashboard/stats')).status === 200);
  const lookup = await call(a, 'GET', `/authz/effective/${TAG}-officer`);
  const held = (lookup.body?.permissions ?? []).filter((p) => p.reach).map((p) => p.permission);
  check('the look-up explains the officer: one permission, through the team\'s template', lookup.status === 200 && sorted(held) === sorted(['read:Petition']), [lookup.status, held]);

  // ── the way back: one administrator, one step ───────────────────────────────────────────────────────────────
  const off = await call(b, 'POST', '/authz/mode', { mode: 'OFF', reason: 'pilot over' });
  check('one administrator switches enforcement OFF', off.status === 200 && off.body?.mode === 'OFF', [off.status, off.body]);
  me = await call(officer, 'GET', '/auth/me');
  check('OFF again: the officer has the role back, at once', sorted(me.body?.permissions) === sorted(ROLE_KEYS), me.body?.permissions);
  check('OFF again: the route answers', (await call(officer, 'GET', '/teams/options')).status === 200);
  status = await call(a, 'GET', '/authz/mode');
  const history = status.body?.history ?? [];
  check('the history shows who asked, who approved, and the switch off', history[0]?.toMode === 'OFF' && history.some((h) => h.toMode === 'ENFORCE' && h.status === 'APPLIED' && h.requestedById === `${TAG}-admin-a` && h.decidedById === `${TAG}-admin-b`) && history.some((h) => h.status === 'WITHDRAWN') && history.some((h) => h.status === 'REJECTED'), history.map((h) => [h.toMode, h.status]));

  // ── the configuration can be taken away again ───────────────────────────────────────────────────────────────
  const teams = await call(a, 'GET', '/authz/teams');
  const revision = teams.body?.find?.((t) => t.teamId === `${TAG}-team`)?.revision;
  const cleared = await call(a, 'DELETE', `/authz/teams/${TAG}-team?expectedRevision=${revision}`);
  check('the team\'s configuration is removed', cleared.status === 200, [cleared.status, cleared.body]);
  const tplNow = await call(a, 'GET', `/authz/templates/${tpl.body?.id}`);
  const removed = await call(a, 'DELETE', `/authz/templates/${tpl.body?.id}?expectedRevision=${tplNow.body?.revision}`);
  check('the template is deleted once no team uses it', removed.status === 200, [removed.status, removed.body]);
}

(async () => {
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  const modeBefore = (await pg.query(`SELECT "value" FROM "system_settings" WHERE "key" = $1`, [MODE_KEY])).rows[0]?.value ?? null;
  if (modeBefore === 'ENFORCE') {
    console.error('REFUSED: this database is enforcing permissions by team already; this script would switch it off.');
    await pg.end();
    process.exit(2);
  }
  let seeded = null;
  try {
    seeded = await seed(pg);
    await workflow();
  } catch (err) {
    check('the workflow ran to its end', false, err instanceof Error ? err.message : String(err));
  } finally {
    await cleanUp(pg, seeded, modeBefore);
    await pg.end();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? `; FAILED: ${failed.map((f) => f.name).join(' | ')}` : ''}`);
  process.exit(failed.length ? 1 : 0);
})();
