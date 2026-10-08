const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const runtime = path.resolve(process.env.CASE_UAT_RUNTIME || '');
assert.ok(runtime.includes('pc02-incident-uat-'));
assert.ok(!runtime.toLowerCase().startsWith(root.toLowerCase()));
const side = process.argv[2];
assert.ok(['backend','frontend'].includes(side));
const built = process.argv.includes('--built');
assert.ok(!built || side === 'backend', '--built is a backend-only runtime option');
const pidFile = path.join(runtime, 'case-' + side + '-pid.json');
if (fs.existsSync(pidFile)) throw new Error('Existing runtime ownership record; inspect before restarting');
const env = { ...process.env };
let argv, cwd;
if (side === 'backend') {
  const db = new URL(env.DATABASE_URL || '');
  assert.equal(db.hostname, '127.0.0.1'); assert.equal(db.port, '55441');
  assert.equal(db.pathname, '/pc02_case_governance_uat');
  Object.assign(env, { PORT: '3001', NODE_ENV: 'development', CORS_ORIGIN: 'http://127.0.0.1:5280,http://localhost:5280', JWT_PRIVATE_KEY_PATH: path.join(runtime, 'jwt-private.pem'), JWT_PUBLIC_KEY_PATH: path.join(runtime, 'jwt-public.pem') });
  const preload = path.join(runtime, 'case-loopback-only.cjs');
  fs.writeFileSync(preload, `const net=require('node:net');const original=net.Server.prototype.listen;net.Server.prototype.listen=function(...args){if(typeof args[0]==='number'||typeof args[0]==='string'&&/^\\d+$/.test(args[0])){if(typeof args[1]==='function')args.splice(1,0,'127.0.0.1');else args[1]='127.0.0.1';}return original.apply(this,args);};\n`);
  cwd = path.join(root, 'backend');
  if (built) {
    const entries = ['dist/src/main.js','dist/main.js'].filter(entry => fs.existsSync(path.join(cwd,entry)));
    assert.equal(entries.length,1,'Build must produce exactly one unambiguous compiled entrypoint');
    argv = ['-r',preload,entries[0]];
  } else argv = ['-r', preload, '-r', './node_modules/ts-node/register/transpile-only', 'src/main.ts'];
} else {
  const runner = path.join(runtime, 'case-vite-preview.mjs');
  const vite = require('node:url').pathToFileURL(path.join(root, 'frontend/node_modules/vite/dist/node/index.js')).href;
  fs.writeFileSync(runner, `import {createServer} from ${JSON.stringify(vite)};const server=await createServer({root:${JSON.stringify(path.join(root,'frontend'))},configFile:${JSON.stringify(path.join(root,'frontend/vite.config.ts'))},server:{host:'127.0.0.1',port:5280,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:3001',changeOrigin:true}}}});await server.listen();server.printUrls();\n`);
  argv = [runner]; cwd = path.join(root, 'frontend');
}
const log = fs.openSync(path.join(runtime, 'case-' + side + '.log'), 'a');
const child = spawn(process.execPath, argv, { cwd, env, detached: true, windowsHide: true, stdio: ['ignore',log,log] });
child.unref(); fs.closeSync(log);
const ownership = { side, pid: child.pid, timestamp: new Date().toISOString(), cwd, argv, host: '127.0.0.1', port: side === 'backend' ? 3001 : 5280, privateSyntheticOnly: true, compiledBackend: built, purpose: built ? 'Compiled backend for private synthetic runtime checks; final verdict requires recorded checks' : 'Runtime setup; not final verification' };
fs.writeFileSync(pidFile, JSON.stringify(ownership, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ side, pid: child.pid, host: ownership.host, port: ownership.port, purpose: ownership.purpose }));
