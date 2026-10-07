const fs = require('node:fs'),path = require('node:path');
for (const module of ['incidents','petitions']) {
  const file=path.resolve(__dirname,`../../backend/src/${module}/bulk/${module}.bulk.service.ts`);
  let source=fs.readFileSync(file,'utf8');
  const boundary=source.indexOf('  async bulkDelete(');
  const generic="prisma: this.prisma as unknown as {\n        $transaction: <R>(cb: (tx: Prisma.TransactionClient) => Promise<R>) => Promise<R>;\n      },";
  const wrapper="prisma: {\n        $transaction: <R>(cb: (tx: Prisma.TransactionClient) => Promise<R>) => this.caseBoundary.transaction(cb),\n      },";
  const before=source.slice(0,boundary).replace(wrapper,generic);
  const after=source.slice(boundary).replace(/prisma: this\.prisma as unknown as \{\s*\$transaction: <R>\(\s*cb: \(tx: Prisma\.TransactionClient\) => Promise<R>,?\s*\) => Promise<R>;\s*\},/,wrapper);
  if (!after.includes(wrapper)) throw new Error('Missing source deletion transaction boundary');
  fs.writeFileSync(file,before+after);
}
