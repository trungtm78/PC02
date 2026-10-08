const inventory = require('../../docs/requirements/case-governance/entrypoint-inventory.json');
for (const module of inventory.candidateModules) {
  const rows = inventory.rows.filter(row => row.module === module);
  console.log(module, rows.length, rows.map(row => row.handler).join(', '));
}
