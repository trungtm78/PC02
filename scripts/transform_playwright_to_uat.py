#!/usr/bin/env python3
"""
Transform Playwright JSON output -> format cho write_results_to_excel.py
TC-001-API: -> TC-001 (api layer)
TC-DN-E2E-013: -> TC-013 (e2e layer)
"""
import json, re, sys

ANSI_RE = re.compile(r'\x1b\[[0-9;]*m')

def extract_tc_id(title):
    m = re.match(r'^(TC-\d+)-API:', title)
    if m:
        return m.group(1), 'api'
    m = re.match(r'^(TC-\d+)-E2E:', title)
    if m:
        return m.group(1), 'e2e'
    m = re.match(r'^TC-DN-E2E-(\d+):', title)
    if m:
        return 'TC-' + m.group(1), 'e2e'
    return None, None

def walk(suites, file_path=''):
    tests = []
    for suite in suites:
        fp = suite.get('file', file_path)
        for sub in suite.get('suites', []):
            tests.extend(walk([sub], fp))
        for spec in suite.get('specs', []):
            title = spec.get('title', '')
            tc_id, layer = extract_tc_id(title)
            if not tc_id:
                continue
            for t in spec.get('tests', []):
                result = t.get('results', [{}])[0]
                status = 'passed' if t.get('ok') else result.get('status', 'failed')
                err = ''
                for r in t.get('results', []):
                    for e in r.get('errors', []):
                        raw = e.get('message', '') or e.get('value', '') or ''
                        err = ANSI_RE.sub('', raw)[:300]
                        break
                    if err:
                        break
                tests.append({
                    'tc_id': tc_id,
                    'title': title,
                    'file': fp,
                    'layer': layer,
                    'status': status,
                    'duration_ms': result.get('duration', 0),
                    'error_message': err,
                })
    return tests

if __name__ == '__main__':
    input_file = sys.argv[1] if len(sys.argv) > 1 else 'test-results/results-docnum-clean.json'
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'test-results/results-for-excel.json'

    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    tests = walk(data.get('suites', []))

    passed = sum(1 for t in tests if t['status'] == 'passed')
    failed = sum(1 for t in tests if t['status'] == 'failed')
    api_count = sum(1 for t in tests if t['layer'] == 'api')
    e2e_count = sum(1 for t in tests if t['layer'] == 'e2e')

    print(f'Extracted {len(tests)} tests (API={api_count}, E2E={e2e_count})')
    print(f'  passed={passed}, failed={failed}')

    out = {'tests': tests}
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'Saved: {output_file}')
