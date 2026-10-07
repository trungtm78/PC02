$ErrorActionPreference = 'Stop'
$taskPassword = ([IO.File]::ReadAllText('C:/Users/THANMI~1/AppData/Local/Temp/pc02-incident-uat-e0028f5b5f8c421388a6ca3fc5d1e90e/password.txt')).Trim()
$env:DATABASE_URL = 'postgresql://pc02_uat:' + ([Uri]::EscapeDataString($taskPassword)) + '@127.0.0.1:55441/pc02_case_governance_uat'
$env:CASE_UAT_RUNTIME = 'C:/Users/THANMI~1/AppData/Local/Temp/pc02-incident-uat-e0028f5b5f8c421388a6ca3fc5d1e90e'
try {
  & rtk proxy node tools/case-governance/verify-private-migration.cjs --verify-latest
  exit $LASTEXITCODE
} finally {
  Remove-Item Env:DATABASE_URL
  Remove-Item Env:CASE_UAT_RUNTIME
  $taskPassword = $null
}
