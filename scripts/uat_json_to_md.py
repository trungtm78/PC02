"""
UAT JSON → Markdown converter cho 4 nghiệp vụ (Cases/Incidents/Petitions/UTDT).
Sinh Markdown format chuẩn cho Claude Code fix bug + reference.
Usage: python scripts/uat_json_to_md.py docs/uat/<feature>/uat.json
"""
import json
import sys
from pathlib import Path

def render(uat_path: str):
    with open(uat_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    meta = data['meta']
    feature = meta['feature']
    out = []
    out.append(f"# UAT — {feature.upper()}\n")
    out.append(f"**Tổng TC**: {meta['total_tc']}/{meta['target_tc']} | **Mode**: {meta['mode']} | **Generated**: {meta['generated_at']}\n")
    out.append("## Phân bố loại TC\n")
    out.append("| Loại | Số TC | Tỷ lệ |")
    out.append("|------|-------|-------|")
    total = meta['total_tc']
    for t, n in sorted(meta['type_distribution'].items(), key=lambda x: -x[1]):
        out.append(f"| {t} | {n} | {n/total*100:.1f}% |")
    out.append("")
    out.append("## Phân bố priority\n")
    out.append("| Priority | Số TC | Tỷ lệ |")
    out.append("|----------|-------|-------|")
    for p, n in sorted(meta['priority_distribution'].items()):
        out.append(f"| {p} | {n} | {n/total*100:.1f}% |")
    out.append("")
    # Self-audit gate
    gd = meta['type_distribution']
    out.append("## Self-Audit Gate (LEAN 5 checkpoints)\n")
    checks = [
        ("TC count ≥ target", total >= meta['target_tc']),
        ("GREEN ≤ 20%", gd.get('GREEN',0)/total <= 0.20),
        ("RED ≥ 40%", gd.get('RED',0)/total >= 0.40),
        ("12 loại có ≥ 1 case", all(gd.get(t,0)>=1 for t in ['GREEN','RED','EDGE','BOUNDARY','EP','STATE','DECISION','SECURITY','DATA','PERFORMANCE','A11Y','COMPAT'])),
        ("Fixture có setup+cleanup", all('setup_recipe' in fx and 'cleanup_recipe' in fx for fx in data.get('data_fixtures', [])))
    ]
    for label, passed in checks:
        out.append(f"- {'✅' if passed else '❌'} {label}")
    out.append("")
    # Data fixtures
    out.append("## Data Fixtures\n")
    for fx in data.get('data_fixtures', []):
        out.append(f"### `{fx['fixture_id']}`")
        if 'ref' in fx:
            out.append(f"**Ref**: `{fx['ref']}`")
        out.append(f"**Setup**: {fx['setup_recipe']}")
        out.append(f"**Cleanup**: {fx['cleanup_recipe']}")
        outputs = fx.get('outputs', {})
        if outputs:
            out.append(f"**Outputs**: `{json.dumps(outputs, ensure_ascii=False)}`")
        out.append("")
    # Test cases by type
    out.append("## Test Cases\n")
    tcs_by_type = {}
    for tc in data['test_cases']:
        tcs_by_type.setdefault(tc['type'], []).append(tc)
    order = ['GREEN','RED','BOUNDARY','EP','EDGE','STATE','DECISION','SECURITY','DATA','A11Y','COMPAT','PERFORMANCE']
    for t in order:
        if t not in tcs_by_type:
            continue
        out.append(f"### {t} ({len(tcs_by_type[t])} TC)\n")
        out.append("| ID | Priority | Severity | Title | Endpoint | Role |")
        out.append("|----|----------|----------|-------|----------|------|")
        for tc in tcs_by_type[t]:
            title = tc['title'].replace('|','\\|')
            out.append(f"| **{tc['id']}** | {tc['priority']} | {tc['severity']} | {title} | `{tc['endpoint']}` | {tc['role']} |")
        out.append("")
        # Detail per TC
        for tc in tcs_by_type[t]:
            out.append(f"#### {tc['id']} — {tc['title']}")
            out.append(f"- **Type/Priority/Severity**: {tc['type']} / {tc['priority']} / {tc['severity']}")
            out.append(f"- **Endpoint**: `{tc['endpoint']}`")
            out.append(f"- **Role**: {tc['role']}")
            out.append(f"- **Pre**: {tc['pre']}")
            steps = tc['steps'].replace('\\n', '\n  ')
            out.append(f"- **Steps**:\n  {steps}")
            out.append(f"- **Expected**: {tc['expected']}")
            data_req = tc.get('data', [])
            if data_req:
                out.append(f"- **Data required**: `{', '.join(data_req)}`")
            out.append("")
    md_path = Path(uat_path).parent / f"uat_{feature}.md"
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))
    print(f"Markdown generated: {md_path} ({len(out)} lines)")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python uat_json_to_md.py <path-to-uat.json>")
        sys.exit(1)
    render(sys.argv[1])
