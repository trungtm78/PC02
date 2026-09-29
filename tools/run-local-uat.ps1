param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $PlaywrightArgs
)

$ErrorActionPreference = 'Stop'
$env:UAT_PROD = '1'
$env:BASE_URL = 'http://localhost:5179'
$env:UAT_API_URL = 'http://127.0.0.1:3000/api/v1'
# Playwright enables coloured reporter output. Keeping NO_COLOR at the same
# time makes Node emit one warning per worker and hides real warning regressions.
Remove-Item Env:NO_COLOR -ErrorAction SilentlyContinue

if ($PlaywrightArgs.Count -eq 0) {
  $PlaywrightArgs = @('--project=e2e-chromium', '--reporter=line')
}

& node node_modules/@playwright/test/cli.js test @PlaywrightArgs
exit $LASTEXITCODE
