$ErrorActionPreference = 'Stop'
$taskPassword = ([IO.File]::ReadAllText('C:/Users/THANMI~1/AppData/Local/Temp/pc02-incident-uat-e0028f5b5f8c421388a6ca3fc5d1e90e/password.txt')).Trim()
$env:CASE_GOVERNANCE_UAT_DATABASE_URL = 'postgresql://pc02_uat:' + ([Uri]::EscapeDataString($taskPassword)) + '@127.0.0.1:55441/pc02_case_governance_uat'
try { & rtk proxy npx jest src/case-child-access/case-child-access.database.spec.ts --runInBand --json --outputFile=../docs/test-evidence/case-governance/child-private-db.json; exit $LASTEXITCODE }
finally { Remove-Item Env:CASE_GOVERNANCE_UAT_DATABASE_URL; $taskPassword = $null }
