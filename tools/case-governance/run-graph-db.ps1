$ErrorActionPreference='Continue'
$taskPassword=([IO.File]::ReadAllText('C:/Users/THANMI~1/AppData/Local/Temp/pc02-incident-uat-e0028f5b5f8c421388a6ca3fc5d1e90e/password.txt')).Trim()
$env:CASE_GOVERNANCE_UAT_DATABASE_URL='postgresql://pc02_uat:'+([Uri]::EscapeDataString($taskPassword))+'@127.0.0.1:55441/pc02_case_governance_uat'
try{
 & rtk proxy npx jest src/reports/graph-access/graph-access.database.spec.ts --runInBand --silent --json --outputFile=../docs/test-evidence/case-governance/graph-access-db.json *> ../docs/test-evidence/case-governance/graph-access-db.log
 $testExit=$LASTEXITCODE
 & rtk proxy node ../tools/case-governance/graph-test-summary.cjs ../docs/test-evidence/case-governance/graph-access-db.json
 exit $testExit
}finally{Remove-Item Env:CASE_GOVERNANCE_UAT_DATABASE_URL;$taskPassword=$null}
