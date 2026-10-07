const fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../../backend/src/admin/admin.service.ts');
let source=fs.readFileSync(file,'utf8');
for (const [method,next,actor,insertion] of [
  ['createDataAccessGrant','revokeDataAccessGrant','granterId',"await guardCaseAuthority(tx,granterId,{ targetUserId: dto.granteeId,destinationTeamId: dto.teamId });"],
  ['revokeDataAccessGrant','listDataAccessGrants','revokerId',"await guardCaseAuthority(tx,revokerId,{ targetUserId: grant.granteeId,destinationTeamId: grant.teamId });"],
]) {
  const start=source.indexOf(`  async ${method}(`),end=source.indexOf(`  async ${next}(`,start);
  let chunk=source.slice(start,end);
  if(chunk.includes('authorityTransaction(')) continue;
  const body=chunk.indexOf('  ) {')+5;
  chunk=chunk.slice(0,body)+`\n    return authorityTransaction(this.prisma,async tx => {\n${method==='createDataAccessGrant'?insertion:''}\n`+chunk.slice(body);
  chunk=chunk.replaceAll('this.prisma.','tx.');
  if(method==='revokeDataAccessGrant') chunk=chunk.replace("if (!grant) throw new NotFoundException('Quyền truy cập không tồn tại');","if (!grant) throw new NotFoundException('Quyền truy cập không tồn tại');\n"+insertion);
  chunk=chunk.replace('      ...meta,\n    });','      ...meta,\n    },tx);');
  const close=chunk.lastIndexOf('\n  }');
  chunk=chunk.slice(0,close)+'\n    });'+chunk.slice(close);
  source=source.slice(0,start)+chunk+source.slice(end);
}
fs.writeFileSync(file,source);
