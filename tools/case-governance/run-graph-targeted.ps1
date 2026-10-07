$ErrorActionPreference='Continue'
$log='../docs/test-evidence/case-governance/graph-access-fixture-targeted.log'
& rtk proxy npx jest src/shared/action-plans src/shared/vks-meetings src/notifications/notifications.service.spec.ts src/notifications/notification-event.service.spec.ts src/notifications/notification-push.scheduler.spec.ts src/document-templates/dynamic-export.service.spec.ts src/calendar/calendar.controller.spec.ts src/kpi/kpi.controller.spec.ts src/reports/tdac/tdac.service.spec.ts src/reports/reports.controller.spec.ts src/reports/phu-luc-1-6/phu-luc-1-6.controller.spec.ts --runInBand --silent --json --outputFile=../docs/test-evidence/case-governance/graph-access-fixture-targeted.json *> $log
$testExit=$LASTEXITCODE
& rtk proxy node ../tools/case-governance/graph-test-summary.cjs ../docs/test-evidence/case-governance/graph-access-fixture-targeted.json
exit $testExit
