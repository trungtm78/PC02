"""
Adapter: chuyển docs/uat/<feature>/uat.json → schema của generate_uat_excel.py.

uat.json schema (uat-test-writer):
  meta.feature, test_cases[].{id, type, priority, severity, endpoint, role, title,
                               pre, steps, expected, data}

generate_uat_excel.py schema:
  feature_name, test_cases[].{tc_id, type, priority, module, title, requirement,
                               risk_level, technique, preconditions, steps,
                               test_data, expected_ui, expected_api, expected_side,
                               severity_if_fail, notes}

Usage:
    python scripts/uat_json_to_excel_input.py <feature>
    → docs/uat/<feature>/uat_excel_input.json
"""
import json
import sys
from pathlib import Path

FEATURE_MODULES = {
    'cases': {
        'GREEN': 'Tạo/Xem vụ án',
        'RED': 'Validation & Auth',
        'BOUNDARY': 'Boundary Values',
        'EP': 'Equivalence Partition',
        'EDGE': 'Edge Cases',
        'STATE': 'State Transition',
        'DECISION': 'Decision Table',
        'SECURITY': 'Bảo mật & IDOR',
        'DATA': 'Data & i18n',
        'A11Y': 'Accessibility',
        'COMPAT': 'Compatibility',
        'PERFORMANCE': 'Hiệu năng',
    },
    'incidents': {
        'GREEN': 'Tạo/Xem vụ việc',
        'RED': 'Validation & Auth',
        'BOUNDARY': 'Boundary Values',
        'EP': 'Equivalence Partition',
        'EDGE': 'Edge Cases',
        'STATE': 'State Transition',
        'DECISION': 'Decision Table',
        'SECURITY': 'Bảo mật & IDOR',
        'DATA': 'Data & i18n',
        'A11Y': 'Accessibility',
        'COMPAT': 'Compatibility',
        'PERFORMANCE': 'Hiệu năng',
    },
    'petitions': {
        'GREEN': 'Tạo/Xem đơn thư',
        'RED': 'Validation & Auth',
        'BOUNDARY': 'Boundary Values',
        'EP': 'Equivalence Partition',
        'EDGE': 'Edge Cases',
        'STATE': 'State Transition',
        'DECISION': 'Decision Table',
        'SECURITY': 'Bảo mật & IDOR',
        'DATA': 'Data & i18n',
        'A11Y': 'Accessibility',
        'COMPAT': 'Compatibility',
        'PERFORMANCE': 'Hiệu năng',
    },
    'utdt': {
        'GREEN': 'Tạo/Xem UTDT',
        'RED': 'Validation & Auth',
        'BOUNDARY': 'Boundary Values',
        'EP': 'Equivalence Partition',
        'EDGE': 'Edge Cases',
        'STATE': 'Computed State',
        'DECISION': 'Decision Table',
        'SECURITY': 'Bảo mật & IDOR',
        'DATA': 'Data & i18n',
        'A11Y': 'Accessibility',
        'COMPAT': 'Compatibility',
        'PERFORMANCE': 'Hiệu năng',
    },
}

TECHNIQUE_MAP = {
    'GREEN': 'Black-box / Use case',
    'RED': 'Error guessing / BVA',
    'BOUNDARY': 'BVA (Boundary Value Analysis)',
    'EP': 'EP (Equivalence Partitioning)',
    'EDGE': 'Edge case exploration',
    'STATE': 'State Transition Testing',
    'DECISION': 'Decision Table Testing',
    'SECURITY': 'OWASP Top 10 / IDOR / Inject',
    'DATA': 'Data validation / i18n',
    'A11Y': 'WCAG 2.1 AA / Keyboard nav',
    'COMPAT': 'Cross-browser / Responsive',
    'PERFORMANCE': 'Load test / Latency',
}

RISK_MAP = {
    'P0': 'Cao',
    'P1': 'Cao',
    'P2': 'TB',
    'P3': 'Thấp',
}

def convert(feature: str, project_root: Path):
    src = project_root / 'docs' / 'uat' / feature / 'uat.json'
    dst = project_root / 'docs' / 'uat' / feature / 'uat_excel_input.json'
    with open(src, 'r', encoding='utf-8') as f:
        data = json.load(f)

    modules = FEATURE_MODULES.get(feature, {})
    converted_tcs = []
    for tc in data['test_cases']:
        tc_type = tc.get('type', 'GREEN')
        priority = tc.get('priority', 'P2')
        expected = tc.get('expected', '')
        converted_tcs.append({
            'tc_id': tc['id'],
            'type': tc_type,
            'priority': priority,
            'module': modules.get(tc_type, tc_type),
            'title': tc['title'],
            'requirement': f"REQ-{feature.upper()}-{tc_type}",
            'risk_level': RISK_MAP.get(priority, 'TB'),
            'technique': TECHNIQUE_MAP.get(tc_type, 'Black-box'),
            'preconditions': tc.get('pre', '-'),
            'steps': tc.get('steps', ''),
            'test_data': ', '.join(tc.get('data', [])),
            'data_required': ', '.join(tc.get('data', [])),
            'expected_ui': expected if tc_type in ('A11Y', 'COMPAT', 'GREEN') else '',
            'expected_api': expected if tc_type not in ('A11Y', 'COMPAT') else '',
            'expected_side': f"Endpoint: {tc.get('endpoint', '-')} | Role: {tc.get('role', '-')}",
            'severity_if_fail': tc.get('severity', 'Medium'),
            'notes': f"Type: {tc_type} | Endpoint: {tc.get('endpoint', '-')}",
        })

    # Build test_data section from data_fixtures
    fixtures = data.get('data_fixtures', [])
    accounts = [
        {'role': f.get('outputs', {}).get('role', ''), 'email': f['fixture_id'],
         'password': '(see _shared/test-accounts.json)', 'note': f.get('setup_recipe', '')[:80]}
        for f in fixtures if 'account' in f['fixture_id']
    ]

    output = {
        'feature_name': feature,
        'complexity': 'complex',
        'test_cases': converted_tcs,
        'test_data': {
            'accounts': accounts,
            'boundary_values': [
                {'field': 'name/senderName', 'min': '5', 'max': '255', 'invalid': '0, 256+'},
                {'field': 'reason (delete)', 'min': '10', 'max': '500', 'invalid': '0-9, 501+'},
            ],
            'payloads': [
                {'type': 'XSS', 'value': "<script>alert(1)</script>"},
                {'type': 'SQLi', "value": "'; DROP TABLE --"},
                {'type': 'NoSQL', 'value': '{"$gt": ""}'},
            ],
        },
        'scope': {
            'in_scope': [f'{feature} CRUD', 'Auth/AuthZ', 'Business rules', 'State transitions'],
            'out_of_scope': ['Other features', 'Infrastructure', 'DB migrations'],
            'exit_criteria': 'GREEN ≤20%, RED ≥40%, SECURITY ≥10%, P0 pass rate ≥80%',
        },
    }
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"  Converted: {dst.name} ({len(converted_tcs)} TC)")
    return dst

if __name__ == '__main__':
    root = Path(__file__).parent.parent
    features = sys.argv[1:] or ['cases', 'incidents', 'petitions', 'utdt']
    for feat in features:
        print(f"Converting {feat}...")
        convert(feat, root)
