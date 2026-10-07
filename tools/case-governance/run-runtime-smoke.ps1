$ErrorActionPreference = 'Stop'
$env:CASE_UAT_RUNTIME = 'C:/Users/THANMI~1/AppData/Local/Temp/pc02-incident-uat-e0028f5b5f8c421388a6ca3fc5d1e90e'
try {
  & rtk proxy node tools/case-governance/runtime-smoke.cjs
  exit $LASTEXITCODE
} finally {
  Remove-Item Env:CASE_UAT_RUNTIME
}
