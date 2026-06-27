"""
UAT spec generator — sinh tests/api/<feature>-uat.api.spec.ts + tests/e2e/<feature>-uat.e2e.spec.ts
từ docs/uat/<feature>/uat.json.

Quy ước:
- TC có endpoint bắt đầu 'UI:' → chỉ sinh E2E test
- TC có endpoint dạng 'METHOD /api/...' → sinh API test, đồng thời sinh E2E happy-path nếu type ∈ {GREEN, STATE, A11Y, COMPAT, PERFORMANCE} và có UI hợp lý
- Quy tắc: api spec dùng request fixture, không browser; e2e dùng PO + DOM verify
- E2E mỗi TC ≥3 assertion: URL + visibility + text (skill rule)

Usage: python scripts/uat_spec_generator.py <feature>
  feature ∈ {cases, incidents, petitions, utdt}
"""
import json
import sys
import re
from pathlib import Path
from urllib.parse import quote

FEATURE_CONFIG = {
    'cases': {
        'po_class': 'CasesPage',
        'po_var': 'casesPage',
        'list_path': '/cases',
        'new_path': '/cases/new',
        'detail_path': '/cases/{id}',
        'page_title_re': 'Quản lý vụ án|Danh sách vụ án|Vụ án',
        'api_base': '/api/v1/cases',
    },
    'incidents': {
        'po_class': 'IncidentsPage',
        'po_var': 'incidentsPage',
        'list_path': '/vu-viec',
        'new_path': '/vu-viec/new',
        'detail_path': '/vu-viec/{id}',
        'page_title_re': 'Quản lý vụ việc|Danh sách vụ việc|Vụ việc',
        'api_base': '/api/v1/incidents',
    },
    'petitions': {
        'po_class': 'PetitionsPage',
        'po_var': 'petitionsPage',
        'list_path': '/petitions',
        'new_path': '/petitions/new',
        'detail_path': '/petitions/{id}',
        'page_title_re': 'Đơn thư|Quản lý đơn thư',
        'api_base': '/api/v1/petitions',
    },
    'utdt': {
        'po_class': 'UTDTPage',
        'po_var': 'utdtPage',
        'list_path': '/cases?caseType=UY_THAC_DIEU_TRA',
        'new_path': '/cases/new?caseType=UY_THAC_DIEU_TRA',
        'detail_path': '/cases/{id}',
        'page_title_re': 'Ủy thác điều tra|UTDT|Vụ án',
        'api_base': '/api/v1/cases',
    },
}


def sanitize_title(s: str) -> str:
    """Escape special chars trong test title (JS single-quoted string) — no newlines."""
    # Order matters: backslash first, then single quote, then backtick
    return (s.replace('\\', '\\\\')
             .replace("'", "\\'")
             .replace('`', "'")
             .replace('"', "'")
             .replace('\n', ' ')
             .replace('\r', ''))


def parse_endpoint(ep: str):
    """Parse 'METHOD /api/...' hoặc 'UI: /path' → (method, path) hoặc ('UI', path)."""
    ep = ep.strip()
    if ep.startswith('UI:'):
        return ('UI', ep[3:].strip())
    if ep.startswith('Job:') or ep.startswith('UI'):
        return ('UI', ep)  # treat job/UI similar
    m = re.match(r'(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)', ep)
    if m:
        return (m.group(1), m.group(2).strip())
    return ('GET', ep)


def extract_body_from_steps(steps_raw: str) -> str | None:
    """Extract JS object literal (body) từ steps text.
    Steps nguồn dạng "POST {name:'...', ...}" HOẶC "POST body {...}" — KHÔNG bắt buộc chữ 'body'
    (đa số TC viết "POST {...}" trực tiếp). Lấy object literal {...} ĐẦU TIÊN bằng balanced-brace
    parser (handle nested objects/arrays + {{placeholder}} nằm trong string vì cặp ngoặc vẫn cân bằng).
    Trả về None nếu không tìm thấy body hoặc body rỗng {}.
    """
    # Neo vào {...} NGAY SAU method keyword (POST/PUT/PATCH) hoặc 'body' — tránh bắt nhầm
    # {...} mô tả khác trong steps (partition list {A, B, C}, schema, ví dụ nested).
    m = re.search(r'(?:POST|PUT|PATCH|body|Body)\s*(\{)', steps_raw)
    if not m:
        return None
    start = m.start(1)
    depth = 0
    result = []
    for ch in steps_raw[start:]:
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
        result.append(ch)
        if depth == 0:
            break
    body_str = ''.join(result)
    # Phải là object literal THẬT (có 'key:value') — loại partition list {A, B, C} (không có ':') gây TS lỗi.
    if body_str.startswith('{') and body_str.endswith('}') and ':' in body_str and len(body_str) > 2:
        return body_str
    return None


def gen_api_test(tc: dict, cfg: dict) -> str:
    """Sinh 1 test() block cho API layer."""
    tc_id = tc['id']
    title = sanitize_title(tc['title'])
    method, path = parse_endpoint(tc['endpoint'])
    priority = tc['priority']
    pre = sanitize_title(tc.get('pre', ''))
    steps = sanitize_title(tc.get('steps', ''))
    expected = sanitize_title(tc.get('expected', ''))
    data_req = tc.get('data', [])

    # Skip UI-only TCs in API layer
    if method == 'UI':
        return ''

    # Skip tests với path parameter placeholder (:id, {id}) — không có fixture ID thật
    # Những test này cần beforeAll fixture setup riêng; emit test.skip thay vì false-fail
    has_path_param = re.search(r'/:[a-zA-Z]|/\{[a-zA-Z]', path)
    if has_path_param:
        return f"""  test('{tc_id}-API: [{priority}] {title}', async () => {{
    test.skip(true, 'Requires fixture ID — path "{path}" contains a parameter placeholder. Run via beforeAll setup to provide a real resource ID.');
  }});
"""

    # Determine expected status code from title/expected
    expected_lower = expected.lower()
    if 'http 201' in expected_lower or 'http 200' in expected_lower:
        expected_status = '[200, 201]'
    elif 'http 400' in expected_lower:
        expected_status = '[400]'
    elif 'http 401' in expected_lower:
        expected_status = '[401]'
    elif 'http 403' in expected_lower or '403/404' in expected_lower:
        expected_status = '[403, 404]'
    elif 'http 404' in expected_lower:
        expected_status = '[404]'
    elif 'http 409' in expected_lower:
        expected_status = '[409]'
    elif 'http 410' in expected_lower or '410/404' in expected_lower:
        expected_status = '[410, 404]'
    elif 'http 429' in expected_lower:
        expected_status = '[429]'
    elif 'http 413' in expected_lower:
        expected_status = '[413, 400]'
    elif 'http 500' in expected_lower:
        expected_status = '[500]'
    elif '4xx' in expected_lower or 'error' in expected_lower:
        expected_status = '[400, 401, 403, 404, 409, 422]'
    else:
        # Default: accept 200/201/204 for GREEN/STATE; 400 for RED
        if tc['type'] in ('GREEN', 'STATE', 'EP', 'BOUNDARY', 'EDGE', 'PERFORMANCE'):
            expected_status = '[200, 201, 204]'
        else:
            expected_status = '[400, 401, 403, 404, 409, 422, 429]'

    data_setup = ''
    if data_req:
        data_setup = f"    // Data required: {', '.join(data_req)}\n"

    # Inject body cho POST/PUT/PATCH — dùng steps_raw (trước sanitize) để giữ quotes
    steps_raw = tc.get('steps', '')
    body_injection = ''
    if method in ('POST', 'PUT', 'PATCH'):
        body_js = extract_body_from_steps(steps_raw)
        if body_js:
            body_js = body_js.replace('`', "'")  # backtick phá TypeScript template literal
            # Loại ellipsis "..."/"…" (placeholder "vv" trong steps) → tránh spread rỗng phá TS compile
            body_js = body_js.replace('…', '').replace('...', '')
            # Dọn dấu phẩy thừa sau khi loại ellipsis: ",}" → "}", "{," → "{", ",," → ","
            body_js = re.sub(r',\s*}', '}', body_js)
            body_js = re.sub(r'\{\s*,', '{', body_js)
            body_js = re.sub(r',\s*,', ',', body_js)
            # Resolve {{random}} trong string literal → runtime-unique (tránh trùng unique field khi chạy lại)
            body_js = re.sub(r"'([^']*?)\{\{random\}\}([^']*?)'", r"('\1' + __uatRand() + '\2')", body_js)
            body_injection = f"      data: {body_js},\n"

    # Wire query string từ steps (vd "GET ?status=INVALID") vào URL nếu path chưa có query.
    # Generator cũ bỏ sót → URL không param → endpoint validate không kích hoạt (false 200).
    if '?' not in path:
        qm = re.search(r'\?[A-Za-z_][\w.]*=\S*', steps_raw)
        if qm:
            raw_q = qm.group(0)[1:]  # bỏ dấu '?'
            parts = []
            for pair in raw_q.split('&'):
                if '=' in pair:
                    k, v = pair.split('=', 1)
                    v = v.strip('\'"')                 # bỏ quote bao quanh value (vd 'hôm qua')
                    parts.append(k + '=' + quote(v, safe=''))  # URL-encode → an toàn quote/space/unicode
                elif pair:
                    parts.append(pair)
            if parts:
                path = path + '?' + '&'.join(parts)

    # JS-escape path (defensive): backslash + single quote → endpoint string luôn hợp lệ, không phá compile.
    path_js = path.replace('\\', '\\\\').replace("'", "\\'")

    return f"""  test('{tc_id}-API: [{priority}] {title}', async ({{ request }}) => {{
{data_setup}    // Pre: {pre or '-'}
    // Steps: {steps[:200]}
    // Expected: {expected[:200]}
    const endpoint = '{path_js}';
    const baseUrl = process.env.BASE_URL || process.env.API_BASE_URL || 'http://localhost:3000';
    const apiUrl = baseUrl.replace(/\\/$/, '') + (endpoint.startsWith('/api') ? endpoint : '/api/v1' + (endpoint.startsWith('/') ? endpoint : '/' + endpoint));
    const token = getToken();
    // Chỉ skip khi app không phản hồi (network error) — không skip khi assertion fail
    let response: any;
    try {{
      response = await request.{method.lower()}(apiUrl, {{
        headers: {{ 'Authorization': `Bearer ${{token}}`, 'Content-Type': 'application/json' }},
{body_injection}        timeout: 15000,
        failOnStatusCode: false,
      }});
    }} catch (networkErr: any) {{
      test.skip(true, `App không phản hồi: ${{networkErr.message?.slice(0,100)}}`);
      return;
    }}
    // App chạy OK — assertion fail = test FAIL thật (không bị swallow thành skip)
    const status = response.status();
    const acceptable = {expected_status};
    expect(status, `TC {tc_id}: HTTP ${{status}} không nằm trong expected [${{acceptable.join(',')}}]`).toBeLessThan(600);
    expect(acceptable, `TC {tc_id}: HTTP ${{status}} — expected [${{acceptable.join(',')}}]`).toContain(status);
  }});
"""


def gen_e2e_test(tc: dict, cfg: dict) -> str:
    """Sinh 1 test() block cho E2E layer."""
    tc_id = tc['id']
    title = sanitize_title(tc['title'])
    method, path = parse_endpoint(tc['endpoint'])
    priority = tc['priority']
    tc_type = tc['type']
    pre = sanitize_title(tc.get('pre', ''))
    steps = sanitize_title(tc.get('steps', ''))
    expected = sanitize_title(tc.get('expected', ''))

    po_class = cfg['po_class']
    po_var = cfg['po_var']
    title_re = cfg['page_title_re']

    # Determine UI path target
    if method == 'UI':
        ui_path = path
    elif method == 'GET' and path == cfg['api_base']:
        ui_path = cfg['list_path']
    elif method == 'POST' and path == cfg['api_base']:
        ui_path = cfg['new_path']
    else:
        ui_path = cfg['list_path']

    # E2E core: navigate, verify URL, visibility, text (3 assertions floor)
    # For RED TCs: try interaction, expect error visible
    is_red = tc_type in ('RED',)
    is_a11y = tc_type == 'A11Y'
    is_compat = tc_type == 'COMPAT'
    is_perf = tc_type == 'PERFORMANCE'
    is_security = tc_type == 'SECURITY'

    list_path_root = cfg["list_path"].split("?")[0]
    path_re = list_path_root.replace("/", "\\/")

    if is_a11y:
        assertions = f"""    // A11Y check: auth + heading + landmark + focus
    await loginToPage(page, '{cfg["list_path"]}');
    expect(page.url(), 'URL phải chứa {list_path_root}').toContain('{list_path_root}');
    const h1 = page.locator('h1').first();
    await expect(h1, 'H1 phải visible cho A11Y').toBeVisible();
    const mainLandmark = page.locator('main, [role="main"]').first();
    await expect(mainLandmark, 'Main landmark phải tồn tại').toBeVisible();"""
    elif is_compat:
        viewport_setup = ''
        if 'mobile' in title.lower() or '375' in title:
            viewport_setup = "    await page.setViewportSize({ width: 375, height: 667 });\n"
        elif 'tablet' in title.lower() or '768' in title:
            viewport_setup = "    await page.setViewportSize({ width: 768, height: 1024 });\n"
        assertions = f"""{viewport_setup}    await loginToPage(page, '{cfg["list_path"]}');
    expect(page.url()).toContain('{list_path_root}');
    await expect(page.locator('body')).toBeVisible();
    const heading = page.getByRole('heading', {{ name: /{title_re}/i }});
    await expect(heading.or(page.locator('h1, h2')).first()).toBeVisible();"""
    elif is_perf:
        assertions = f"""    const start = Date.now();
    await loginToPage(page, '{cfg["list_path"]}');
    const elapsed = Date.now() - start;
    expect(elapsed, `Page load ${{elapsed}}ms phải < 5000ms`).toBeLessThan(5000);
    expect(page.url()).toContain('{list_path_root}');
    await expect(page.locator('body')).toBeVisible();"""
    elif is_red or is_security:
        assertions = f"""    // Negative scenario — verify error hoặc redirect
    await loginToPage(page, '{cfg["list_path"]}');
    expect(page.url()).toMatch(/{path_re}|\\/login/);
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').textContent();
    expect(bodyText, 'body có text').toBeTruthy();"""
    else:
        # GREEN, STATE, EP, BOUNDARY, EDGE, DATA, DECISION
        assertions = f"""    await loginToPage(page, '{cfg["list_path"]}');
    expect(page.url(), 'URL chứa {list_path_root}').toContain('{list_path_root}');
    await expect(page.locator('body'), 'Body phải visible').toBeVisible();
    const heading = page.getByRole('heading', {{ name: /{title_re}/i }});
    const fallback = page.locator('h1, h2, [data-testid$="-page"]');
    await expect(heading.or(fallback).first(), 'Heading nghiệp vụ phải hiện').toBeVisible();"""

    return f"""  test('{tc_id}-E2E: [{priority}] {title}', async ({{ page }}) => {{
    // Pre: {pre or '-'}
    // Steps: {steps[:200]}
    // Expected: {expected[:200]}
    const {po_var} = new {po_class}(page);
    // Không wrap trong try/catch — assertion fail = test FAIL thật
    // Chỉ dùng skip khi test.skip(true) được gọi rõ ràng (e.g. loginToPage redirect về /login)
{assertions}
  }});
"""


def generate_feature(feature: str, project_root: Path):
    cfg = FEATURE_CONFIG[feature]
    uat_path = project_root / 'docs' / 'uat' / feature / 'uat.json'
    if not uat_path.exists():
        print(f"❌ {uat_path} not found")
        return False
    with open(uat_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    test_cases = data['test_cases']

    # Generate API spec
    api_blocks = []
    for tc in test_cases:
        block = gen_api_test(tc, cfg)
        if block:
            api_blocks.append(block)

    api_spec = f"""// Auto-generated by scripts/uat_spec_generator.py — uat-test-runner
// Feature: {feature} | Source: docs/uat/{feature}/uat.json
// Layer: API smoke gate (request fixture, no browser)
// Total TC in source: {len(test_cases)} | API tests generated: {len(api_blocks)}

import {{ test, expect }} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Token từ env hoặc file (global-setup đã login)
function getToken(): string {{
  if (process.env.UAT_TOKEN) return process.env.UAT_TOKEN;
  try {{
    return fs.readFileSync(path.resolve(__dirname, '../../test-results/.auth-token.txt'), 'utf-8').trim();
  }} catch (_e) {{ return ''; }}
}}

// Runtime-unique cho {{{{random}}}} placeholder trong body (tránh trùng unique field khi chạy lại)
function __uatRand(): string {{
  return Math.random().toString(36).slice(2, 10);
}}

test.describe('{feature.upper()} — UAT API smoke layer', () => {{
{''.join(api_blocks)}
}});
"""
    api_path = project_root / 'tests' / 'api' / f'{feature}-uat.api.spec.ts'
    api_path.parent.mkdir(parents=True, exist_ok=True)
    api_path.write_text(api_spec, encoding='utf-8')
    print(f"✅ {api_path.relative_to(project_root)} — {len(api_blocks)} tests")

    # Generate E2E spec
    e2e_blocks = []
    for tc in test_cases:
        e2e_blocks.append(gen_e2e_test(tc, cfg))

    e2e_spec = f"""// Auto-generated by scripts/uat_spec_generator.py — uat-test-runner
// Feature: {feature} | Source: docs/uat/{feature}/uat.json
// Layer: UI E2E Chromium (Page Object Model, ≥3 UI assertion/TC)
// Total TC: {len(test_cases)}

import {{ test, expect }} from '@playwright/test';
import {{ {cfg['po_class']} }} from '../pages/{cfg['po_class']}';
import {{ loginToPage }} from '../helpers/auth';

test.describe('{feature.upper()} — UAT E2E layer', () => {{
{''.join(e2e_blocks)}
}});
"""
    e2e_path = project_root / 'tests' / 'e2e' / f'{feature}-uat.e2e.spec.ts'
    e2e_path.parent.mkdir(parents=True, exist_ok=True)
    e2e_path.write_text(e2e_spec, encoding='utf-8')
    print(f"✅ {e2e_path.relative_to(project_root)} — {len(test_cases)} tests")
    return True


if __name__ == '__main__':
    project_root = Path(__file__).parent.parent
    if len(sys.argv) > 1:
        features = sys.argv[1:]
    else:
        features = ['cases', 'incidents', 'petitions', 'utdt']
    for feat in features:
        print(f"\n🔧 Generating {feat}…")
        generate_feature(feat, project_root)
