#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convert Playwright JSON reporter output → flat format cho write_results_to_excel.py.

Playwright tree:
  stats, suites[].suites[].specs[].title='TC-XXX: ...', tests[].results[].status

Output:
  {"tests": [{"tc_id":"TC-XXX", "status":"passed", "title":"...", "duration":..., "error":"..."}]}
"""
import json
import re
import sys

inp = sys.argv[1]
out = sys.argv[2]

d = json.load(open(inp, encoding='utf-8'))
tests = []

def walk(suite):
    for sub in suite.get('suites', []):
        walk(sub)
    for spec in suite.get('specs', []):
        title = spec.get('title', '')
        m = re.match(r'^(TC-\d+)', title)
        if not m:
            continue
        tc_id = m.group(1)
        # First result (no retries in our config)
        for t in spec.get('tests', []):
            for r in t.get('results', []):
                status = r.get('status', 'unknown')
                duration = r.get('duration', 0)
                errors = r.get('errors', []) or []
                error_msg = ''
                if errors:
                    error_msg = (errors[0].get('message', '') or '').replace('\n', ' ')[:500]
                tests.append({
                    'tc_id': tc_id,
                    'status': status,
                    'title': title,
                    'duration_ms': duration,
                    'error': error_msg,
                })

for s in d.get('suites', []):
    walk(s)

stats = d.get('stats', {})
out_data = {
    'stats': {
        'total': len(tests),
        'passed': stats.get('expected', 0),
        'failed': stats.get('unexpected', 0),
        'skipped': stats.get('skipped', 0),
        'duration_s': stats.get('duration', 0) / 1000,
    },
    'tests': tests,
}

with open(out, 'w', encoding='utf-8') as f:
    json.dump(out_data, f, ensure_ascii=False, indent=2)

print(f"Converted {len(tests)} tests → {out}")
print(f"Stats: {out_data['stats']}")
