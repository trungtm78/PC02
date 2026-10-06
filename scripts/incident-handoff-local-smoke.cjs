// Local integration smoke. Credentials are supplied from a private runtime fixture,
// never recorded in reports. Does not sign in to or mutate any deployed system.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');

async function main() {
  const fixturePath = process.env.INCIDENT_BROWSER_FIXTURE;
  assert.ok(fixturePath, 'Private synthetic fixture is required');
  const f = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const base = 'http://127.0.0.1:5179';
  const evidence = path.resolve('docs/test-evidence/incident-intake/runtime');
  fs.mkdirSync(evidence, { recursive: true });
  const request = async (actor, endpoint, method = 'GET', body) => {
    const response = await fetch(`${base}/api/v1${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${f[actor].token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const before = await request('sender', `/incidents/${f.incidentId}`);
  assert.equal(before.status, 200, 'Sender can read own incident');
  const record = before.body.data;
  assert.equal(record.intakeStage, 'PHAN_LOAI');
  const sent = await request('sender', `/incidents/${f.incidentId}/handoffs`, 'POST', {
    toTeamId: f.toTeamId, expectedUpdatedAt: record.updatedAt,
    requestKey: `browser-smoke-${Date.now()}`, reason: 'Synthetic local regression',
  });
  assert.equal(sent.status, 201, 'Send creates pending handoff');
  const handoff = sent.body.data;
  const pending = (await request('sender', `/incidents/${f.incidentId}`)).body.data;
  assert.equal(pending.intakeStage, 'CHO_NHAN');
  for (const key of ['id', 'code', 'status', 'ngayDeXuat', 'deadline']) {
    assert.equal(pending[key], record[key], `Send preserves ${key}`);
  }
  const rejected = await request('sender', `/incidents/${f.incidentId}/handoffs/${handoff.id}/accept`, 'POST', {
    expectedUpdatedAt: pending.updatedAt, expectedHandoffUpdatedAt: handoff.updatedAt,
  });
  assert.equal(rejected.status, 403, 'Sender cannot accept as target member');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Ho_Chi_Minh' });
    await context.addInitScript(({ token, user }) => {
      if (location.origin === 'http://127.0.0.1:5179') {
        sessionStorage.setItem('accessToken', token);
        sessionStorage.setItem('authProfile', JSON.stringify(user));
      }
    }, f.receiver);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/vu-viec/cho-nhan`);
    await page.getByRole('heading', { name: 'Vụ việc chờ nhận' }).waitFor();
    const row = page.getByRole('row').filter({ hasText: f.code });
    await row.waitFor();
    await page.screenshot({ path: path.join(evidence, 'inbox-pending.png'), fullPage: true });
    await row.getByRole('button', { name: 'Xác nhận nhận' }).click();
    await page.waitForURL(`${base}/vu-viec/${f.incidentId}`);
    await page.getByText('Đã nhận xử lý', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(evidence, 'incident-accepted.png'), fullPage: true });
    assert.deepEqual(errors, [], 'No browser crashes in handoff journey');
    const received = (await request('receiver', `/incidents/${f.incidentId}`)).body.data;
    assert.equal(received.intakeStage, 'DA_NHAN');
    assert.equal(received.assignedTeamId, f.toTeamId);
    for (const key of ['id', 'code', 'status', 'ngayDeXuat', 'deadline']) {
      assert.equal(received[key], record[key], `Accept preserves ${key}`);
    }
    const remaining = await request('receiver', '/incidents/handoffs/inbox');
    assert.equal(remaining.body.data.some(x => x.id === handoff.id), false);
    fs.writeFileSync(path.join(evidence, 'smoke-result.json'), JSON.stringify({
      timestamp: new Date().toISOString(), verdict: 'PASS', target: base,
      cases: ['send stays pending', 'identity/legal dates preserved', 'wrong team denied', 'actual browser accepts', 'inbox removes accepted'],
    }, null, 2));
    console.log('PASS: local API + browser handoff journey, synthetic fixtures only');
    await context.close();
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
