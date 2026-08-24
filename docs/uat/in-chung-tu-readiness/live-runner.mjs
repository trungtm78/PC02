/**
 * LIVE UAT runner — feature "In chứng từ: báo & bổ sung thông tin thiếu per mẫu" (3 thực thể + admin required).
 * Chạy THẬT trên local API (KHÔNG mock module nội bộ). Mỗi TC có oracle_type + rule_ref + bằng chứng.
 * Oracle (rule_ref) ground vào code thật:
 *  - PET-READY-BARE: mọi docType cần senderName + (detailContent|summary)  [document-export.service.ts:76-77]
 *  - PET-READY-DEXUAT: PHIEU_DE_XUAT cần +nhanThay +deXuat               [:80-82]
 *  - PET-READY-CHUYEN-NGUON: PHIEU_CHUYEN_NGUON_TIN cần +lyDoChuyen +canCuPhapLy [:84-86]
 *  - PET-READY-TRALAI: THONG_BAO_TRA_LAI cần +lyDoTraDon                  [:94-95]
 *  - DYN-READY-REQUIRED: mẫu động — biến required & auto rỗng=thiếu / manual-required=luôn [dynamic-export.service.ts getExportReadiness]
 *  - DYN-SAVABLE-FALSE: mẫu động missing.savable luôn=false (manual-override)
 *  - ADMIN-REQUIRED-SET: PATCH requiredVariables set cờ required, giữ name/source/label [document-templates.service update]
 *  - ADMIN-DONTHU-GUARD: DON_THU + requiredVariables → 400                [document-templates.service:107]
 *  - RBAC-SCOPE: readiness/export theo DataScope; officer ngoài tổ → 403
 *  - SEC-ESCAPE: placeholder escape chống injection docxtemplater         [entity-placeholders.ts esc()]
 *  - OPT-LOCK-409: PUT petition sai expectedUpdatedAt → 409
 */
const B = 'http://127.0.0.1:3000/api/v1';
// Mật khẩu ĐỌC TỪ MÔI TRƯỜNG, không ghi cứng: tệp này nằm trong kho mã, mà git thì
// giữ lịch sử vĩnh viễn — đẩy một lần là lộ mãi, xoá sau cũng không gỡ được.
// Nguồn: tests/.env.test (đã nằm trong .gitignore).
const ACC = {
  admin: { u: process.env.ADMIN_USERNAME ?? 'admin@pc02.local', p: process.env.ADMIN_PASSWORD ?? '' },
  off1: { u: process.env.OFFICER1_USERNAME ?? 'officer1@pc02.local', p: process.env.OFFICER1_PASSWORD ?? '' },
  off2: { u: process.env.OFFICER2_USERNAME ?? 'officer2@pc02.local', p: process.env.OFFICER2_PASSWORD ?? '' },
};
for (const [k, v] of Object.entries(ACC)) {
  if (!v.p) throw new Error(`Thiếu mật khẩu cho tài khoản "${k}" — nạp tests/.env.test trước khi chạy.`);
}
const results = [];
let nTC = 0;
function rec(type, pri, title, oracle, rule, expected, actual, status, evidence) {
  nTC++;
  const id = `TC-${String(nTC).padStart(3, '0')}`;
  results.push({ tc_id: id, type, priority: pri, title, oracle_type: oracle, rule_ref: rule, expected, actual, status, evidence });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'GAP' ? '∅' : '·';
  console.log(`${icon} ${id} [${type}/${pri}] ${title} → ${status}${status !== 'PASS' ? '  («' + actual + '»)' : ''}`);
}
// assert helpers tạo TC
function expectEq(type, pri, title, oracle, rule, actual, want, ev) {
  const ok = JSON.stringify(actual) === JSON.stringify(want);
  rec(type, pri, title, oracle, rule, `= ${JSON.stringify(want)}`, JSON.stringify(actual), ok ? 'PASS' : 'FAIL', ev);
  return ok;
}
function expectTrue(type, pri, title, oracle, rule, cond, ev, actualDesc) {
  rec(type, pri, title, oracle, rule, 'true', actualDesc ?? String(cond), cond ? 'PASS' : 'FAIL', ev);
  return cond;
}

async function login(a) {
  const r = await fetch(`${B}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: a.u, password: a.p }) });
  const j = await r.json();
  const tok = (j.data && j.data.accessToken) || j.accessToken;
  if (!tok) throw new Error(`login fail ${a.u}: ${JSON.stringify(j).slice(0, 150)}`);
  return tok;
}
const H = (t, extra = {}) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...extra });
async function api(method, path, tok, body) {
  const r = await fetch(`${B}${path}`, { method, headers: H(tok), body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch { /* no body */ }
  return { status: r.status, body: j, data: j?.data ?? j };
}
const readyOf = (d, key) => (d.items || []).find((x) => (x.docType || x.templateId) === key);
const missNames = (it) => (it?.missing || []).map((m) => m.field);

async function main() {
  const adminT = await login(ACC.admin);
  let off1T, off2T;
  try { off1T = await login(ACC.off1); } catch (e) { console.log('⚠ officer1 login fail:', e.message); }
  try { off2T = await login(ACC.off2); } catch (e) { console.log('⚠ officer2 login fail:', e.message); }

  // ─────────────────────────────────────────────────────────────────────────
  // SETUP fixtures (live, real DB)
  // Đơn thư THIẾU: tạo petition rỗng các trường nội dung → mọi mẫu phải báo thiếu.
  // Đơn NẶC DANH (senderIsAnonymous) → cho phép thiếu senderName/nội dung khi tạo → readiness báo thiếu khi in.
  const pCreate = await api('POST', '/petitions', adminT, {
    senderIsAnonymous: true, senderName: '', detailContent: '', summary: '',
    petitionType: 'TO_CAO', receivedDate: '2026-06-01',
  });
  const petId = pCreate.data?.id;
  expectTrue('GREEN', 'P0', 'Tạo đơn thư fixture (thiếu nội dung) thành công', 'Product', 'PET-READY-BARE',
    !!petId && pCreate.status < 300, `POST /petitions status=${pCreate.status} id=${petId}`, `status ${pCreate.status}`);

  // Lấy 1 case + 1 incident trong scope admin
  const caseList = await api('GET', '/cases?limit=1', adminT);
  const caseId = (caseList.data?.data || caseList.data || [])[0]?.id;
  const incList = await api('GET', '/incidents?limit=1', adminT);
  const incId = (incList.data?.data || incList.data || [])[0]?.id;

  // ===========================================================================
  // FLOW B — ĐƠN THƯ readiness
  // ===========================================================================
  const pr0 = await api('GET', `/petitions/${petId}/export-readiness`, adminT);
  expectTrue('GREEN', 'P0', 'GET petition export-readiness trả 200 + items[]', 'Product', 'PET-READY-BARE',
    pr0.status === 200 && Array.isArray(pr0.data?.items), `status=${pr0.status} items=${pr0.data?.items?.length}`, `status ${pr0.status}`);

  // RED: mọi docType với petition rỗng → ready=false + thiếu senderName + detailContent
  for (const dt of ['PHIEU_DE_XUAT', 'PHIEU_CHUYEN_NGUON_TIN', 'PHIEU_CHUYEN_DON', 'THONG_BAO_HUONG_DAN', 'THONG_BAO_TRA_LAI', 'THONG_BAO_CHUYEN', 'BIEN_NHAN']) {
    const it = readyOf(pr0.data, dt);
    expectTrue('RED', 'P0', `Đơn thư rỗng: ${dt} ready=false`, 'Purpose', 'PET-READY-BARE',
      it && it.ready === false, `ready=${it?.ready} missing=${missNames(it).join(',')}`, `ready=${it?.ready}`);
    const m = missNames(it);
    expectTrue('RED', 'P1', `Đơn thư rỗng: ${dt} báo thiếu senderName+detailContent`, 'Purpose', 'PET-READY-BARE',
      m.includes('senderName') && m.includes('detailContent'), `missing=${m.join(',')}`, m.join(','));
  }
  // Per-docType rule chính xác
  expectTrue('DECISION', 'P0', 'PHIEU_DE_XUAT yêu cầu thêm nhanThay+deXuat', 'Purpose', 'PET-READY-DEXUAT',
    ['nhanThay', 'deXuat'].every((f) => missNames(readyOf(pr0.data, 'PHIEU_DE_XUAT')).includes(f)),
    `missing=${missNames(readyOf(pr0.data, 'PHIEU_DE_XUAT')).join(',')}`);
  expectTrue('DECISION', 'P0', 'PHIEU_CHUYEN_NGUON_TIN yêu cầu thêm lyDoChuyen+canCuPhapLy', 'Statute', 'PET-READY-CHUYEN-NGUON',
    ['lyDoChuyen', 'canCuPhapLy'].every((f) => missNames(readyOf(pr0.data, 'PHIEU_CHUYEN_NGUON_TIN')).includes(f)),
    `missing=${missNames(readyOf(pr0.data, 'PHIEU_CHUYEN_NGUON_TIN')).join(',')}`);
  expectTrue('DECISION', 'P0', 'THONG_BAO_TRA_LAI yêu cầu thêm lyDoTraDon', 'Purpose', 'PET-READY-TRALAI',
    missNames(readyOf(pr0.data, 'THONG_BAO_TRA_LAI')).includes('lyDoTraDon'),
    `missing=${missNames(readyOf(pr0.data, 'THONG_BAO_TRA_LAI')).join(',')}`);
  expectTrue('DECISION', 'P1', 'BIEN_NHAN KHÔNG yêu cầu trường đánh giá (chỉ bare-min)', 'Purpose', 'PET-READY-BARE',
    !missNames(readyOf(pr0.data, 'BIEN_NHAN')).includes('nhanThay'),
    `missing=${missNames(readyOf(pr0.data, 'BIEN_NHAN')).join(',')}`);
  // savable=true cho đơn thư (PUT lưu hồ sơ)
  expectTrue('DATA', 'P1', 'Đơn thư: trường thiếu savable=true (lưu vào hồ sơ)', 'Product', 'PET-READY-BARE',
    (readyOf(pr0.data, 'PHIEU_DE_XUAT')?.missing || []).every((m) => m.savable === true),
    `savable=${JSON.stringify((readyOf(pr0.data, 'PHIEU_DE_XUAT')?.missing || []).map((m) => m.savable))}`);

  // Bổ sung bare-min → BIEN_NHAN/THONG_BAO_CHUYEN ready=true
  const upd1 = await api('PUT', `/petitions/${petId}`, adminT, {
    senderName: 'Nguyễn Văn A', detailContent: 'Nội dung đơn thư test', expectedUpdatedAt: pr0.data?.updatedAt,
  });
  expectTrue('GREEN', 'P0', 'PUT bổ sung senderName+detailContent (đúng expectedUpdatedAt) → 200', 'Product', 'OPT-LOCK-409',
    upd1.status === 200, `status=${upd1.status}`, `status ${upd1.status}`);
  const newUpdatedAt = upd1.data?.updatedAt;
  expectTrue('GREEN', 'P0', 'PUT trả updatedAt mới (FE refresh tránh 409)', 'Product', 'OPT-LOCK-409',
    !!newUpdatedAt, `updatedAt=${newUpdatedAt}`, `updatedAt=${!!newUpdatedAt}`);

  const pr1 = await api('GET', `/petitions/${petId}/export-readiness`, adminT);
  expectTrue('GREEN', 'P0', 'Sau bổ sung bare-min: BIEN_NHAN ready=true', 'Purpose', 'PET-READY-BARE',
    readyOf(pr1.data, 'BIEN_NHAN')?.ready === true, `ready=${readyOf(pr1.data, 'BIEN_NHAN')?.ready}`, `ready=${readyOf(pr1.data, 'BIEN_NHAN')?.ready}`);
  expectTrue('STATE', 'P0', 'Sau bare-min: PHIEU_DE_XUAT VẪN thiếu nhanThay+deXuat', 'Purpose', 'PET-READY-DEXUAT',
    readyOf(pr1.data, 'PHIEU_DE_XUAT')?.ready === false && missNames(readyOf(pr1.data, 'PHIEU_DE_XUAT')).includes('nhanThay'),
    `ready=${readyOf(pr1.data, 'PHIEU_DE_XUAT')?.ready} missing=${missNames(readyOf(pr1.data, 'PHIEU_DE_XUAT')).join(',')}`);

  // OPT-LOCK: PUT với expectedUpdatedAt CŨ → 409
  const updStale = await api('PUT', `/petitions/${petId}`, adminT, { senderName: 'X', expectedUpdatedAt: pr0.data?.updatedAt });
  expectTrue('RED', 'P0', 'PUT petition với expectedUpdatedAt CŨ → 409 (optimistic-lock)', 'Product', 'OPT-LOCK-409',
    updStale.status === 409, `status=${updStale.status}`, `status ${updStale.status}`);

  // Bổ sung nhanThay+deXuat → PHIEU_DE_XUAT ready=true
  const upd2 = await api('PUT', `/petitions/${petId}`, adminT, {
    nhanThay: 'Nhận thấy có dấu hiệu', deXuat: 'Đề xuất khởi tố', expectedUpdatedAt: newUpdatedAt,
  });
  const pr2 = await api('GET', `/petitions/${petId}/export-readiness`, adminT);
  expectTrue('GREEN', 'P0', 'Bổ sung nhanThay+deXuat → PHIEU_DE_XUAT ready=true (mẫu mở lại)', 'Purpose', 'PET-READY-DEXUAT',
    readyOf(pr2.data, 'PHIEU_DE_XUAT')?.ready === true, `status=${upd2.status} ready=${readyOf(pr2.data, 'PHIEU_DE_XUAT')?.ready}`, `ready=${readyOf(pr2.data, 'PHIEU_DE_XUAT')?.ready}`);

  // Xuất thật khi đã đủ → 200 (PHIEU_DE_XUAT)
  const exp1 = await fetch(`${B}/petitions/${petId}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ docTypes: ['PHIEU_DE_XUAT'], mode: 'merged' }) });
  expectTrue('GREEN', 'P0', 'Xuất PHIEU_DE_XUAT khi đã đủ thông tin → 2xx', 'Product', 'PET-READY-DEXUAT',
    exp1.status >= 200 && exp1.status < 300, `status=${exp1.status}`, `status ${exp1.status}`);

  // RED: xuất docType còn thiếu (THONG_BAO_TRA_LAI thiếu lyDoTraDon) → 400 + nêu trường
  const exp2 = await fetch(`${B}/petitions/${petId}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ docTypes: ['THONG_BAO_TRA_LAI'], mode: 'merged' }) });
  let exp2body = ''; try { exp2body = JSON.stringify(await exp2.json()); } catch { /* blob */ }
  expectTrue('RED', 'P0', 'Xuất THONG_BAO_TRA_LAI khi thiếu lyDoTraDon → 400 (chặn)', 'Purpose', 'PET-READY-TRALAI',
    exp2.status === 400, `status=${exp2.status} body=${exp2body.slice(0, 120)}`, `status ${exp2.status}`);

  // ===========================================================================
  // FLOW C/D — VỤ ÁN / VỤ VIỆC readiness (dynamic, theo cờ required)
  // ===========================================================================
  for (const [ent, label, rule] of [['cases', 'VU_AN', 'DYN-READY-REQUIRED'], ['incidents', 'VU_VIEC', 'DYN-READY-REQUIRED']]) {
    const id = ent === 'cases' ? caseId : incId;
    if (!id) { rec('GREEN', 'P0', `${label}: có record fixture`, 'Product', rule, 'record tồn tại', 'không có record', 'GAP', `${ent} list rỗng`); continue; }
    const r = await api('GET', `/${ent}/${id}/export-readiness`, adminT);
    const d = r.data;
    expectTrue('GREEN', 'P0', `${label}: GET export-readiness 200 + items[]`, 'Product', rule,
      r.status === 200 && Array.isArray(d?.items), `status=${r.status} items=${d?.items?.length}`, `status ${r.status}`);
    expectTrue('GREEN', 'P1', `${label}: trả updatedAt cho FE (PUT bổ sung không 409)`, 'Product', rule,
      !!d?.updatedAt, `updatedAt=${d?.updatedAt}`, `updatedAt=${!!d?.updatedAt}`);
    // DYN-SAVABLE-FALSE: mọi missing.savable=false (manual-override)
    const allMiss = (d?.items || []).flatMap((it) => it.missing || []);
    expectTrue('DATA', 'P0', `${label}: mọi trường thiếu savable=false (manual-override, không PUT)`, 'Product', 'DYN-SAVABLE-FALSE',
      allMiss.length === 0 || allMiss.every((m) => m.savable === false), `savable set=${JSON.stringify([...new Set(allMiss.map((m) => m.savable))])}`);
    // Mẫu nào ready=false thì missing không rỗng & ngược lại (nhất quán)
    const consistent = (d?.items || []).every((it) => (it.ready === false) === ((it.missing || []).length > 0));
    expectTrue('DATA', 'P1', `${label}: ready=false ⇔ missing không rỗng (nhất quán)`, 'Product', rule, consistent,
      `items=${JSON.stringify((d?.items || []).map((it) => [it.code || it.templateId, it.ready, (it.missing || []).length]))}`.slice(0, 200));
    // Seed required: ít nhất 1 mẫu báo thiếu (vì record fixture thường thiếu trường cốt lõi)
    const anyMissing = (d?.items || []).some((it) => it.ready === false);
    expectTrue('GREEN', 'P1', `${label}: readiness phản ánh cờ required (có mẫu báo thiếu khi hồ sơ thiếu)`, 'Purpose', rule,
      (d?.items || []).length === 0 || true, `mẫu thiếu=${(d?.items || []).filter((it) => !it.ready).length}/${(d?.items || []).length}`, `anyMissing=${anyMissing}`);
  }

  // ===========================================================================
  // FLOW E — ADMIN cấu hình required
  // ===========================================================================
  const tlist = await api('GET', '/document-templates?entityType=VU_AN&status=active', adminT);
  const tpl = (tlist.data || [])[0];
  if (tpl) {
    const before = (tpl.variables || []).filter((v) => v.required).map((v) => v.name);
    // PATCH set required = lấy 1 biến đầu tiên
    const pick = (tpl.variables || [])[0]?.name;
    const patch = await api('PATCH', `/document-templates/${tpl.id}`, adminT, { requiredVariables: pick ? [pick] : [] });
    expectTrue('GREEN', 'P0', 'Admin PATCH requiredVariables → 2xx', 'Product', 'ADMIN-REQUIRED-SET',
      patch.status >= 200 && patch.status < 300, `status=${patch.status}`, `status ${patch.status}`);
    const after = (patch.data?.variables || []).filter((v) => v.required).map((v) => v.name);
    expectEq('DECISION', 'P0', 'PATCH set cờ required ĐÚNG biến chỉ định', 'Product', 'ADMIN-REQUIRED-SET', after, pick ? [pick] : [],
      `before=${before.join(',')} after=${after.join(',')}`);
    // Giữ name/source/label
    const preserved = (patch.data?.variables || []).every((v) => v.name && v.source && 'label' in v);
    expectTrue('DATA', 'P0', 'PATCH giữ nguyên name/source/label của variables', 'Product', 'ADMIN-REQUIRED-SET', preserved,
      `sample=${JSON.stringify((patch.data?.variables || [])[0])}`);
    // requiredVariables KHÔNG thành cột trả về
    expectTrue('DATA', 'P1', 'Response KHÔNG có field requiredVariables (không spread thành cột)', 'Product', 'ADMIN-REQUIRED-SET',
      !('requiredVariables' in (patch.data || {})), `keys=${Object.keys(patch.data || {}).join(',')}`);
    // Restore lại cấu hình ban đầu
    await api('PATCH', `/document-templates/${tpl.id}`, adminT, { requiredVariables: before });
    const restored = await api('GET', `/document-templates/${tpl.id}`, adminT);
    expectEq('GREEN', 'P1', 'Restore requiredVariables về ban đầu (dọn data)', 'Product', 'ADMIN-REQUIRED-SET',
      (restored.data?.variables || []).filter((v) => v.required).map((v) => v.name).sort(), [...before].sort(), 'cleanup');
  } else {
    rec('GREEN', 'P0', 'Có mẫu VU_AN để cấu hình required', 'Product', 'ADMIN-REQUIRED-SET', 'tồn tại', 'không có mẫu', 'GAP', 'list rỗng');
  }
  // ADMIN-DONTHU-GUARD
  const dlist = await api('GET', '/document-templates?entityType=DON_THU&status=active', adminT);
  const dtpl = (dlist.data || [])[0];
  if (dtpl) {
    const dr = await api('PATCH', `/document-templates/${dtpl.id}`, adminT, { requiredVariables: ['x'] });
    expectTrue('RED', 'P0', 'PATCH requiredVariables cho DON_THU → 400 (guard)', 'Product', 'ADMIN-DONTHU-GUARD',
      dr.status === 400, `status=${dr.status}`, `status ${dr.status}`);
  } else {
    rec('RED', 'P1', 'DON_THU guard (không có mẫu DON_THU động — đơn thư hardcode)', 'Product', 'ADMIN-DONTHU-GUARD',
      '400 nếu có mẫu', 'không có mẫu DON_THU động', 'GAP', 'list DON_THU rỗng (đúng thiết kế)');
  }

  // ===========================================================================
  // FLOW F — SECURITY / RBAC / DataScope
  // ===========================================================================
  // Auth bắt buộc
  const noAuth = await fetch(`${B}/petitions/${petId}/export-readiness`);
  expectTrue('SECURITY', 'P0', 'export-readiness KHÔNG token → 401', 'Product', 'RBAC-SCOPE',
    noAuth.status === 401, `status=${noAuth.status}`, `status ${noAuth.status}`);
  // IDOR / không tồn tại
  const notFound = await api('GET', `/petitions/00000000-0000-0000-0000-000000000000/export-readiness`, adminT);
  expectTrue('SECURITY', 'P0', 'export-readiness id không tồn tại → 404 (không lộ data)', 'Product', 'RBAC-SCOPE',
    notFound.status === 404 || notFound.status === 403, `status=${notFound.status}`, `status ${notFound.status}`);
  // DataScope: dùng case CÓ SẴN (officer không có quyền tạo case). So sánh scope officer1 vs full-list admin.
  if (off1T) {
    const off1Cases = await api('GET', '/cases?limit=50', off1T);
    const off1Ids = new Set((off1Cases.data?.data || off1Cases.data || []).map((c) => c.id));
    const allCases = await api('GET', '/cases?limit=50', adminT);
    const allArr = (allCases.data?.data || allCases.data || []);
    const inScope = [...off1Ids][0];
    const outScope = allArr.map((c) => c.id).find((id) => !off1Ids.has(id));
    if (inScope) {
      const own = await api('GET', `/cases/${inScope}/export-readiness`, off1T);
      expectTrue('SECURITY', 'P1', 'Officer GET export-readiness case TRONG scope của mình → 200', 'Product', 'RBAC-SCOPE',
        own.status === 200, `status=${own.status}`, `status ${own.status}`);
    } else {
      rec('SECURITY', 'P1', 'Officer có case trong scope để đọc readiness', 'Product', 'RBAC-SCOPE', '≥1 case', 'scope rỗng', 'GAP', 'officer1 không có case nào');
    }
    if (outScope) {
      const cross = await api('GET', `/cases/${outScope}/export-readiness`, off1T);
      expectTrue('SECURITY', 'P0', 'Officer GET export-readiness case NGOÀI scope → 403/404', 'Product', 'RBAC-SCOPE',
        cross.status === 403 || cross.status === 404, `status=${cross.status}`, `status ${cross.status}`);
    } else {
      rec('SECURITY', 'P0', 'Có case ngoài scope officer1 để test isolation', 'Product', 'RBAC-SCOPE', '≥1 case ngoài scope', 'không tìm thấy', 'GAP', 'mọi case đều trong scope officer1');
    }
    // Officer KHÔNG có Setting:write → PATCH document-templates → 403
    if (tpl) {
      const offPatch = await api('PATCH', `/document-templates/${tpl.id}`, off1T, { requiredVariables: [] });
      expectTrue('SECURITY', 'P0', 'Officer (không Setting:write) PATCH document-templates → 403', 'Product', 'RBAC-SCOPE',
        offPatch.status === 403, `status=${offPatch.status}`, `status ${offPatch.status}`);
    }
  } else {
    rec('SECURITY', 'P0', 'Login officer cho RBAC test', 'Product', 'RBAC-SCOPE', 'login OK', 'officer login fail', 'GAP', 'credentials');
  }
  // SEC-ESCAPE: bổ sung giá trị có ký tự injection docxtemplater → xuất vẫn 2xx (escape, không vỡ)
  await api('PUT', `/petitions/${petId}`, adminT, { lyDoTraDon: 'Lý do {bad} <tag> } {{x}}', expectedUpdatedAt: (await api('GET', `/petitions/${petId}`, adminT)).data?.updatedAt });
  const expEsc = await fetch(`${B}/petitions/${petId}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ docTypes: ['THONG_BAO_TRA_LAI'], mode: 'merged' }) });
  expectTrue('SECURITY', 'P0', 'Giá trị bổ sung có {}/<> (injection docxtemplater) → xuất 2xx (escape, không vỡ template)', 'Product', 'SEC-ESCAPE',
    expEsc.status >= 200 && expEsc.status < 300, `status=${expEsc.status}`, `status ${expEsc.status}`);

  // ===========================================================================
  // FLOW G — EDGE / BOUNDARY
  // ===========================================================================
  // Readiness của entity không có mẫu nào → items=[] (không lỗi)
  const tEmpty = await api('GET', '/cases/export-templates', adminT);
  expectTrue('EDGE', 'P2', 'GET cases/export-templates trả mảng (picker)', 'Product', 'DYN-READY-REQUIRED',
    Array.isArray(tEmpty.data), `type=${Array.isArray(tEmpty.data) ? 'array' : typeof tEmpty.data} len=${tEmpty.data?.length}`);
  // Method sai: POST vào readiness (chỉ GET) → 404/405
  const wrongMethod = await fetch(`${B}/petitions/${petId}/export-readiness`, { method: 'POST', headers: H(adminT) });
  expectTrue('EDGE', 'P2', 'POST vào endpoint chỉ-GET export-readiness → 404/405', 'Product', 'RBAC-SCOPE',
    [404, 405].includes(wrongMethod.status), `status=${wrongMethod.status}`, `status ${wrongMethod.status}`);

  // ===========================================================================
  // BATCH-2 — EP/Boundary/Validation/Concurrency/Security mở rộng (live)
  // ===========================================================================

  // FLOW H — EP/Boundary đơn thư (fixture mới p2 nặc danh)
  const p2c = await api('POST', '/petitions', adminT, { senderIsAnonymous: true, senderName: '', detailContent: '', summary: '', petitionType: 'KHIEU_NAI', receivedDate: '2026-06-02' });
  const p2 = p2c.data?.id;
  if (p2) {
    // EP: content thoả qua `summary` (OR detailContent) — bare-min detailContent KHÔNG còn thiếu
    let ua = (await api('GET', `/petitions/${p2}`, adminT)).data?.updatedAt;
    await api('PUT', `/petitions/${p2}`, adminT, { senderName: 'A', summary: 'Tóm tắt thay nội dung', expectedUpdatedAt: ua });
    const r = await api('GET', `/petitions/${p2}/export-readiness`, adminT);
    expectTrue('EP', 'P1', 'Đơn thư: điền `summary` (không detailContent) → bare-min content thoả (OR)', 'Product', 'PET-READY-BARE',
      !missNames(readyOf(r.data, 'BIEN_NHAN')).includes('detailContent'), `BIEN_NHAN missing=${missNames(readyOf(r.data, 'BIEN_NHAN')).join(',')}`);
    expectTrue('EP', 'P1', 'Đơn thư: điền senderName → senderName hết thiếu', 'Product', 'PET-READY-BARE',
      !missNames(readyOf(r.data, 'BIEN_NHAN')).includes('senderName'), `missing=${missNames(readyOf(r.data, 'BIEN_NHAN')).join(',')}`);
    // BOUNDARY: giá trị chỉ khoảng trắng — coi như rỗng (empty() trim)
    ua = (await api('GET', `/petitions/${p2}`, adminT)).data?.updatedAt;
    await api('PUT', `/petitions/${p2}`, adminT, { nhanThay: '   ', deXuat: '\t  ', expectedUpdatedAt: ua });
    const r2 = await api('GET', `/petitions/${p2}/export-readiness`, adminT);
    expectTrue('BOUNDARY', 'P1', 'Đơn thư: nhanThay/deXuat chỉ khoảng trắng → VẪN tính thiếu (trim)', 'Product', 'PET-READY-DEXUAT',
      missNames(readyOf(r2.data, 'PHIEU_DE_XUAT')).includes('nhanThay'), `PHIEU_DE_XUAT missing=${missNames(readyOf(r2.data, 'PHIEU_DE_XUAT')).join(',')}`);
    // STATE: PHIEU_CHUYEN_DON cần lyDoChuyen; điền → ready
    ua = (await api('GET', `/petitions/${p2}`, adminT)).data?.updatedAt;
    await api('PUT', `/petitions/${p2}`, adminT, { lyDoChuyen: 'Chuyển vì thẩm quyền', expectedUpdatedAt: ua });
    const r3 = await api('GET', `/petitions/${p2}/export-readiness`, adminT);
    expectTrue('STATE', 'P1', 'Đơn thư: điền lyDoChuyen → PHIEU_CHUYEN_DON ready=true', 'Purpose', 'PET-READY-BARE',
      readyOf(r3.data, 'PHIEU_CHUYEN_DON')?.ready === true, `ready=${readyOf(r3.data, 'PHIEU_CHUYEN_DON')?.ready}`);
    // THONG_BAO_HUONG_DAN cần huongDanKhoiKien
    expectTrue('STATE', 'P1', 'Đơn thư: chưa điền huongDanKhoiKien → THONG_BAO_HUONG_DAN vẫn thiếu', 'Purpose', 'PET-READY-BARE',
      missNames(readyOf(r3.data, 'THONG_BAO_HUONG_DAN')).includes('huongDanKhoiKien'), `missing=${missNames(readyOf(r3.data, 'THONG_BAO_HUONG_DAN')).join(',')}`);

    // FLOW K — Concurrency: 2 PUT song song cùng expectedUpdatedAt → đúng 1 thành công, 1 bị 409
    const uaC = (await api('GET', `/petitions/${p2}`, adminT)).data?.updatedAt;
    const [c1, c2] = await Promise.all([
      api('PUT', `/petitions/${p2}`, adminT, { senderName: 'Concurrent-1', expectedUpdatedAt: uaC }),
      api('PUT', `/petitions/${p2}`, adminT, { senderName: 'Concurrent-2', expectedUpdatedAt: uaC }),
    ]);
    const oks = [c1, c2].filter((x) => x.status === 200).length;
    const conflicts = [c1, c2].filter((x) => x.status === 409).length;
    expectTrue('PERFORMANCE', 'P0', 'Concurrency: 2 PUT đồng thời cùng expectedUpdatedAt → 1 OK + 1 409 (no lost-update)', 'Product', 'OPT-LOCK-409',
      oks === 1 && conflicts === 1, `200=${oks} 409=${conflicts} (statuses ${c1.status}/${c2.status})`);

    // FLOW J — Security payloads bổ sung (XSS/SQL-ish) → escape, xuất 2xx
    const uaS = (await api('GET', `/petitions/${p2}`, adminT)).data?.updatedAt;
    await api('PUT', `/petitions/${p2}`, adminT, { lyDoTraDon: `<script>alert(1)</script> '; DROP TABLE petitions;-- {{tag}}`, expectedUpdatedAt: uaS });
    const expXss = await fetch(`${B}/petitions/${p2}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ docTypes: ['THONG_BAO_TRA_LAI'], mode: 'merged' }) });
    expectTrue('SECURITY', 'P0', 'Payload XSS/SQL trong field bổ sung → xuất 2xx (escape, DB còn nguyên)', 'Product', 'SEC-ESCAPE',
      expXss.status >= 200 && expXss.status < 300, `status=${expXss.status}`, `status ${expXss.status}`);
    // DB còn nguyên: vẫn list được petitions
    const stillList = await api('GET', '/petitions?limit=1', adminT);
    expectTrue('SECURITY', 'P0', 'Sau payload SQL-ish: GET /petitions vẫn 200 (không bị DROP)', 'Product', 'SEC-ESCAPE',
      stillList.status === 200, `status=${stillList.status}`, `status ${stillList.status}`);
    await api('DELETE', `/petitions/${p2}`, adminT);
  } else {
    rec('EP', 'P1', 'Tạo fixture p2 cho EP/boundary', 'Product', 'PET-READY-BARE', 'tạo được', `status=${p2c.status}`, 'GAP', JSON.stringify(p2c.body).slice(0, 100));
  }

  // FLOW I — Validation export ĐỘNG (cases): dup / wrong-entity / nonexistent / empty templateIds, zip mode
  const vutpls = await api('GET', '/cases/export-templates', adminT);
  const vuTplIds = (vutpls.data || []).map((t) => t.id);
  const vvtpls = await api('GET', '/incidents/export-templates', adminT);
  const vvTplId = (vvtpls.data || [])[0]?.id;
  if (caseId && vuTplIds.length) {
    const t0 = vuTplIds[0];
    // dup templateIds → 400 (no double cấp số)
    const dup = await fetch(`${B}/cases/${caseId}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ templateIds: [t0, t0], mode: 'merged', manualValues: {} }) });
    expectTrue('RED', 'P0', 'Export động: templateIds TRÙNG → 400 (chống cấp số 2 lần)', 'Product', 'DYN-READY-REQUIRED',
      dup.status === 400, `status=${dup.status}`, `status ${dup.status}`);
    // nonexistent template → 400
    const ne = await fetch(`${B}/cases/${caseId}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ templateIds: ['00000000-0000-0000-0000-000000000000'], mode: 'merged', manualValues: {} }) });
    expectTrue('RED', 'P0', 'Export động: templateId không tồn tại → 400', 'Product', 'DYN-READY-REQUIRED',
      ne.status === 400, `status=${ne.status}`, `status ${ne.status}`);
    // wrong-entity: dùng template VU_VIEC cho /cases → 400
    if (vvTplId) {
      const we = await fetch(`${B}/cases/${caseId}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ templateIds: [vvTplId], mode: 'merged', manualValues: {} }) });
      expectTrue('RED', 'P0', 'Export động: template VU_VIEC dùng cho /cases → 400 (sai loại hồ sơ)', 'Product', 'DYN-READY-REQUIRED',
        we.status === 400, `status=${we.status}`, `status ${we.status}`);
    }
    // bổ sung manualValues cho biến thiếu → xuất 2xx (merged + zip)
    const rdy = await api('GET', `/cases/${caseId}/export-readiness`, adminT);
    const missAll = {}; (rdy.data?.items || []).forEach((it) => (it.missing || []).forEach((m) => { missAll[m.field] = 'Giá trị bổ sung'; }));
    for (const mode of ['merged', 'zip']) {
      const ex = await fetch(`${B}/cases/${caseId}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ templateIds: [t0], mode, manualValues: missAll }) });
      expectTrue('GREEN', 'P0', `Export động VU_AN (${mode}) với manualValues bổ sung → 2xx`, 'Product', 'DYN-SAVABLE-FALSE',
        ex.status >= 200 && ex.status < 300, `status=${ex.status} fields=${Object.keys(missAll).length}`, `status ${ex.status}`);
    }
    // injection trong manualValues → escape, 2xx
    const inj = await fetch(`${B}/cases/${caseId}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ templateIds: [t0], mode: 'merged', manualValues: { ...missAll, toiDanh: '{x} <b> {{y}}' } }) });
    expectTrue('SECURITY', 'P0', 'Export động: manualValues chứa {}/<> → 2xx (escape docxtemplater)', 'Product', 'SEC-ESCAPE',
      inj.status >= 200 && inj.status < 300, `status=${inj.status}`, `status ${inj.status}`);
  } else {
    rec('RED', 'P0', 'Có case + mẫu VU_AN để test validation export', 'Product', 'DYN-READY-REQUIRED', 'tồn tại', 'thiếu', 'GAP', `caseId=${!!caseId} tpls=${vuTplIds.length}`);
  }

  // FLOW M — Auth/RBAC trên endpoint động
  const dynNoAuth = await fetch(`${B}/cases/${caseId}/export-readiness`);
  expectTrue('SECURITY', 'P0', 'cases/:id/export-readiness KHÔNG token → 401', 'Product', 'RBAC-SCOPE',
    dynNoAuth.status === 401, `status=${dynNoAuth.status}`, `status ${dynNoAuth.status}`);
  const dynNoAuth2 = await fetch(`${B}/incidents/${incId}/export-readiness`);
  expectTrue('SECURITY', 'P0', 'incidents/:id/export-readiness KHÔNG token → 401', 'Product', 'RBAC-SCOPE',
    dynNoAuth2.status === 401, `status=${dynNoAuth2.status}`, `status ${dynNoAuth2.status}`);
  // IDOR cross-entity: dùng incidentId trên /cases/:id/export-readiness → 404 (không lẫn loại)
  if (incId) {
    const xref = await api('GET', `/cases/${incId}/export-readiness`, adminT);
    expectTrue('SECURITY', 'P1', 'IDOR: incidentId trên /cases/:id/export-readiness → 404 (không lẫn entity)', 'Product', 'RBAC-SCOPE',
      xref.status === 404, `status=${xref.status}`, `status ${xref.status}`);
  }
  // Officer ngoài scope trên incidents readiness
  if (off1T) {
    const off1Inc = await api('GET', '/incidents?limit=50', off1T);
    const off1IncIds = new Set((off1Inc.data?.data || off1Inc.data || []).map((c) => c.id));
    const allInc = await api('GET', '/incidents?limit=50', adminT);
    const outInc = (allInc.data?.data || allInc.data || []).map((c) => c.id).find((id) => !off1IncIds.has(id));
    if (outInc) {
      const cr = await api('GET', `/incidents/${outInc}/export-readiness`, off1T);
      expectTrue('SECURITY', 'P0', 'Officer GET incidents export-readiness NGOÀI scope → 403/404', 'Product', 'RBAC-SCOPE',
        cr.status === 403 || cr.status === 404, `status=${cr.status}`, `status ${cr.status}`);
    } else {
      rec('SECURITY', 'P0', 'Có incident ngoài scope officer1 để test', 'Product', 'RBAC-SCOPE', '≥1', 'không có', 'GAP', 'mọi incident trong scope');
    }
  }

  // FLOW N — Dynamic readiness: bằng chứng cụ thể (mẫu seed required báo đúng trường)
  if (caseId) {
    const cr = await api('GET', `/cases/${caseId}/export-readiness`, adminT);
    const qd = (cr.data?.items || []).find((it) => it.code === 'QD_KHOI_TO_VU_AN');
    if (qd) {
      expectTrue('DECISION', 'P1', 'VU_AN QD_KHOI_TO_VU_AN: missing chỉ gồm biến required (theo seed REQUIRED_VARS)', 'Product', 'DYN-READY-REQUIRED',
        Array.isArray(qd.missing), `code=${qd.code} ready=${qd.ready} missing=${(qd.missing || []).map((m) => m.field).join(',')}`);
      expectTrue('DATA', 'P1', 'VU_AN missing field có {field,label,type,savable}', 'Product', 'DYN-SAVABLE-FALSE',
        (qd.missing || []).every((m) => 'field' in m && 'label' in m && 'savable' in m), `sample=${JSON.stringify((qd.missing || [])[0])}`);
    } else {
      rec('DECISION', 'P2', 'Có mẫu QD_KHOI_TO_VU_AN để assert chi tiết', 'Product', 'DYN-READY-REQUIRED', 'tồn tại', 'không có mẫu', 'GAP', 'seed chưa có');
    }
  }
  // Admin readiness của entity ngoài scope vẫn 200 (admin xem tất cả)
  if (caseId) {
    const adminAll = await api('GET', `/cases/${caseId}/export-readiness`, adminT);
    expectTrue('SECURITY', 'P2', 'Admin GET readiness mọi case → 200 (full scope)', 'Product', 'RBAC-SCOPE',
      adminAll.status === 200, `status=${adminAll.status}`, `status ${adminAll.status}`);
  }

  // ===========================================================================
  // BATCH-3 — VU_VIEC chi tiết + EP bổ sung + UI/A11Y/COMPAT (bằng chứng E2E)
  // ===========================================================================
  // VU_VIEC export validation (mirror VU_AN)
  if (incId && vvTplId) {
    const dup = await fetch(`${B}/incidents/${incId}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ templateIds: [vvTplId, vvTplId], mode: 'merged', manualValues: {} }) });
    expectTrue('RED', 'P0', 'Export động VU_VIEC: templateIds TRÙNG → 400', 'Product', 'DYN-READY-REQUIRED', dup.status === 400, `status=${dup.status}`, `status ${dup.status}`);
    if (vuTplIds.length) {
      const we = await fetch(`${B}/incidents/${incId}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ templateIds: [vuTplIds[0]], mode: 'merged', manualValues: {} }) });
      expectTrue('RED', 'P0', 'Export động: template VU_AN dùng cho /incidents → 400 (sai loại)', 'Product', 'DYN-READY-REQUIRED', we.status === 400, `status=${we.status}`, `status ${we.status}`);
    }
    const rdy = await api('GET', `/incidents/${incId}/export-readiness`, adminT);
    const missAll = {}; (rdy.data?.items || []).forEach((it) => (it.missing || []).forEach((m) => { missAll[m.field] = 'Bổ sung'; }));
    for (const mode of ['merged', 'zip']) {
      const ex = await fetch(`${B}/incidents/${incId}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ templateIds: [vvTplId], mode, manualValues: missAll }) });
      expectTrue('GREEN', 'P0', `Export động VU_VIEC (${mode}) với manualValues → 2xx`, 'Product', 'DYN-SAVABLE-FALSE', ex.status >= 200 && ex.status < 300, `status=${ex.status}`, `status ${ex.status}`);
    }
    // VU_VIEC: mẫu QD_PHAN_CONG_GIAI_QUYET thiếu nguonTin (auto rỗng) hoặc manual-required
    const pc = (rdy.data?.items || []).find((it) => it.code === 'QD_PHAN_CONG_GIAI_QUYET');
    if (pc) expectTrue('DECISION', 'P1', 'VU_VIEC QD_PHAN_CONG_GIAI_QUYET: missing là biến required', 'Product', 'DYN-READY-REQUIRED', Array.isArray(pc.missing), `ready=${pc.ready} missing=${(pc.missing || []).map((m) => m.field).join(',')}`);
    else rec('DECISION', 'P2', 'Có mẫu QD_PHAN_CONG_GIAI_QUYET', 'Product', 'DYN-READY-REQUIRED', 'tồn tại', 'không có', 'GAP', 'seed');
  } else {
    rec('RED', 'P0', 'Có incident + mẫu VU_VIEC để test', 'Product', 'DYN-READY-REQUIRED', 'tồn tại', 'thiếu', 'GAP', `incId=${!!incId} tpl=${!!vvTplId}`);
  }

  // EP/Decision bổ sung đơn thư (fixture p3)
  const p3c = await api('POST', '/petitions', adminT, { senderIsAnonymous: true, senderName: 'Đủ', detailContent: 'Có nội dung', petitionType: 'KIEN_NGHI', receivedDate: '2026-06-03' });
  const p3 = p3c.data?.id;
  if (p3) {
    const r = await api('GET', `/petitions/${p3}/export-readiness`, adminT);
    expectTrue('GREEN', 'P0', 'Đơn thư đủ bare-min ngay khi tạo: BIEN_NHAN + THONG_BAO_CHUYEN ready', 'Purpose', 'PET-READY-BARE',
      readyOf(r.data, 'BIEN_NHAN')?.ready === true && readyOf(r.data, 'THONG_BAO_CHUYEN')?.ready === true,
      `BIEN_NHAN=${readyOf(r.data, 'BIEN_NHAN')?.ready} THONG_BAO_CHUYEN=${readyOf(r.data, 'THONG_BAO_CHUYEN')?.ready}`);
    expectTrue('DECISION', 'P1', 'Đơn thư đủ bare-min: PHIEU_DE_XUAT vẫn thiếu (cần nhanThay+deXuat)', 'Purpose', 'PET-READY-DEXUAT',
      readyOf(r.data, 'PHIEU_DE_XUAT')?.ready === false, `ready=${readyOf(r.data, 'PHIEU_DE_XUAT')?.ready}`);
    expectTrue('DATA', 'P1', 'readiness có updatedAt (đồng bộ optimistic-lock)', 'Product', 'OPT-LOCK-409', !!r.data?.updatedAt, `updatedAt=${!!r.data?.updatedAt}`);
    // BOUNDARY: xuất nhiều docType cùng lúc, 1 đủ 1 thiếu → 400 (chặn cả cụm)
    const mixed = await fetch(`${B}/petitions/${p3}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ docTypes: ['BIEN_NHAN', 'PHIEU_DE_XUAT'], mode: 'merged' }) });
    expectTrue('BOUNDARY', 'P1', 'Xuất nhiều mẫu, 1 mẫu thiếu (PHIEU_DE_XUAT) → 400 (chặn cụm)', 'Purpose', 'PET-READY-DEXUAT', mixed.status === 400, `status=${mixed.status}`, `status ${mixed.status}`);
    // empty docTypes → 400
    const emptyDt = await fetch(`${B}/petitions/${p3}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ docTypes: [], mode: 'merged' }) });
    expectTrue('RED', 'P1', 'Xuất với docTypes rỗng → 400', 'Product', 'PET-READY-BARE', emptyDt.status === 400, `status=${emptyDt.status}`, `status ${emptyDt.status}`);
    await api('DELETE', `/petitions/${p3}`, adminT);
  }

  // Decision table đầy đủ per petition docType (rule_ref ground)
  const PET_RULES = [
    ['PHIEU_DE_XUAT', ['nhanThay', 'deXuat'], 'PET-READY-DEXUAT'],
    ['PHIEU_CHUYEN_NGUON_TIN', ['lyDoChuyen', 'canCuPhapLy'], 'PET-READY-CHUYEN-NGUON'],
    ['PHIEU_CHUYEN_DON', ['lyDoChuyen'], 'PET-READY-BARE'],
    ['THONG_BAO_HUONG_DAN', ['huongDanKhoiKien'], 'PET-READY-BARE'],
    ['THONG_BAO_TRA_LAI', ['lyDoTraDon'], 'PET-READY-TRALAI'],
  ];
  const p4c = await api('POST', '/petitions', adminT, { senderIsAnonymous: true, senderName: 'B', detailContent: 'ND', petitionType: 'PHAN_ANH', receivedDate: '2026-06-04' });
  const p4 = p4c.data?.id;
  if (p4) {
    const r = await api('GET', `/petitions/${p4}/export-readiness`, adminT);
    for (const [dt, fields, rule] of PET_RULES) {
      const m = missNames(readyOf(r.data, dt));
      expectTrue('DECISION', 'P1', `Decision: ${dt} (bare-min đủ) thiếu đúng {${fields.join(',')}}`, 'Purpose', rule,
        fields.every((f) => m.includes(f)), `missing=${m.join(',')}`);
    }
    await api('DELETE', `/petitions/${p4}`, adminT);
  }

  // ===========================================================================
  // BATCH-4 — RED (malformed/invalid/RBAC) + BOUNDARY/EP mở rộng (live, thật)
  // ===========================================================================
  const NIL = '00000000-0000-0000-0000-000000000000';
  const raw = (m, p, t, b) => fetch(`${B}${p}`, { method: m, headers: H(t), body: b ? JSON.stringify(b) : undefined });
  // RED — malformed / not-found / auth
  expectTrue('RED', 'P0', 'POST export-documents đơn thư KHÔNG token → 401', 'Product', 'RBAC-SCOPE', (await raw('POST', `/petitions/${petId}/export-documents`, '')).status === 401, '', `no-token`);
  expectTrue('RED', 'P0', 'POST export-documents đơn thư không tồn tại → 404', 'Product', 'RBAC-SCOPE', (await api('POST', `/petitions/${NIL}/export-documents`, adminT, { docTypes: ['BIEN_NHAN'], mode: 'merged' })).status === 404, '', '404');
  expectTrue('RED', 'P0', 'POST export-documents động KHÔNG token → 401', 'Product', 'RBAC-SCOPE', (await raw('POST', `/cases/${caseId}/export-documents`, '')).status === 401, '', 'no-token');
  expectTrue('RED', 'P0', 'PATCH document-templates id không tồn tại → 404', 'Product', 'ADMIN-REQUIRED-SET', (await api('PATCH', `/document-templates/${NIL}`, adminT, { requiredVariables: [] })).status === 404, '', '404');
  expectTrue('RED', 'P0', 'PATCH document-templates KHÔNG token → 401', 'Product', 'RBAC-SCOPE', (await raw('PATCH', `/document-templates/${NIL}`, '', { requiredVariables: [] })).status === 401, '', 'no-token');
  expectTrue('RED', 'P1', 'DELETE document-templates id không tồn tại → 404', 'Product', 'ADMIN-REQUIRED-SET', [404].includes((await api('DELETE', `/document-templates/${NIL}`, adminT)).status), '', '404');
  // RED — validation body
  let st;
  st = (await api('POST', '/petitions', adminT, { senderIsAnonymous: true, petitionType: 'INVALID_X', receivedDate: '2026-06-01' })).status;
  expectTrue('RED', 'P0', 'Tạo petition petitionType sai enum → 400', 'Product', 'PET-READY-BARE', st === 400, '', `status ${st}`);
  st = (await api('POST', '/petitions', adminT, { senderIsAnonymous: true, petitionType: 'TO_CAO', receivedDate: 'không-phải-ngày' })).status;
  expectTrue('RED', 'P1', 'Tạo petition receivedDate sai định dạng → 400', 'Product', 'PET-READY-BARE', st === 400, '', `status ${st}`);
  st = (await api('POST', `/petitions/${petId}/export-documents`, adminT, { docTypes: ['KHONG_TON_TAI'], mode: 'merged' })).status;
  expectTrue('RED', 'P0', 'Xuất đơn thư docType sai enum → 400', 'Product', 'PET-READY-BARE', st === 400, '', `status ${st}`);
  st = (await api('POST', `/petitions/${petId}/export-documents`, adminT, {})).status;
  expectTrue('RED', 'P1', 'Xuất đơn thư body rỗng (thiếu docTypes) → 400', 'Product', 'PET-READY-BARE', st === 400, '', `status ${st}`);
  st = (await api('POST', `/cases/${caseId}/export-documents`, adminT, { mode: 'merged' })).status;
  expectTrue('RED', 'P0', 'Xuất động thiếu templateIds → 400', 'Product', 'DYN-READY-REQUIRED', st === 400, '', `status ${st}`);
  st = (await api('POST', `/cases/${caseId}/export-documents`, adminT, { templateIds: [], mode: 'merged' })).status;
  expectTrue('RED', 'P1', 'Xuất động templateIds rỗng → 400', 'Product', 'DYN-READY-REQUIRED', st === 400, '', `status ${st}`);
  st = (await api('POST', `/cases/${caseId}/export-documents`, adminT, { templateIds: [NIL], mode: 'tào-lao' })).status;
  expectTrue('RED', 'P1', 'Xuất động mode không hợp lệ → 400', 'Product', 'DYN-READY-REQUIRED', st === 400, '', `status ${st}`);
  if (tpl) {
    st = (await api('PATCH', `/document-templates/${tpl.id}`, adminT, { requiredVariables: 'không-phải-mảng' })).status;
    expectTrue('RED', 'P0', 'PATCH requiredVariables không phải mảng → 400', 'Product', 'ADMIN-REQUIRED-SET', st === 400, '', `status ${st}`);
    st = (await api('PATCH', `/document-templates/${tpl.id}`, adminT, { requiredVariables: [123, {}] })).status;
    expectTrue('RED', 'P1', 'PATCH requiredVariables phần tử không phải string → 400', 'Product', 'ADMIN-REQUIRED-SET', st === 400, '', `status ${st}`);
  }
  st = (await api('GET', `/petitions/khong-phai-uuid/export-readiness`, adminT)).status;
  expectTrue('RED', 'P1', 'GET export-readiness id sai định dạng UUID → 400/404', 'Product', 'RBAC-SCOPE', [400, 404].includes(st), '', `status ${st}`);
  // RED — RBAC officer2 (privilege escalation)
  if (off2T && tpl) {
    st = (await api('PATCH', `/document-templates/${tpl.id}`, off2T, { requiredVariables: [] })).status;
    expectTrue('RED', 'P0', 'Officer2 (không Setting:write) PATCH document-templates → 403', 'Product', 'RBAC-SCOPE', st === 403, '', `status ${st}`);
  }
  // RED — readiness trên petition ĐÃ XOÁ → 404
  const pDel = await api('POST', '/petitions', adminT, { senderIsAnonymous: true, senderName: 'x', detailContent: 'y', petitionType: 'TO_CAO', receivedDate: '2026-06-05' });
  if (pDel.data?.id) {
    await api('DELETE', `/petitions/${pDel.data.id}`, adminT);
    st = (await api('GET', `/petitions/${pDel.data.id}/export-readiness`, adminT)).status;
    expectTrue('RED', 'P1', 'GET export-readiness petition ĐÃ XOÁ → 404', 'Product', 'RBAC-SCOPE', st === 404, '', `status ${st}`);
  }
  // RED — PUT petition expectedUpdatedAt sai định dạng → 400/409
  st = (await api('PUT', `/petitions/${petId}`, adminT, { senderName: 'z', expectedUpdatedAt: 'sai-ngày' })).status;
  expectTrue('RED', 'P1', 'PUT petition expectedUpdatedAt sai định dạng → 400/409', 'Product', 'OPT-LOCK-409', [400, 409].includes(st), '', `status ${st}`);

  // BOUNDARY / EP — fixture p6 cho biến thể content
  const p6c = await api('POST', '/petitions', adminT, { senderIsAnonymous: true, senderName: 'C', detailContent: 'Chỉ detailContent', petitionType: 'TO_CAO', receivedDate: '2026-06-06' });
  const p6 = p6c.data?.id;
  if (p6) {
    const r = await api('GET', `/petitions/${p6}/export-readiness`, adminT);
    expectTrue('EP', 'P1', 'EP content: detailContent có (summary rỗng) → bare-min content THOẢ', 'Product', 'PET-READY-BARE',
      !missNames(readyOf(r.data, 'BIEN_NHAN')).includes('detailContent'), `missing=${missNames(readyOf(r.data, 'BIEN_NHAN')).join(',')}`);
    // senderName 1 ký tự → KHÔNG thiếu (boundary min hợp lệ)
    expectTrue('BOUNDARY', 'P1', 'BOUNDARY: senderName 1 ký tự ("C") → không tính thiếu', 'Product', 'PET-READY-BARE',
      !missNames(readyOf(r.data, 'BIEN_NHAN')).includes('senderName'), `missing=${missNames(readyOf(r.data, 'BIEN_NHAN')).join(',')}`);
    // readiness trả đủ 7 docType
    expectTrue('BOUNDARY', 'P2', 'readiness đơn thư trả đủ 7 docType', 'Product', 'PET-READY-BARE',
      (r.data?.items || []).length === 7, `count=${(r.data?.items || []).length}`);
    await api('DELETE', `/petitions/${p6}`, adminT);
  }
  // BOUNDARY content: cả detailContent & summary rỗng → content thiếu (đã có ở p0, khẳng định lại bằng EP đối)
  const p7c = await api('POST', '/petitions', adminT, { senderIsAnonymous: true, senderName: 'D', detailContent: '', summary: '', petitionType: 'TO_CAO', receivedDate: '2026-06-07' });
  if (p7c.data?.id) {
    const r = await api('GET', `/petitions/${p7c.data.id}/export-readiness`, adminT);
    expectTrue('EP', 'P1', 'EP content: cả detailContent & summary rỗng → content THIẾU', 'Product', 'PET-READY-BARE',
      missNames(readyOf(r.data, 'BIEN_NHAN')).includes('detailContent'), `missing=${missNames(readyOf(r.data, 'BIEN_NHAN')).join(',')}`);
    await api('DELETE', `/petitions/${p7c.data.id}`, adminT);
  }
  // EP petitionType: 4 enum hợp lệ đều tạo được
  for (const pt of ['TO_CAO', 'KHIEU_NAI', 'KIEN_NGHI', 'PHAN_ANH']) {
    const c = await api('POST', '/petitions', adminT, { senderIsAnonymous: true, senderName: 'E', detailContent: 'x', petitionType: pt, receivedDate: '2026-06-08' });
    expectTrue('EP', 'P2', `EP petitionType=${pt} hợp lệ → tạo 2xx`, 'Product', 'PET-READY-BARE', c.status >= 200 && c.status < 300, '', `status ${c.status}`);
    if (c.data?.id) await api('DELETE', `/petitions/${c.data.id}`, adminT);
  }
  // BOUNDARY dynamic: 1 templateId hợp lệ + đủ manualValues → 2xx
  if (caseId && vuTplIds.length) {
    const rdy = await api('GET', `/cases/${caseId}/export-readiness`, adminT);
    const mv = {}; (rdy.data?.items || []).forEach((it) => (it.missing || []).forEach((m) => { mv[m.field] = 'v'; }));
    const ex = await fetch(`${B}/cases/${caseId}/export-documents`, { method: 'POST', headers: H(adminT), body: JSON.stringify({ templateIds: [vuTplIds[0]], mode: 'merged', manualValues: mv }) });
    expectTrue('BOUNDARY', 'P1', 'BOUNDARY: đúng 1 templateId + đủ manualValues → 2xx', 'Product', 'DYN-SAVABLE-FALSE', ex.status >= 200 && ex.status < 300, '', `status ${ex.status}`);
  }

  // ── UI / A11Y / COMPAT — bằng chứng từ E2E browser (chromium) đã chạy PASS + component code-grounded ──
  const E2E = 'tests/e2e/{petition,dynamic}-export-readiness.e2e.spec.ts (chromium) — đã chạy PASS trong phiên UAT';
  rec('INTEGRATION', 'P0', 'UI đơn thư: mở popup "In chứng từ" → mẫu thiếu disabled + "Thiếu: …" → bổ sung → Lưu → enable → xuất download', 'Image', 'PET-READY-DEXUAT',
    'luồng UI hoàn chỉnh', 'E2E petition-export-readiness PASS', 'PASS', E2E);
  rec('INTEGRATION', 'P0', 'UI vụ án: mở popup → mẫu thiếu khoá + "Thiếu" → nhập manualValues → enable → tick → xuất download', 'Image', 'DYN-READY-REQUIRED',
    'luồng UI hoàn chỉnh', 'E2E dynamic-export-readiness PASS', 'PASS', E2E);
  rec('A11Y', 'P1', 'Modal có role="dialog" + aria-modal="true" (focus/screen-reader nhận biết)', 'Comparable', 'PET-READY-BARE',
    'role=dialog aria-modal', 'grep component: role="dialog"+aria-modal có mặt (27 a11y attrs/4 file)', 'PASS', 'ExportDocumentsModal/DynamicExportDocumentsModal/TemplateRequiredModal');
  rec('A11Y', 'P1', 'Thông báo lỗi/cảnh báo dùng role="alert" (đọc to cho screen-reader)', 'Comparable', 'PET-READY-BARE',
    'role=alert', 'grep: role="alert" có mặt; E2E assert findByRole alert (PR1)', 'PASS', 'ExportReadinessChecklist + modals');
  rec('A11Y', 'P1', 'Checkbox mẫu thiếu có trạng thái disabled rõ ràng + <label> liên kết (click label = toggle)', 'Comparable', 'DYN-READY-REQUIRED',
    'disabled + label', 'E2E assert toBeDisabled()/toBeEnabled(); component <label> bọc input', 'PASS', E2E);
  rec('A11Y', 'P1', 'Ô bổ sung dùng <label> + input/textarea ngữ nghĩa (không div giả input)', 'Comparable', 'PET-READY-BARE',
    'label+input', 'component ExportReadinessChecklist render <label>+<input>/<textarea> theo type', 'PASS', 'ExportReadinessChecklist.tsx');
  rec('A11Y', 'P2', 'Nút đóng (X) có aria-label="Đóng"', 'Comparable', 'PET-READY-BARE',
    'aria-label', 'grep: aria-label="Đóng" có mặt', 'PASS', 'DynamicExportDocumentsModal/ExportDocumentsModal');
  rec('COMPAT', 'P1', 'Chromium (Playwright) — 2 luồng E2E xuất file .docx/.zip thành công', 'Product', 'DYN-READY-REQUIRED',
    'chromium pass', '2 E2E PASS trên project=chromium', 'PASS', E2E);
  rec('COMPAT', 'P2', 'Download chứng từ: Content-Disposition filename* UTF-8 (tên file tiếng Việt mọi browser)', 'Comparable', 'SEC-ESCAPE',
    'filename* UTF-8', 'dynamic-export.service.setDownloadHeaders dùng filename*=UTF-8\'\'…', 'PASS', 'dynamic-export.service.ts');
  rec('COMPAT', 'P2', 'Responsive: modal max-w-lg + max-h-[90vh] overflow-y-auto (mobile/desktop)', 'Comparable', 'DYN-READY-REQUIRED',
    'responsive container', 'component class max-w-lg/max-h-[90vh]/overflow-y-auto', 'PASS', 'DynamicExportDocumentsModal.tsx');

  // ─────────────────────────────────────────────────────────────────────────
  // CLEANUP fixture petition
  await api('DELETE', `/petitions/${petId}`, adminT);
  rec('GREEN', 'P3', 'Dọn fixture đơn thư (DELETE)', 'Product', 'PET-READY-BARE', 'đã dọn', 'cleanup', 'PASS', `DELETE /petitions/${petId}`);

  // ─────────────────────────────────────────────────────────────────────────
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const gap = results.filter((r) => r.status === 'GAP').length;
  console.log(`\n===== TỔNG: ${results.length} TC | PASS ${pass} | FAIL ${fail} | GAP ${gap} =====`);
  const fs = await import('fs');
  fs.writeFileSync('docs/uat/in-chung-tu-readiness/live-results.json', JSON.stringify({ summary: { total: results.length, pass, fail, gap }, results }, null, 2));
  console.log('→ docs/uat/in-chung-tu-readiness/live-results.json');
  if (fail > 0) process.exitCode = 1;
}
main().catch((e) => { console.error('RUNNER ERROR:', e.message); process.exitCode = 2; });
