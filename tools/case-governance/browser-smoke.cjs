const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
async function main() {
  const root = path.resolve(__dirname, '../..');
  const runtime = path.resolve(process.env.CASE_UAT_RUNTIME || '');
  assert.ok(runtime.includes('pc02-incident-uat-'));
  const fixture = JSON.parse(fs.readFileSync(path.join(runtime, 'case-browser-fixture.json'), 'utf8'));
  assert.equal(fixture.synthetic, true); assert.equal(fixture.frontend, 'http://127.0.0.1:5280');
  const out = path.join(root, 'docs/test-evidence/case-governance/private-db/browser-smoke');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const [name, viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(token => sessionStorage.setItem('accessToken', token), fixture.actors.author.accessToken);
      const page = await context.newPage();
      const pageErrors = [], failedApi = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('response', response => { if(response.url().includes('/api/v1/') && response.status() >= 500) failedApi.push({path:new URL(response.url()).pathname,status:response.status()}); });
      // The application has persistent SSE; network idle is not a page readiness oracle.
      await page.goto(fixture.frontend + '/cases/' + fixture.cases.normal.id, { waitUntil:'domcontentloaded', timeout:60000 });
      await page.getByText(fixture.namespace + ' synthetic dossier', { exact:true }).first().waitFor({ state:'visible', timeout:60000 });
      await page.screenshot({ path:path.join(out,name+'.png'),fullPage:true });
      const report = { viewport:name,urlPath:new URL(page.url()).pathname,title:await page.title(),bodyCharacters:(await page.locator('body').innerText()).length,pageErrors,failedApi,screenshot:name+'.png' };
      results.push(report); await context.close();
    }
  } finally { await browser.close(); }
  const report = {timestamp:new Date().toISOString(),kind:'Local technical rendering smoke on work-in-progress source; not functional UAT or final certification',synthetic:true,results};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  if(results.some(r=>r.pageErrors.length||r.failedApi.length)) process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
