const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(process.cwd(),'..'),dir=path.join(root,'docs/test-evidence/case-governance'),gate=process.argv[2];
const products=JSON.parse(fs.readFileSync(path.join(dir,'graph-access-products.json'),'utf8')).products;
const args=gate==='types'?['npx','tsc','--noEmit']:gate==='build'?['npm','run','build']:['npx',gate==='format'?'prettier':'eslint',...(gate==='format'?['--write']:[]),...products.map(p=>p.replace('backend/',''))];
const file=path.join(dir,'graph-access-'+gate+'.log'),log=fs.openSync(file,'w'),startedAt=new Date().toISOString();
const result=cp.spawnSync('rtk',['proxy',...args],{stdio:['ignore',log,log]});fs.closeSync(log);
const record={command:'rtk proxy '+args.join(' '),startedAt,completedAt:new Date().toISOString(),exitCode:result.status,log:path.basename(file)};
fs.writeFileSync(path.join(dir,'graph-access-'+gate+'.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record));if(result.status)console.log(fs.readFileSync(file,'utf8').slice(-7000));process.exit(result.status??1);
