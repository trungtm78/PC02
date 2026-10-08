param([ValidateSet('types','lint','build')][string]$Gate)
$ErrorActionPreference='Continue'
$evidence=Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'docs/test-evidence/case-governance'
$gateLog=Join-Path $evidence ('t1-core-finish-'+$Gate+'.log')
$startedAt=[DateTime]::UtcNow.ToString('o')
$arguments=switch($Gate) {
  'types' { @('npx','tsc','--noEmit') }
  'build' { @('npm','run','build') }
  'lint' { @('npx','eslint',
    'src/cases/governance/case-governance.service.ts','src/cases/governance/case-governance.contract.ts','src/cases/governance/case-governance.controller.ts',
    'src/cases/governance/case-global-capabilities.controller.ts','src/cases/governance/case-governance.module.ts','src/cases/governance/case-governance-foundation.module.ts',
    'src/cases/governance/case-field-policy.module.ts','src/cases/governance/case-principal-access.service.ts','src/cases/governance/case-principal-access.controller.ts',
    'src/cases/cases.service.ts','src/cases/cases.controller.ts','src/cases/cases.module.ts','src/cases/cases-journey.service.ts','src/cases/case-statistic.builder.ts',
    'src/cases/bulk/cases.bulk.service.ts','src/audit/audit.service.ts','src/audit/audit.controller.ts','src/audit/audit.module.ts','src/audit/case-audit-policy.service.ts',
    'src/common/utils/scope-filter.util.ts','src/common/utils/kiem-vu-an-cha.ts','src/common/bca-excel.helper.ts','src/common/bca-excel-footer.spec.ts',
    'src/cases/governance/case-governance.service.spec.ts','src/cases/governance/foundation-integration.spec.ts','src/cases/governance/foundation.database.spec.ts',
    'src/cases/cases-utdt-stats.service.spec.ts','src/cases/governance/schema-contract.spec.ts') }
}
& rtk proxy @arguments *> $gateLog
$gateExit=$LASTEXITCODE
$result=@{gate=$Gate;command=('rtk proxy '+($arguments -join ' '));startedAt=$startedAt;completedAt=[DateTime]::UtcNow.ToString('o');exitCode=$gateExit;log=[IO.Path]::GetFileName($gateLog)}
$result | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $evidence ('t1-core-finish-'+$Gate+'.json'))
Get-Content -LiteralPath $gateLog -Tail 35
$result | ConvertTo-Json -Compress
exit $gateExit
