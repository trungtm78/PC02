/**
 * The life of a team end to end, through the real HTTP API, on a LOCAL stack only.
 *
 * In the order an administrator meets it: create teams, pause one and see it leave every picker, bring it back,
 * archive and restore, delete a team that has nothing, be refused for a team that has people, merge a team that has
 * records into another (preview, the records move, the source is archived, somebody in both teams is there once),
 * undo the merge, and undo a merge after one record was moved again (that record stays where it was put).
 *
 *   E2E_DB=postgresql://postgres:postgres@127.0.0.1:5433/pc02_dynamic_reports_test \
 *   E2E_BASE=http://127.0.0.1:3999/api/v1  node tools/uat-to/workflow.cjs
 *
 * The backend must be running against that same database (`PORT=3999 DATABASE_URL=$E2E_DB npx nest start` in
 * `backend/`).
 *
 * REFUSES any address that is not local: it writes data. It creates its own accounts (an administrator, an officer,
 * `uat-to-<run>-*`), its own teams and petitions, and removes all of them at the end, also when a check fails.
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

const bcrypt = require(path.join(BACKEND, 'node_modules/bcrypt'));
const { Client } = require(path.join(BACKEND, 'node_modules/pg'));

const RUN = randomUUID().slice(0, 8);
const TAG = `uat-to-${RUN}`;
// A password of this run only: generated, never printed, gone with the accounts.
const PASSWORD = `Uat-${randomUUID()}!`;
const ADMIN_KEYS = ['read:Team', 'write:Team', 'edit:Team', 'delete:Team'];

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : `\n        -> ${(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 500)}`}`);
}

async function login(username) {
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: PASSWORD }) });
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
/** The list inside a response, whether it comes bare or wrapped. */
const listOf = (body) => (Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : []);

async function seed(pg) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const key of ADMIN_KEYS) {
    const [action, subject] = key.split(':');
    await pg.query(`INSERT INTO "permissions" ("id","action","subject") VALUES ($1,$2,$3) ON CONFLICT ("action","subject") DO NOTHING`, [`${TAG}-${action}-${subject}`, action, subject]);
  }
  const perms = (await pg.query(`SELECT "id", "action" || ':' || "subject" AS key FROM "permissions" WHERE "action" || ':' || "subject" = ANY($1)`, [ADMIN_KEYS])).rows;
  let adminRole = (await pg.query(`SELECT "id" FROM "roles" WHERE "name" = 'ADMIN'`)).rows[0]?.id;
  if (!adminRole) {
    adminRole = `${TAG}-admin-role`;
    await pg.query(`INSERT INTO "roles" ("id","name","updatedAt") VALUES ($1,'ADMIN',now())`, [adminRole]);
  }
  const grantedToAdmin = [];
  for (const p of perms) {
    const added = await pg.query(`INSERT INTO "role_permissions" ("roleId","permissionId") VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING "permissionId"`, [adminRole, p.id]);
    if (added.rowCount) grantedToAdmin.push(p.id);
  }
  // The officer may read teams (every picker needs that) and nothing else about them.
  await pg.query(`INSERT INTO "roles" ("id","name","updatedAt") VALUES ($1,$2,now())`, [`${TAG}-officer-role`, `${TAG}-OFFICER`]);
  await pg.query(`INSERT INTO "role_permissions" ("roleId","permissionId") VALUES ($1,$2)`, [`${TAG}-officer-role`, perms.find((p) => p.key === 'read:Team').id]);
  for (const [id, role] of [[`${TAG}-admin`, adminRole], [`${TAG}-officer`, `${TAG}-officer-role`], [`${TAG}-shared`, `${TAG}-officer-role`]]) {
    await pg.query(
      `INSERT INTO "users" ("id","username","email","passwordHash","roleId","isActive","twoFaSetupRequired","updatedAt") VALUES ($1,$1,$2,$3,$4,true,false,now())`,
      [id, `${id}@local.test`, hash, role],
    );
  }
  return { adminRole, grantedToAdmin };
}

async function cleanUp(pg, seeded) {
  const like = `${TAG}-%`;
  const teams = (await pg.query(`SELECT "id" FROM "teams" WHERE "code" LIKE $1`, [`${TAG}-%`])).rows.map((r) => r.id);
  await pg.query(`DELETE FROM "petitions" WHERE "stt" LIKE $1`, [like]);
  await pg.query(`DELETE FROM "team_merge_items" WHERE "operationId" IN (SELECT "id" FROM "team_merge_operations" WHERE "sourceTeamId" = ANY($1) OR "targetTeamId" = ANY($1))`, [teams]);
  await pg.query(`DELETE FROM "team_merge_operations" WHERE "sourceTeamId" = ANY($1) OR "targetTeamId" = ANY($1)`, [teams]);
  await pg.query(`DELETE FROM "user_teams" WHERE "teamId" = ANY($1) OR "userId" LIKE $2`, [teams, like]);
  await pg.query(`DELETE FROM "teams" WHERE "id" = ANY($1)`, [teams]);
  await pg.query(`DELETE FROM "users" WHERE "id" LIKE $1`, [like]);
  await pg.query(`DELETE FROM "role_permissions" WHERE "roleId" LIKE $1`, [like]);
  if (seeded?.grantedToAdmin?.length) {
    await pg.query(`DELETE FROM "role_permissions" WHERE "roleId" = $1 AND "permissionId" = ANY($2)`, [seeded.adminRole, seeded.grantedToAdmin]);
  }
  await pg.query(`DELETE FROM "roles" WHERE "id" LIKE $1`, [like]);
  await pg.query(`DELETE FROM "permissions" WHERE "id" LIKE $1 AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp."permissionId" = "permissions"."id")`, [like]);
}

async function workflow(pg) {
  const admin = await login(`${TAG}-admin`);
  const officer = await login(`${TAG}-officer`);
  check('an administrator and an officer log in', admin && officer, [!!admin, !!officer]);
  if (!admin || !officer) return;

  const inOptions = async (token, id) => listOf((await call(token, 'GET', '/teams/options')).body).some((t) => t.id === id);
  const inList = async (status, id) => listOf((await call(admin, 'GET', `/teams${status ? `?status=${status}` : ''}`)).body).some((t) => t.id === id);
  const newTeam = async (suffix) => {
    const res = await call(admin, 'POST', '/teams', { name: `UAT ${RUN} ${suffix}`, code: `${TAG}-${suffix}`, level: 0 });
    return { status: res.status, id: res.body?.id ?? res.body?.data?.id };
  };
  const setStatus = (token, id, status) => call(token, 'PATCH', `/teams/${id}/status`, { status });
  const statusOf = async (id) => (await pg.query(`SELECT "status" FROM "teams" WHERE "id" = $1`, [id])).rows[0]?.status;
  const teamOfPetition = async (stt) => (await pg.query(`SELECT "assignedTeamId" FROM "petitions" WHERE "stt" = $1`, [stt])).rows[0]?.assignedTeamId;

  // ── create ──────────────────────────────────────────────────────────────────────────────────────────────────
  const a = await newTeam('A');
  const b = await newTeam('B');
  const empty = await newTeam('EMPTY');
  const other = await newTeam('D');
  check('teams are created', a.id && b.id && empty.id && other.id, [a, b, empty, other]);
  if (!a.id || !b.id || !empty.id || !other.id) return;
  check('a new team is active and in the picker, for the officer too', (await inOptions(officer, a.id)) && (await inList('', a.id)));

  // ── pause and back ──────────────────────────────────────────────────────────────────────────────────────────
  const paused = await setStatus(admin, a.id, 'INACTIVE');
  check('the administrator pauses the team', paused.status === 200, [paused.status, paused.body]);
  check('PAUSED: it left the picker', !(await inOptions(officer, a.id)));
  check('PAUSED: it left the active list and is in the paused list', !(await inList('', a.id)) && (await inList('INACTIVE', a.id)));
  check('PAUSED: it is still in the list of all teams', await inList('ALL', a.id));
  check('the team is brought back', (await setStatus(admin, a.id, 'ACTIVE')).status === 200);
  check('ACTIVE AGAIN: it is back in the picker', await inOptions(officer, a.id));

  // ── archive and back ────────────────────────────────────────────────────────────────────────────────────────
  check('the team is archived', (await setStatus(admin, a.id, 'ARCHIVED')).status === 200);
  check('ARCHIVED: not in the picker, in the archived list', !(await inOptions(officer, a.id)) && (await inList('ARCHIVED', a.id)));
  const archivedToPaused = await setStatus(admin, a.id, 'INACTIVE');
  check('ARCHIVED: it cannot be paused from there; the state does not change', archivedToPaused.status === 409 && (await statusOf(a.id)) === 'ARCHIVED', [archivedToPaused.status, archivedToPaused.body]);
  check('the team is restored', (await setStatus(admin, a.id, 'ACTIVE')).status === 200 && (await inOptions(officer, a.id)));
  const unknown = await setStatus(admin, a.id, 'GONE');
  check('a state that does not exist is refused', unknown.status === 400, unknown.status);
  check('an unknown status filter on the list is refused', (await call(admin, 'GET', '/teams?status=WHATEVER')).status === 400);

  // ── who may ─────────────────────────────────────────────────────────────────────────────────────────────────
  const byOfficer = await setStatus(officer, a.id, 'INACTIVE');
  check('an officer cannot pause a team', byOfficer.status === 403 && (await statusOf(a.id)) === 'ACTIVE', byOfficer.status);
  check('...nor delete one', (await call(officer, 'DELETE', `/teams/${empty.id}`)).status === 403);
  check('...nor merge one', (await call(officer, 'POST', `/teams/${a.id}/merge`, { targetTeamId: b.id })).status === 403);

  // ── delete ──────────────────────────────────────────────────────────────────────────────────────────────────
  const emptyCheck = await call(admin, 'GET', `/teams/${empty.id}/deletion-check`);
  check('the deletion check of an empty team lists nothing in the way', emptyCheck.status === 200 && (emptyCheck.body?.blockers ?? emptyCheck.body?.data?.blockers ?? []).length === 0, emptyCheck.body);
  const deleted = await call(admin, 'DELETE', `/teams/${empty.id}`);
  check('a team with nothing is deleted for good', deleted.status === 200 && !(await inList('ALL', empty.id)), [deleted.status, deleted.body]);

  check('a member is added to team A', [200, 201].includes((await call(admin, 'POST', `/teams/${a.id}/members`, { userId: `${TAG}-officer` })).status));
  const refused = await call(admin, 'DELETE', `/teams/${a.id}`);
  const blockers = refused.body?.details ?? refused.body?.error?.details ?? [];
  check('a team with one member and no record is NOT deleted, and what is in the way is listed', refused.status === 409 && JSON.stringify(refused.body).includes('TEAM_HAS_DATA') && blockers.length > 0, [refused.status, refused.body]);
  check('...the team and its member are still there', (await inList('ALL', a.id)) && (await pg.query(`SELECT 1 FROM "user_teams" WHERE "teamId" = $1 AND "userId" = $2`, [a.id, `${TAG}-officer`])).rowCount === 1);

  // ── merge ───────────────────────────────────────────────────────────────────────────────────────────────────
  for (const n of [1, 2]) {
    await pg.query(`INSERT INTO "petitions" ("id","stt","receivedDate","senderName","assignedTeamId","updatedAt") VALUES ($1,$1,now(),$2,$3,now())`, [`${TAG}-p${n}`, `UAT ${RUN} sender ${n}`, a.id]);
  }
  // Somebody who is in BOTH teams.
  await call(admin, 'POST', `/teams/${a.id}/members`, { userId: `${TAG}-shared` });
  await call(admin, 'POST', `/teams/${b.id}/members`, { userId: `${TAG}-shared` });

  check('a team cannot be merged into itself', (await call(admin, 'POST', `/teams/${a.id}/merge`, { targetTeamId: a.id })).status === 400);
  const preview = await call(admin, 'POST', `/teams/${a.id}/merge-preview`, { targetTeamId: b.id });
  const previewSummary = preview.body?.summary ?? preview.body?.data?.summary;
  const movedPetitions = (previewSummary?.moved ?? []).find((m) => JSON.stringify(m).includes('petitions'));
  check('the preview says how many petitions would move', preview.status === 200 && JSON.stringify(movedPetitions ?? {}).includes('2'), [preview.status, previewSummary]);
  check('the preview writes nothing', (await teamOfPetition(`${TAG}-p1`)) === a.id && (await statusOf(a.id)) === 'ACTIVE');

  const merged = await call(admin, 'POST', `/teams/${a.id}/merge`, { targetTeamId: b.id });
  const operationId = merged.body?.operationId ?? merged.body?.data?.operationId;
  check('the team is merged into the other', [200, 201].includes(merged.status) && !!operationId, [merged.status, merged.body]);
  check('MERGED: both petitions belong to the target team', (await teamOfPetition(`${TAG}-p1`)) === b.id && (await teamOfPetition(`${TAG}-p2`)) === b.id);
  check('MERGED: the source team is archived and left the picker', (await statusOf(a.id)) === 'ARCHIVED' && !(await inOptions(officer, a.id)));
  const members = (await pg.query(`SELECT "userId" FROM "user_teams" WHERE "teamId" = $1 ORDER BY "userId"`, [b.id])).rows.map((r) => r.userId);
  check('MERGED: the members moved, and somebody who was in both teams is in the target once', members.filter((u) => u === `${TAG}-shared`).length === 1 && members.includes(`${TAG}-officer`), members);
  check('MERGED: the merge is in the list that offers Undo', JSON.stringify((await call(admin, 'GET', '/teams/merges')).body).includes(operationId));

  // ── undo ────────────────────────────────────────────────────────────────────────────────────────────────────
  const undone = await call(admin, 'POST', `/teams/merges/${operationId}/undo`);
  check('the merge is undone', [200, 201].includes(undone.status), [undone.status, undone.body]);
  check('UNDONE: both petitions are back in the source team, which is active again', (await teamOfPetition(`${TAG}-p1`)) === a.id && (await teamOfPetition(`${TAG}-p2`)) === a.id && (await statusOf(a.id)) === 'ACTIVE');
  check('UNDONE: the officer is a member of the source team again', (await pg.query(`SELECT 1 FROM "user_teams" WHERE "teamId" = $1 AND "userId" = $2`, [a.id, `${TAG}-officer`])).rowCount === 1);
  const again = await call(admin, 'POST', `/teams/merges/${operationId}/undo`);
  check('undoing the same merge twice is refused', again.status === 409, [again.status, again.body]);

  // ── undo after something was changed again ──────────────────────────────────────────────────────────────────
  const second = await call(admin, 'POST', `/teams/${a.id}/merge`, { targetTeamId: b.id });
  const secondId = second.body?.operationId ?? second.body?.data?.operationId;
  check('the team is merged a second time', !!secondId, [second.status, second.body]);
  // Somebody moves one of the petitions on to a third team after the merge.
  await pg.query(`UPDATE "petitions" SET "assignedTeamId" = $2 WHERE "stt" = $1`, [`${TAG}-p2`, other.id]);
  const partial = await call(admin, 'POST', `/teams/merges/${secondId}/undo`);
  check('the second merge is undone', [200, 201].includes(partial.status), [partial.status, partial.body]);
  check('UNDONE AFTER A CHANGE: the untouched petition is back in the source team', (await teamOfPetition(`${TAG}-p1`)) === a.id);
  check('UNDONE AFTER A CHANGE: the petition that was moved again stays where it was put', (await teamOfPetition(`${TAG}-p2`)) === other.id);
  check('...and the answer says something was skipped', /skipp/i.test(JSON.stringify(partial.body)) && JSON.stringify(partial.body).includes('petitions'), partial.body);
}

(async () => {
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  let seeded = null;
  try {
    seeded = await seed(pg);
    await workflow(pg);
  } catch (err) {
    check('the workflow ran to its end', false, err instanceof Error ? err.message : String(err));
  } finally {
    await cleanUp(pg, seeded);
    await pg.end();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? `; FAILED: ${failed.map((f) => f.name).join(' | ')}` : ''}`);
  process.exit(failed.length ? 1 : 0);
})();
