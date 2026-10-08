// Expected behavior comes from approved requirements and frozen inventories only.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'docs/requirements/case-governance', name), 'utf8'));
const fields = read('field-inventory.json');
const actions = read('action-inventory.json');
if (fields.uniqueKeys !== 132 || fields.placements !== 181 || fields.tabCount !== 10 || fields.rows.length !== 132) throw new Error('Field requirement inventory changed');
const actionRows = actions.rows || actions.actions;
if (!Array.isArray(actionRows) || actionRows.length !== 21) throw new Error('Action requirement inventory changed');
const cases = [];
const add = (id, requirement, journey, expected, extra = {}) => cases.push({ id, requirement, critical: true, journey, expected, ...extra, status: 'NOT_RUN', evidence: [] });
const rounds = {
  CREATE: 'Create with an explicit typed value; reload from API and visible detail. Canonical storage contains that value, with no conflicting alias taking precedence.',
  EDIT: 'Change a previously stored value using the real edit form; save and reload. Form, detail and exported authorized value agree.',
  CLEAR: 'Clear the field explicitly, save and reload. Nullable values remain empty, old aliases never revive; required/nonnullable fields show explicit validation and preserve the prior persisted value on rejection.',
  CLONE: 'Clone the dossier using the existing user flow. Authorized information is retained, unknown stays unknown; identity/code/legal history/attachments/source relationships are reset or explicitly re-established as required.',
  ACCESS: 'Restrict this registered native field in a reviewed published pinned schema. Unauthorized actor cannot read, write, infer through search/count/empty/sort/export/audit/replay. An unrelated permitted edit succeeds without clearing or exposing it.'
};
fields.rows.forEach((f, i) => {
  for (const [round, expected] of Object.entries(rounds)) add(`CG01-F${String(i + 1).padStart(3, '0')}-${round}`, ['CG01', 'CG14', 'CG15'], `Field ${f.key}: ${round.toLowerCase()}`, expected, { field: { key: f.key, storage: f.storage, type: f.type, labels: f.labels } });
});
const actionChecks = {
  EXECUTE: 'With the correct verified phase, current scope, published effective rule, complete actual decision and independently approved exact revision, execute once. Decision, phase/status, history, audit and outbox agree and source identity/history remain intact.',
  STATE: 'Wrong status or phase rejects before mutation; no decision/history/outbox is created.',
  DATA: 'Missing decision basis/number/issuer/signatory/source or incomplete/partial dates reject. Missing dates never become today.',
  AUTHORITY: 'Read-only, technical administrator without business capability, wrong unit and inactive actor reject. The author cannot self-review.',
  REVISION: 'Editing after submission invalidates approval. Stale Case/request version or changed source bytes rejects before execution.',
  REPLAY: 'Concurrent same actor/key/content yields one intended transaction and stable result; differing content yields conflict. Revoked access is rechecked on replay.',
  ATOMICITY: 'Injected history/audit/outbox failure rolls back decision, request and Case changes together.',
  RULE: 'Pinned legal effective interval/version governs execution; new publication does not rewrite history, superseded version remains traceable.'
};
actionRows.forEach((a, i) => {
  for (const [check, expected] of Object.entries(actionChecks)) add(`CG04-A${String(i + 1).padStart(2, '0')}-${check}`, ['CG04', 'CG05', 'CG06', 'CG07', 'CG10'], `${a.code || a.actionCode || a.name || 'legacy action'}: ${check.toLowerCase()}`, expected, { action: a });
});
const journeys = [
  ['PRINCIPAL-MODE', ['CG13','CG14'], 'Explicit INTERNAL/REPRESENTATION_ONLY management, minimal list, scoped view/edit/download and expiration', 'Only current server profile controls access; list-only cannot infer hidden content through query/count/sort; recipient gets exact Case/actions, no expired staff fallback; legitimate internal rights retained; profile changes require actual User.write plus business management authority and version/audit.'],
  ['ROLE-AUTHORITY', ['CG07','CG14'], 'Technical administrator attempts governance role grants, self role upgrade and business account credential/bulk reset', 'Application management cannot acquire or impersonate business review/publish/dispose authority without explicit delegated management; all alternate paths reauthorize/audit/version; normal non-governance account management remains.'],
  ['CLASSIFICATION', ['CG07','CG14'], 'Case sensitivity classification, legacy unknown quarantine and reviewed declassification', 'Explicit authorized scoped purpose, exact approved revision and source; old classification preserved; no ordinary metadata downgrade or change to legal phase/status/date; unrelated users never access quarantine.'],
  ['DEADLINE', ['CG05','CG06','CG10','CG16'], 'Versioned initial/restored/supplementary/renewed deadline with actual anchors and reviewed calendar', 'Actual appropriate anchor and authority/gravity/calendar determine documented date; receipt differs from decision as needed; partial/extracted/hidden facts block; month/leap/local end-of-day/nonworking boundaries correct; task and dashboard agree; internal handoff preserves clock.'],
  ['CUSTODY-FACTS', ['CG11','CG14'], 'Physical receipt→transfer→correction with actual holder/location/condition/receipt and concurrent transfer', 'Application actor is distinct from actual holder; sufficient evidence facts and current chain version required; unknown prior custody retained; ordinary location edits cannot bypass established ledger.'],
  ['BYTE-FIELDS', ['CG11','CG12','CG14'], 'NORMAL Case protected native value embedded in original file, masked metadata and exact reviewed disclosure', 'Original bytes cannot bypass field confidentiality; sensitive scoped actor or exact approved public/redacted content proof required; policy/source/profile version pinned and current grants rechecked on ordinary/legacy/cached routes.'],
  ['SAFE-RECOVERY', ['CG14','CG17'], 'Disable new commands and restore compatible authorization artifact after restricted data exists', 'Restricted Case/native fields/representation mode/packet/hold negatives remain enforced; no legacy status PUT/bulk bypass on governed dossiers; safe minimum backend artifact identified, additive history intact.'],
  ['RECEIPT', ['CG02','CG03','CG10'], 'Send, receive, return and cancel through real inbox; wrong team/version/permission, retry and concurrent receive', 'Exactly one pending handoff; authorized receive once; ID/code/proposal/deadline and legal status unchanged; all ledger/audit writes atomic; pending blocks ordinary parent/child/bulk writes.'],
  ['FLAG-OFF', ['CG02','CG17'], 'Disable feature on isolated test environment after publication and pending handoff', 'New governance mutations reject; existing ledgers remain readable and pending handoff can be safely cleared; no history deleted.'],
  ['UNKNOWN', ['CG01','CG04','CG05'], 'Legacy Case lacking phase, date and history', 'Unknown data visibly labeled; no inferred event/date/decision is fabricated; explicit verification requires authority and evidence.'],
  ['SOURCE', ['CG09','CG10'], 'Ordinary tab edits then explicit link to an authorized Incident/Petition', 'Ordinary save creates no phantom source; explicit command validates both scopes/versions/provenance and pins traceable source.'],
  ['RELATIONS', ['CG08','CG14'], 'Approved merge, split, transfer, related and correction, including cycles and hidden targets', 'Typed decision-backed relations retain source IDs/history/children; split allocates scope and selected part with basis; self/cycle/duplicate/hidden target cannot bypass authorization.'],
  ['FIELDS', ['CG01','CG06','CG07'], 'Typed custom and native policy configuration lifecycle/adoption', 'Structured draft/validate/separate review/publish; safe types/options/keys; exact revision immutable after publication; Case pins version and ordinary atomic save preserves unknown legacy values.'],
  ['ORIGINAL', ['CG11','CG14'], 'Register original, verify, alter one byte, derive and correct custody', 'Current byte hash checked through safe server handle; tampered parent/output rejects; original immutable; derivative lineage/tool/source hash fixed; custody correction appends and preserves original event.'],
  ['FILE-ACL', ['CG11','CG14'], 'Ordinary file download/reparent/delete and force rollback during grant revocation', 'Old and new parent authorization checked; registered originals cannot detach/delete; current grant checked before transmission; no path/symlink escape or hidden related item hydration.'],
  ['PACKET', ['CG07','CG12','CG14'], 'Packet create/revise/submit/review/export/revoke/expire/delta plus offline verify', 'Approval freezes exact authorized versions/items/recipient/purpose/hash; edits invalidate; separate reviewer; trusted manifest detects changed bytes; expired/revoked grant blocks new downloads; downloaded-copy limitations accurately stated.'],
  ['HOLDS', ['CG11','CG13'], 'Active hold with authorized read/export, ordinary delete, force rollback and disposition', 'Hold blocks destruction and disposition on every path including concurrent/force; authorized reading alone is permitted; release reason and current version recorded.'],
  ['REPRESENTATION', ['CG13','CG14'], 'Lawyer representation scope/actions/time and revocation', 'Only specified dossier and permitted actions available; read does not imply edit/share/dispose; revocation checked before hydrate/replay; no broader graph access.'],
  ['RETENTION', ['CG07','CG13'], 'Retention draft/review/publish/replace, eligibility and disposition approval/receipt', 'Expiry creates reviewed request, never automatic purge; active hold blocks execution; exact current policy/receipt retained; archival/retirement preserves originals and provenance.'],
  ['AUDIT', ['CG10','CG14'], 'Audit list/detail/filter/count/export with revoked case and native/custom field authority', 'Case IDs, before/after values, changed fields/counts and distinct hints respect current Case and field policy; non-Case audits retain their required behavior.'],
  ['QUEUES', ['CG03','CG15','CG16'], 'Pending/assigned/missing/review/due/overdue queues and dashboard drilldown at fixed clock', 'Same authorized set and formula for KPI/list/count/export; overdue boundaries verified; hidden cases never counted; task responsibility and status tracked.'],
  ['OUTBOX', ['CG10','CG14','CG16'], 'Transaction fault, worker restart, duplicate delivery and revoked recipient', 'Only committed notifications delivered once internally; leases expire/retry; revoked recipient receives no hidden data; no outward messages.'],
  ['SEARCH', ['CG14','CG15'], 'Vietnamese all-column/explicit field/negation/empty tokens and literal selector words', 'Permitted fields remain searchable; protected-only matches excluded without count inference; sort/suggestions/export use same visibility and no false rejection of literal text.'],
  ['NAVIGATION', ['CG15'], 'URL Back/Forward, pagination/columns/sort/filter and desktop/mobile navigation', 'State restores correctly; all ten information tabs and specialized detail features remain reachable; no clipped actions, console crash or stale dossier data.'],
  ['UPLOAD-EXPORT', ['CG01','CG12','CG15'], 'Partial attachment failure/retry, existing Word and full Excel export', 'Retries bind already-created Case and pinned schema without duplicates; documents use persisted canonical authorized fields; downloads correct filenames/content and no hidden fields.'],
  ['COMPATIBILITY', ['CG17'], 'Existing Incident, UTDT and old PUT/bulk compatibility', 'Existing unrelated protocols remain green; compatibility routes enforce same legal/current permission/version requirements and never become bypasses.'],
  ['MIGRATION', ['CG17'], 'Compatible schema migration, backup/restore and application rollback rehearsal', 'All prior checksums and unknown legacy data retained; restore recovers decisions/assets/custody/approval/audit/outbox; rollback code does not drop ledgers.'],
  ['OPERATIONS', ['CG17'], 'Baseline/load comparison and bounded seeded local monkey exploration', 'Recorded p95/error budget and seed/trace; no crash, corruption, permission leak, duplicate legal commit or inaccessible workflow; measured failures returned to implementation.']
];
for (const [id, req, journey, expected] of journeys) add(`CG-UAT-${id}`, req, journey, expected);
const outDir = path.join(root, 'docs/uat/case-governance');
fs.mkdirSync(outDir, { recursive: true });
const requirements = Array.from({ length: 17 }, (_, i) => 'CG' + String(i + 1).padStart(2, '0'));
for (const req of requirements) if (!cases.some(c => c.requirement.includes(req))) throw new Error(`Unmapped requirement ${req}`);
fs.writeFileSync(path.join(outDir, 'uat-plan.json'), JSON.stringify({ version: 1, source: ['docs/requirements/FRD.md','docs/requirements/acceptance-criteria.md','docs/requirements/case-governance/field-inventory.json','docs/requirements/case-governance/action-inventory.json'], environment: { database: 'pc02_case_governance_uat', host: '127.0.0.1', port: 55441, api: 3001, frontend: 5280, production: false }, roles: ['operating author','independent reviewer','independent publisher','readonly within unit','wrong unit','technical administrator without governance capability','sensitive reader','expired/revoked grant','lawyer limited representation','inactive actor'], criticalPassRequired: 100, unresolvedBlockerMajorAllowed: 0, requirements, cases }, null, 2) + '\n');
console.log(JSON.stringify({ cases: cases.length, fieldCases: fields.rows.length * Object.keys(rounds).length, actionCases: actionRows.length * Object.keys(actionChecks).length, requirementCount: requirements.length, status: 'NOT_RUN' }));
