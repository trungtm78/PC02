"""
Flatten Playwright JSON results (suites tree) → write_results_to_excel.py format (flat tests[]).
Strips -API / -E2E suffix from TC title to match Excel tc_id.

Usage: python flatten_pw_results.py <api_json> <e2e_json> <output_flat_json>
"""
import json
import re
import sys


def parse_pw_json(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        raw = f.read()
    raw = re.sub(r'\x1b\[[0-9;]*m', '', raw)
    m = re.search(r'\{', raw)
    if not m:
        raise ValueError(f"No JSON found in {filepath}")
    return json.loads(raw[m.start():])


def flatten_tests(data, layer):
    tests = []

    def walk(suites):
        for suite in suites:
            for spec in suite.get('specs', []):
                title = spec.get('title', '')
                # Extract TC ID: 'TC-CASE-001-API: ...' -> 'TC-CASE-001'
                tc_raw = title.split(':')[0].strip()
                tc_id = re.sub(r'-(API|E2E)$', '', tc_raw, flags=re.IGNORECASE)

                for t in spec.get('tests', []):
                    results = t.get('results', [{}])
                    r = results[0] if results else {}
                    status = r.get('status', 'skipped')

                    # Extract error message
                    err = ''
                    for att in r.get('attachments', []):
                        if att.get('name') == 'error message':
                            err = str(att.get('body', ''))[:300]
                    if not err:
                        errs = r.get('errors', [])
                        if errs:
                            err = str(errs[0].get('message', ''))[:300]

                    tests.append({
                        'tc_id': tc_id,
                        'title': title,
                        'status': status,
                        'layer': layer,
                        'duration_ms': r.get('duration', 0),
                        'error_message': err,
                        'file': suite.get('file', ''),
                    })

            walk(suite.get('suites', []))

    walk(data.get('suites', []))
    return tests


def main():
    api_file, e2e_file, output_file = sys.argv[1], sys.argv[2], sys.argv[3]

    api_data = parse_pw_json(api_file)
    e2e_data = parse_pw_json(e2e_file)

    tests = flatten_tests(api_data, 'api') + flatten_tests(e2e_data, 'e2e')

    passed = sum(1 for t in tests if t['status'] == 'passed')
    failed = sum(1 for t in tests if t['status'] == 'failed')
    skipped = len(tests) - passed - failed

    print(f"Flattened: total={len(tests)} pass={passed} fail={failed} skip={skipped}")
    print(f"Sample tc_ids: {[t['tc_id'] for t in tests[:3]]}")

    merged = {
        'tests': tests,
        'stats': {'expected': passed, 'unexpected': failed, 'skipped': skipped},
    }
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    print(f"Saved: {output_file}")


if __name__ == '__main__':
    main()
