const fs=require('node:fs'),path=require('node:path');
for(const [file,importPath] of [['backend/src/admin/admin.service.ts','./case-authority.guard'],['backend/src/auth/services/enrollment.service.ts','../../admin/case-authority.guard'],['backend/src/admin/bulk/bulk-import.processor.ts','../case-authority.guard']]){
  const p=path.resolve(__dirname,'../..',file);
  let source=fs.readFileSync(p,'utf8');
  if(source.includes('authorityTransaction')) continue;
  if(source.includes('import { guardCaseAuthority }')) source=source.replace('import { guardCaseAuthority }','import { guardCaseAuthority, authorityTransaction }');
  else source=`import { authorityTransaction } from '${importPath}';\n`+source;
  source=source.replaceAll('this.prisma.$transaction(', 'authorityTransaction(this.prisma, ');
  fs.writeFileSync(p,source);
}
