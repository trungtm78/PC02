"""Compute executable changed-line coverage and source hashes, without git mutations."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'docs/test-evidence/case-governance'
coverage_directory = sys.argv[1] if len(sys.argv) > 1 else 't4-final-coverage'
coverage = json.loads((REPORT / coverage_directory / 'coverage-final.json').read_text(encoding='utf-8'))
reused_sources = []
if len(sys.argv) == 1:
    coverage.update(json.loads((REPORT / 't4-final-delta-coverage/coverage-final.json').read_text(encoding='utf-8')))
else:
    hash_manifest = sys.argv[2] if len(sys.argv) > 2 else 't4-first-review-source-hashes.json'
    frozen_hashes = {row['path']: row['sha256'] for row in json.loads((REPORT / hash_manifest).read_text(encoding='utf-8'))}
    previous = json.loads((REPORT / 't4-final-coverage/coverage-final.json').read_text(encoding='utf-8'))
    previous.update(json.loads((REPORT / 't4-final-delta-coverage/coverage-final.json').read_text(encoding='utf-8')))
    if len(sys.argv) > 2:
        previous.update(json.loads((REPORT / 't4-round1-coverage/coverage-final.json').read_text(encoding='utf-8')))
    for key, value in previous.items():
        source = Path(key)
        if source.is_file() and source.is_relative_to(ROOT):
            name = source.relative_to(ROOT).as_posix()
            if key not in coverage and frozen_hashes.get(name) == hashlib.sha256(source.read_bytes()).hexdigest():
                coverage[key] = value
                reused_sources.append(name)
diff = subprocess.run(['rtk', 'proxy', 'git', 'diff', '--unified=0', '10030bed', '--', 'frontend/src'], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout
changes = {}
path = None
line = 0
for value in diff.splitlines():
    if value.startswith('+++ b/'):
        path = value[6:]
        changes.setdefault(path, set())
    elif value.startswith('@@'):
        match = re.search(r'\+(\d+)', value)
        line = int(match.group(1))
    elif value.startswith('+') and path:
        changes[path].add(line)
        line += 1
    elif not value.startswith('-') and not value.startswith('\\'):
        line += 1
for name in subprocess.run(['rtk', 'proxy', 'git', 'ls-files', '--others', '--exclude-standard', 'frontend/src'], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout.splitlines():
    if name.startswith('frontend/') and (ROOT / name).is_file():
        changes[name] = set(range(1, len((ROOT / name).read_text(encoding='utf-8').splitlines()) + 1))
rows = []
manifest = []
for name, changed in sorted(changes.items()):
    source = ROOT / name
    if not source.is_file() or '__tests__' in name or not name.endswith(('.ts', '.tsx')):
        continue
    manifest.append({'path': name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
    item = next((value for key, value in coverage.items() if Path(key).resolve() == source.resolve()), None)
    if not item:
        rows.append({'path': name, 'changedLines': len(changed), 'covered': 0, 'executable': 0, 'status': 'NOT_INSTRUMENTED'})
        continue
    # Smallest instrumented statement/function span determines execution for each line.
    candidates = {}
    for key, location in item['statementMap'].items():
        span = location['end']['line'] - location['start']['line']
        for number in range(location['start']['line'], location['end']['line'] + 1):
            if number in changed:
                candidates.setdefault(number, []).append((span, item['s'][key]))
    for key, function in item['fnMap'].items():
        location = function['loc']
        span = location['end']['line'] - location['start']['line']
        for number in range(location['start']['line'], location['end']['line'] + 1):
            if number in changed:
                candidates.setdefault(number, []).append((span, item['f'][key]))
    covered = 0
    missing = []
    for number, matches in candidates.items():
        smallest = min(span for span, _ in matches)
        hit = max(count for span, count in matches if span == smallest)
        if hit > 0:
            covered += 1
        else:
            missing.append(number)
    rows.append({'path': name, 'covered': covered, 'executable': len(candidates), 'uncoveredLines': sorted(missing), 'status': 'MEASURED'})
numerator = sum(row['covered'] for row in rows)
denominator = sum(row['executable'] for row in rows)
result = {'baseline': '10030bed', 'includesInheritedT2Changes': True, 'method': 'Changed lines intersected with raw Istanbul statement/function locations; smallest containing instrumented span, positive execution count.', 'covered': numerator, 'executable': denominator, 'percent': round(numerator * 100 / denominator, 4), 'files': rows}
result['freshCoverageDirectory'] = coverage_directory
result['hashMatchedReusedSources'] = sorted(reused_sources)
(REPORT / 't4-patch-coverage.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
(REPORT / 't4-source-hashes.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'PATCH {numerator}/{denominator} = {result["percent"]}%')
for row in rows:
    if row['status'] == 'NOT_INSTRUMENTED':
        print('NOT_INSTRUMENTED', row['path'])
