// Convert live-results.json → input.json chuẩn skill uat-test-writer (cho generate Excel/Markdown).
import fs from 'fs';
const dir = 'docs/uat/in-chung-tu-readiness';
const lr = JSON.parse(fs.readFileSync(`${dir}/live-results.json`, 'utf8'));
const SEV = { P0: 'Critical', P1: 'High', P2: 'Medium', P3: 'Low' };
const moduleOf = (r) => {
  if (r.rule_ref?.startsWith('PET')) return 'Đơn thư (Petition)';
  if (r.rule_ref?.startsWith('DYN')) return 'Vụ việc/Vụ án (Dynamic)';
  if (r.rule_ref?.startsWith('ADMIN')) return 'Admin cấu hình required';
  if (r.rule_ref?.startsWith('OPT')) return 'Optimistic-lock';
  if (r.rule_ref?.startsWith('RBAC') || r.rule_ref?.startsWith('SEC')) return 'Bảo mật/RBAC';
  return 'Chung';
};
const test_cases = lr.results.map((r) => ({
  tc_id: r.tc_id,
  type: r.type,
  priority: r.priority,
  module: moduleOf(r),
  title: r.title,
  severity_if_fail: SEV[r.priority] || 'Medium',
  oracle_type: r.oracle_type,
  rule_ref: r.rule_ref,
  steps: `Chạy LIVE API trên local. ${r.evidence || ''}`.trim(),
  expected: r.expected,
  actual_result: r.actual,
  status: r.status === 'PASS' ? 'Pass' : r.status === 'FAIL' ? 'Fail' : 'Blocked/GAP',
  evidence: r.evidence || '',
  test_data: '',
}));
const out = {
  feature_name: 'In chứng từ — báo & bổ sung thông tin thiếu per mẫu (Đơn thư + Vụ việc + Vụ án + Admin required)',
  complexity: 'high',
  test_cases,
  scope: {
    in_scope: 'readiness 3 thực thể, bổ sung tại popup, admin cấu hình required, RBAC/DataScope, escape injection, optimistic-lock',
    out_scope: 'WCAG full audit, đa browser thật (chỉ chromium), load test quy mô lớn',
  },
  summary_live: lr.summary,
  test_data: {
    accounts: [
      { id: 'ACC-ADMIN', email: 'admin@pc02.local', password: '<env>', role: 'ADMIN/SUPER_ADMIN', status: 'active', purpose: 'Full scope + Setting:write' },
      { id: 'ACC-OFF1', email: 'officer1@pc02.local', password: '<env>', role: 'OFFICER', status: 'active', purpose: 'DataScope tổ 1 (không Setting:write)' },
      { id: 'ACC-OFF2', email: 'officer2@pc02.local', password: '<env>', role: 'OFFICER', status: 'active', purpose: 'DataScope tổ 2 (isolation)' },
    ],
    boundary_values: [
      { field: 'nhanThay/deXuat', value: '"   " (chỉ space)', type: 'whitespace', expected: 'Tính THIẾU (trim)', notes: 'BOUNDARY' },
      { field: 'detailContent', value: 'rỗng nhưng summary có', type: 'OR-rule', expected: 'Bare-min content THOẢ', notes: 'EP' },
      { field: 'docTypes', value: '[] (rỗng)', type: 'array', expected: '400', notes: 'RED' },
      { field: 'templateIds', value: '[t,t] (trùng)', type: 'array', expected: '400 (no double cấp số)', notes: 'RED' },
    ],
    payloads: [
      { target: 'lyDoTraDon (đơn thư)', payload: '<script>alert(1)</script> \'; DROP TABLE petitions;--', attack_type: 'XSS/SQLi', expected: 'Escape → xuất 2xx, DB nguyên', owasp_ref: 'A03 Injection' },
      { target: 'manualValues.toiDanh (vụ án)', payload: '{x} <b> {{y}}', attack_type: 'docxtemplater injection', expected: 'Escape ❴❵‹› → 2xx', owasp_ref: 'A03 Injection' },
      { target: 'export-readiness (no token)', payload: '—', attack_type: 'Broken Auth', expected: '401', owasp_ref: 'A07' },
      { target: 'case ngoài scope (officer)', payload: 'GET readiness', attack_type: 'IDOR/BOLA', expected: '403/404', owasp_ref: 'A01 Broken Access Control' },
      { target: 'PATCH document-templates (officer)', payload: 'requiredVariables', attack_type: 'Privilege Esc', expected: '403 (Setting:write)', owasp_ref: 'A01' },
    ],
  },
  data_fixtures: [
    { fixture_id: 'petition.anonymous.D0.empty', entity: 'Petition', setup_recipe: 'POST /petitions {senderIsAnonymous:true, senderName:"", detailContent:"", petitionType:TO_CAO}', cleanup_recipe: 'DELETE /petitions/:id', outputs: { petId: '$.id' }, notes: 'Đơn nặc danh cho phép thiếu nội dung → readiness báo thiếu' },
    { fixture_id: 'petition.anonymous.D0.baremin', entity: 'Petition', setup_recipe: 'POST anon + PUT senderName+detailContent', cleanup_recipe: 'DELETE', outputs: { id: '$.id' }, notes: 'BIEN_NHAN ready, PHIEU_DE_XUAT vẫn thiếu' },
    { fixture_id: 'case.normal.existing', entity: 'Case (VU_AN)', setup_recipe: 'GET /cases?limit=1 (record sẵn)', cleanup_recipe: '— (không tạo)', outputs: { caseId: '$.id' }, notes: 'Officer không có quyền tạo case' },
    { fixture_id: 'incident.normal.existing', entity: 'Incident (VU_VIEC)', setup_recipe: 'GET /incidents?limit=1', cleanup_recipe: '—', outputs: { incId: '$.id' }, notes: '' },
  ],
};
fs.writeFileSync(`${dir}/input.json`, JSON.stringify(out, null, 2));
console.log('→ input.json (', test_cases.length, 'TC )');
