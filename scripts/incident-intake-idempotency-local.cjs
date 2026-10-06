const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { PrismaPg } = require('../backend/node_modules/@prisma/adapter-pg');
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55441'); assert.equal(url.pathname, '/pc02_incident_release_uat');
  const f = JSON.parse(fs.readFileSync(process.env.INCIDENT_BROWSER_FIXTURE, 'utf8'));
  const db = new PrismaClient({adapter:new PrismaPg({connectionString:url.toString()})});
  const base = 'http://127.0.0.1:5179/api/v1';
  try {
    const key = randomUUID(); const body = {name:randomUUID()+' — Tiếp nhận kiểm chứng'};
    const create = async endpoint => {
      const r = await fetch(base+endpoint,{method:'POST',headers:{Authorization:'Bearer '+f.sender.token,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});
      return {status:r.status,body:await r.json()};
    };
    const first = await create('/incidents/intake'); const retry = await create('/incidents/intake');
    assert.equal(first.status,201,JSON.stringify(first.body)); assert.equal(retry.status,201,JSON.stringify(retry.body));
    assert.equal(first.body.data.id,retry.body.data.id); assert.equal(first.body.data.intakeStage,'PHAN_LOAI');
    const cross = await create('/incidents'); assert.equal(cross.status,409);
    assert.equal(await db.incident.count({where:{createRequestKey:key}}),1);
    const row = await db.incident.findUniqueOrThrow({where:{id:first.body.data.id}});
    assert.equal(row.intakeStage,'PHAN_LOAI'); assert.equal(row.createRequestKey,key);
    const report={timestamp:new Date().toISOString(),verdict:'PASS',cases:['Real intake retry retains ID and PHAN_LOAI','Normal/intake same key conflicts','Only one dossier exists for key']};
    fs.writeFileSync('docs/test-evidence/incident-intake/continuation/intake-idempotency-uat.json',JSON.stringify(report,null,2));
    console.log('PASS: real intake idempotency and cross-mode guard');
  } finally { await db.$disconnect(); }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
