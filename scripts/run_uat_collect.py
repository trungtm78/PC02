#!/usr/bin/env python3
"""
Run Playwright tests and collect pass/fail results per TC, bypassing RTK.
Writes a results JSON for write_results_to_excel.py.
"""
import subprocess, sys, re, json, os
from pathlib import Path

ANSI = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')

# Spec files to run
SPEC_FILES = [
    'tests/api/document-numbers-uat.api.spec.ts',
    'tests/api/document-numbers-uat-2.api.spec.ts',
    'tests/api/document-numbers-uat-3.api.spec.ts',
    'tests/e2e/document-numbers-uat-2.e2e.spec.ts',
]

TC_API_RE  = re.compile(r'^(TC-\d+)-API:', re.IGNORECASE)
TC_E2E_RE  = re.compile(r'^TC-DN-E2E-(\d+):', re.IGNORECASE)
TC_E2E_RE2 = re.compile(r'^(TC-\d+)-E2E:', re.IGNORECASE)


def extract_tc(title):
    title = ANSI.sub('', title).strip()
    m = TC_API_RE.match(title)
    if m:
        return m.group(1), 'api'
    m = TC_E2E_RE.match(title)
    if m:
        return f'TC-{m.group(1)}', 'e2e'
    m = TC_E2E_RE2.match(title)
    if m:
        return m.group(1), 'e2e'
    return None, None


def run_spec(spec_file, env):
    # On Windows, use npx.cmd; on Unix, use npx
    npx_cmd = 'npx.cmd' if sys.platform == 'win32' else 'npx'
    cmd = [
        npx_cmd, 'playwright', 'test', spec_file,
        '--project=chromium',
        '--reporter=line',
        '--timeout=45000',
    ]
    print(f'\n=== Running {spec_file} ===', flush=True)
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        env=env, cwd=str(Path(__file__).parent.parent),
        text=True, encoding='utf-8', errors='replace'
    )
    lines = []
    for line in proc.stdout:
        lines.append(line)
        # Print progress
        clean = ANSI.sub('', line).rstrip()
        if clean.strip():
            print(f'  {clean[:100]}', flush=True)
    proc.wait()
    return lines


def parse_results(lines):
    """
    Parse line reporter output to determine which TCs passed/failed.
    Line reporter: each test shows [N/T] [project] › file:line:col › suite › title
    Failed tests also appear as:
      N) [project] › file › suite › title
        Error: ...
    """
    results = {}  # tc_id -> {layer, status, error}

    # First pass: all tests that appear in the run output
    for line in lines:
        clean = ANSI.sub('', line)
        # Progress lines: [N/T] [chromium] › ... › TITLE
        m = re.search(r'›\s+([^\n]+?)$', clean)
        if m and '›' in clean:
            title = m.group(1).strip()
            tc_id, layer = extract_tc(title)
            if tc_id and tc_id not in results:
                results[tc_id] = {'layer': layer, 'status': 'passed', 'error': ''}

    # Second pass: collect failures
    in_failure = False
    fail_title = ''
    fail_error_lines = []
    for line in lines:
        clean = ANSI.sub('', line)
        # Failure block: "  N) [chromium] › ... › TITLE"
        fm = re.match(r'\s+\d+\)\s+\[chromium\]\s+›.*›\s+([^\n]+?)$', clean)
        if fm:
            if fail_title:
                tc_id, layer = extract_tc(fail_title)
                if tc_id:
                    results[tc_id] = {
                        'layer': layer,
                        'status': 'failed',
                        'error': ' '.join(fail_error_lines[:3])[:300]
                    }
            fail_title = fm.group(1).strip()
            fail_error_lines = []
            in_failure = True
            continue
        if in_failure:
            stripped = clean.strip()
            if stripped.startswith('Error:') or stripped.startswith('expect(') or 'at ' in stripped:
                fail_error_lines.append(stripped[:120])
            elif re.match(r'\s*\d+\)\s+\[', clean) or re.match(r'\s+\d+ (passed|failed)', clean):
                if fail_title:
                    tc_id, layer = extract_tc(fail_title)
                    if tc_id:
                        results[tc_id] = {
                            'layer': layer,
                            'status': 'failed',
                            'error': ' '.join(fail_error_lines[:3])[:300]
                        }
                fail_title = ''
                fail_error_lines = []
                in_failure = bool(re.match(r'\s+\d+\)\s+\[', clean))

    if fail_title:
        tc_id, layer = extract_tc(fail_title)
        if tc_id:
            results[tc_id] = {
                'layer': layer,
                'status': 'failed',
                'error': ' '.join(fail_error_lines[:3])[:300]
            }

    return results


def main():
    out_file = sys.argv[1] if len(sys.argv) > 1 else 'test-results/results-for-excel.json'

    env = os.environ.copy()
    env['UAT_PROD'] = '1'

    all_results = {}
    for spec in SPEC_FILES:
        lines = run_spec(spec, env)
        spec_results = parse_results(lines)
        print(f'  -> Extracted {len(spec_results)} TCs')
        all_results.update(spec_results)

    tests = []
    for tc_id, info in sorted(all_results.items()):
        tests.append({
            'tc_id': tc_id,
            'title': '',
            'file': '',
            'layer': info['layer'],
            'status': info['status'],
            'duration_ms': 0,
            'error_message': info.get('error', ''),
        })

    passed = sum(1 for t in tests if t['status'] == 'passed')
    failed = sum(1 for t in tests if t['status'] == 'failed')
    api_count = sum(1 for t in tests if t['layer'] == 'api')
    e2e_count = sum(1 for t in tests if t['layer'] == 'e2e')
    print(f'\n=== SUMMARY ===')
    print(f'Total TCs: {len(tests)} (API={api_count}, E2E={e2e_count})')
    print(f'Passed: {passed}, Failed: {failed}')

    out = {'tests': tests}
    Path(out_file).parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'Saved: {out_file}')


if __name__ == '__main__':
    main()
