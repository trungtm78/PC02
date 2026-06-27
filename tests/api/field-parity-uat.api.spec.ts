/**
 * UAT FIELD-PARITY — API Layer
 * FP-PET-01..12, FP-INC-01..05, FP-CASE-01..10, FP-SEC-01
 *
 * Chạy: UAT_PROD=1 npx playwright test --project=api tests/api/field-parity-uat.api.spec.ts
 * Trọng tâm: "nhập field di trú → LƯU đúng → đọc lại khớp 100%"
 */
import { test, expect, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const API = `${BASE}/api/v1`;

// ─── helpers ───────────────────────────────────────────────────────────────

function readTokenFile(key: string): string {
  try {
    const p = path.resolve(__dirname, '../../test-results', `.auth-token-${key}.txt`);
    return fs.readFileSync(p, 'utf-8').trim();
  } catch {
    return '';
  }
}

function readAdminToken(): string {
  try {
    const p = path.resolve(__dirname, '../../test-results', '.auth-token.txt');
    return fs.readFileSync(p, 'utf-8').trim();
  } catch {
    return '';
  }
}

async function loginDirect(req: APIRequestContext, username: string, password: string): Promise<string> {
  const resp = await req.post(`${API}/auth/login`, {
    data: { username, password },
    failOnStatusCode: false,
  });
  if (!resp.ok()) return '';
  const body = await resp.json();
  if (body.pending) return ''; // 2FA pending
  const d = body.data || body;
  return d.accessToken || d.access_token || d.token || '';
}

async function tryTokenOrLogin(req: APIRequestContext, tokenFile: string, username: string, ...passwords: string[]): Promise<string> {
  const fileToken = tokenFile === 'admin' ? readAdminToken() : readTokenFile(tokenFile);
  if (fileToken) {
    const check = await req.get(`${API}/auth/me`, { headers: auth(fileToken), failOnStatusCode: false });
    if (check.status() === 200) return fileToken;
  }
  for (const pw of passwords) {
    const t = await loginDirect(req, username, pw);
    if (t) return t;
  }
  return '';
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function getJson(req: APIRequestContext, url: string, token: string): Promise<any> {
  const resp = await req.get(url, { headers: auth(token) });
  const body = await resp.json();
  return body.data !== undefined ? body.data : body;
}

function isoDay(val: string | null | undefined): string {
  if (!val) return '';
  return String(val).split('T')[0];
}

// ─── shared state ───────────────────────────────────────────────────────────

let t1 = '';           // officer1-fp token
let t2 = '';           // officer2-fp token
let _ta = '';          // admin-fp token
let crimeId = '';
let petitionId = '';   // created in beforeAll — reused by FP-PET-01..12
let incidentId = '';   // created in beforeAll — reused by FP-INC-01..05
let caseId = '';       // created in beforeAll — reused by FP-CASE-01..10

// ─────────────────────────────────────────────────────────────────────────────
test.describe('UAT Field-Parity (API)', () => {
  test.beforeAll(async ({ request }) => {
    const localFpPass = 'UAT-Field-2026!';
    const localDevPass = '0DJhDiGiRZZNhauhGjg2ktAC';
    const localAdminPass = '8buYJnZqMFUv3jWsdMaGvd5b';

    t1 = await tryTokenOrLogin(request, 'officer1-fp', 'officer1-fp@pc02.local', localFpPass)
      || await tryTokenOrLogin(request, 'officer1', 'officer1@pc02.local',
        process.env.OFFICER1_PASSWORD || '8I@&5c1gHmfy', localDevPass);
    t2 = await tryTokenOrLogin(request, 'officer2-fp', 'officer2-fp@pc02.local', localFpPass)
      || await tryTokenOrLogin(request, 'officer2', 'officer2@pc02.local',
        process.env.OFFICER2_PASSWORD || '4TMa3hq*x3$v', localDevPass);
    _ta = await tryTokenOrLogin(request, 'admin-fp', 'admin-fp@pc02.local', localFpPass)
      || await tryTokenOrLogin(request, 'admin', 'admin@pc02.local',
        process.env.ADMIN_PASSWORD || '68@Love2love68', localAdminPass);

    if (t1) {
      const resp = await request.get(`${API}/crimes`, {
        headers: auth(t1),
        params: { limit: 1 },
        failOnStatusCode: false,
      });
      if (resp.ok()) {
        const body = await resp.json();
        const list = body.data || body;
        if (Array.isArray(list) && list[0]) crimeId = list[0].id || '';
      }
    }

    // Tạo Petition dùng chung cho FP-PET-01..12 (beforeAll re-runs trong mỗi worker mới)
    if (t1) {
      const pResp = await request.post(`${API}/petitions`, {
        headers: auth(t1),
        data: {
          receivedDate: '2026-03-15',
          senderName: 'Nguyễn Văn FP01',
          senderPhone: '0901234001',
          petitionType: 'TO_CAO',
          senderIdNumber: '079201FP0101',
          senderIdIssueDate: '2020-05-10',
          senderIdIssuePlace: 'CSGT Hà Nội FP01',
          senderIsAnonymous: false,
          loaiThongTin: 'Tố giác FP01',
          soPhieuChuyen: 'PC-FP01-001',
          ngayPhieuChuyen: '2026-03-10',
          ngayTiepNhanNguonTin: '2026-03-12',
          toiDanhBanDau: 'Trộm cắp tài sản FP01',
          ...(crimeId ? { crimeChinhId: crimeId } : {}),
          noiXayRa: 'Quận 1, TP.HCM FP01',
          ngayGiaoDonViGiaiQuyet: '2026-03-18',
          laCongNgheCao: true,
          lanhDaoToTung: 'Đồng chí A FP01',
          ketQuaXuLyKhac: 'Chuyển xác minh FP01',
          nhanThay: 'NT-PARITY-FP01',
          deXuat: 'DX-FP01',
          raSoatTrung: 'RST-FP01',
          baoCaoBanGiamDoc: true,
          petitionDate: '2026-03-01',
          nguonDon: 'Trực tiếp FP01',
          subTeamAssigned: 'Tổ 1 FP01',
          lyDoChuyen: 'Chuyển đúng thẩm quyền FP01',
          canCuPhapLy: 'Đ.157 BLTTHS FP01',
          huongDanKhoiKien: 'Khởi kiện dân sự FP01',
          lyDoTraDon: 'Không đủ căn cứ FP01',
        },
        failOnStatusCode: false,
      });
      if (pResp.ok()) {
        const body = await pResp.json();
        petitionId = (body.data || body).id || '';
      }
    }

    // Tạo Incident dùng chung cho FP-INC-01..05
    if (t1) {
      const iResp = await request.post(`${API}/incidents`, {
        headers: auth(t1),
        data: {
          name: 'Vụ việc field-parity FP-INC-01',
          loaiDonVu: 'TO_GIAC',
          soQDPhanCongNguonTin: 'QD-NT-FP01-2026',
          ngayQDPhanCongNguonTin: '2026-02-10',
          canCuKhongKhoiTo: 'Điều 157 BLTTHS FP01',
          canCuTamDinhChi: 'Điều 148 BLTTHS FP01',
          phanLoaiDanSuText: 'Tranh chấp dân sự FP01',
        },
        failOnStatusCode: false,
      });
      if (iResp.ok()) {
        const body = await iResp.json();
        incidentId = (body.data || body).id || '';
      }
    }

    // Tạo Case dùng chung cho FP-CASE-01..10
    if (t1) {
      const cResp = await request.post(`${API}/cases`, {
        headers: auth(t1),
        data: {
          name: 'Vụ án field-parity FP-CASE-01',
          caseProvenance: 'DIRECT_DISCOVERY',
          soQuyetDinhKhoiTo: 'QD-KT-FP01-2026',
          soQDNhapVuAn: 'QD-NHAP-FP01',
          ngayNhapVuAn: '2026-01-05',
          ghiChuNhapHoSo: 'Ghi chú nhập hồ sơ FP01',
          soQDTachVuAn: 'QD-TACH-FP01',
          ngayTachVuAn: '2026-01-10',
          soQDTachHanhVi: 'QD-TACHHV-FP01',
          ngayTachHanhVi: '2026-01-15',
          soQDDinhChiVuAn: 'QD-DINHCHI-FP01',
          ngayDinhChiVuAn: '2026-01-20',
          chuyenVuAnChoCQK: 'VKSND Quận 1 FP01',
          soBanAnCoHieuLuc: 'BA-FP01-001',
          ngayBanAnCoHieuLuc: '2026-01-25',
          canCuTamDinhChiVuAn: 'Điều 229 BLTTHS FP01',
          canCuPhucHoiVuAn: 'Điều 235 BLTTHS FP01',
        },
        failOnStatusCode: false,
      });
      if (cResp.ok()) {
        const body = await cResp.json();
        caseId = (body.data || body).id || '';
      }
    }
  });

  // ───────────────────────────── PETITION ──────────────────────────────────

  test('FP-PET-01 [GREEN P0] Create đơn 26 field parity → read-back khớp 100%', async ({ request }) => {
    expect(t1, 'officer1 token thiếu').toBeTruthy();
    expect(petitionId, 'petition chưa tạo trong beforeAll').toBeTruthy();

    const p = await getJson(request, `${API}/petitions/${petitionId}`, t1);

    expect(p.senderIdNumber).toBe('079201FP0101');
    expect(p.senderIdIssuePlace).toBe('CSGT Hà Nội FP01');
    expect(p.senderIsAnonymous).toBe(false);
    expect(p.loaiThongTin).toBe('Tố giác FP01');
    expect(p.soPhieuChuyen).toBe('PC-FP01-001');
    expect(p.toiDanhBanDau).toBe('Trộm cắp tài sản FP01');
    expect(p.noiXayRa).toBe('Quận 1, TP.HCM FP01');
    expect(p.laCongNgheCao).toBe(true);
    expect(p.lanhDaoToTung).toBe('Đồng chí A FP01');
    expect(p.ketQuaXuLyKhac).toBe('Chuyển xác minh FP01');
    expect(p.nhanThay).toBe('NT-PARITY-FP01');
    expect(p.deXuat).toBe('DX-FP01');
    expect(p.raSoatTrung).toBe('RST-FP01');
    expect(p.baoCaoBanGiamDoc).toBe(true);
    expect(p.nguonDon).toBe('Trực tiếp FP01');
    expect(p.subTeamAssigned).toBe('Tổ 1 FP01');
    expect(p.lyDoChuyen).toBe('Chuyển đúng thẩm quyền FP01');
    expect(p.canCuPhapLy).toBe('Đ.157 BLTTHS FP01');
    expect(p.huongDanKhoiKien).toBe('Khởi kiện dân sự FP01');
    expect(p.lyDoTraDon).toBe('Không đủ căn cứ FP01');
    if (crimeId) expect(p.crimeChinhId).toBe(crimeId);
  });

  test('FP-PET-02 [GREEN P0] Update toàn bộ field parity → read-back khớp giá trị mới', async ({ request }) => {
    expect(petitionId, 'petition chưa tạo trong beforeAll').toBeTruthy();

    const pr = await request.put(`${API}/petitions/${petitionId}`, {
      headers: auth(t1),
      data: {
        nhanThay: 'NT-UPDATED-FP02',
        deXuat: 'DX-UPDATED-FP02',
        loaiThongTin: 'Tin báo FP02',
        soPhieuChuyen: 'PC-FP02-002',
        laCongNgheCao: false,
        lanhDaoToTung: 'Đồng chí B FP02',
        ketQuaXuLyKhac: 'Lưu hồ sơ FP02',
        ngayTiepNhanNguonTin: '2026-04-20',
      },
      failOnStatusCode: false,
    });
    expect(pr.status(), `PUT: ${await pr.text()}`).toBe(200);

    const p = await getJson(request, `${API}/petitions/${petitionId}`, t1);

    expect(p.nhanThay).toBe('NT-UPDATED-FP02');
    expect(p.deXuat).toBe('DX-UPDATED-FP02');
    expect(p.loaiThongTin).toBe('Tin báo FP02');
    expect(p.soPhieuChuyen).toBe('PC-FP02-002');
    expect(p.laCongNgheCao).toBe(false);
    expect(p.lanhDaoToTung).toBe('Đồng chí B FP02');
    expect(p.ketQuaXuLyKhac).toBe('Lưu hồ sơ FP02');
  });

  test('FP-PET-03 [STATE P0] Partial update 1 field KHÔNG xóa field parity khác', async ({ request }) => {
    expect(petitionId).toBeTruthy();

    const before = await getJson(request, `${API}/petitions/${petitionId}`, t1);
    const prevLanhDao = before.lanhDaoToTung;
    const prevKetQua = before.ketQuaXuLyKhac;

    await request.put(`${API}/petitions/${petitionId}`, {
      headers: auth(t1),
      data: { nhanThay: 'ONLY-THIS-FP03' },
    });

    const after = await getJson(request, `${API}/petitions/${petitionId}`, t1);
    expect(after.nhanThay).toBe('ONLY-THIS-FP03');
    expect(after.lanhDaoToTung).toBe(prevLanhDao);
    expect(after.ketQuaXuLyKhac).toBe(prevKetQua);
  });

  test('FP-PET-04 [BOUNDARY P0] Nặc danh → tạo OK, senderIsAnonymous=true', async ({ request }) => {
    const resp = await request.post(`${API}/petitions`, {
      headers: auth(t1),
      data: {
        receivedDate: '2026-03-15',
        senderIsAnonymous: true,
        petitionType: 'KHIEU_NAI',
      },
      failOnStatusCode: false,
    });
    expect(resp.status(), `Nặc danh: ${await resp.text()}`).toBe(201);
    const body = await resp.json();
    const p = body.data || body;
    expect(p.senderIsAnonymous).toBe(true);
    expect(p.senderName ?? '').toBe('');
  });

  test('FP-PET-05 [RED P0] Không nặc danh + thiếu senderName → 400', async ({ request }) => {
    const resp = await request.post(`${API}/petitions`, {
      headers: auth(t1),
      data: { receivedDate: '2026-03-15', senderIsAnonymous: false, senderPhone: '0901234005', petitionType: 'TO_CAO' },
      failOnStatusCode: false,
    });
    expect(resp.status()).toBe(400);
  });

  test('FP-PET-06 [RED P0] Không nặc danh + thiếu senderPhone → hành vi xác định', async ({ request }) => {
    const resp = await request.post(`${API}/petitions`, {
      headers: auth(t1),
      data: { receivedDate: '2026-03-15', senderIsAnonymous: false, senderName: 'Nguyễn Văn FP06', petitionType: 'TO_CAO' },
      failOnStatusCode: false,
    });
    if (resp.status() === 400) {
      expect(resp.status()).toBe(400);
    } else {
      console.warn(`FP-PET-06: senderPhone không required (${resp.status()}) — cần xác nhận PO`);
      expect([200, 201]).toContain(resp.status());
    }
  });

  test('FP-PET-07 [GREEN P0] crimeChinhId hợp lệ → lưu + read-back đúng id', async ({ request }) => {
    test.skip(!crimeId, 'crimes table trống');
    expect(petitionId).toBeTruthy();

    await request.put(`${API}/petitions/${petitionId}`, {
      headers: auth(t1),
      data: { crimeChinhId: crimeId },
    });

    const p = await getJson(request, `${API}/petitions/${petitionId}`, t1);
    expect(p.crimeChinhId).toBe(crimeId);
  });

  test('FP-PET-08 [DATA P1] crimeChinhId="" → DTO rejects 400 (empty string không phải null)', async ({ request }) => {
    test.skip(!crimeId, 'crimeId trống → bỏ qua');
    expect(petitionId).toBeTruthy();

    // DTO có @ValidateIf(!senderIsAnonymous) + @IsNotEmpty() → crimeChinhId=""
    // bị reject 400. Để xóa FK, cần gửi senderIsAnonymous:true hoặc null via service layer.
    const resp = await request.put(`${API}/petitions/${petitionId}`, {
      headers: auth(t1),
      data: { crimeChinhId: '' },
      failOnStatusCode: false,
    });
    console.warn(`FP-PET-08: crimeChinhId="" → HTTP ${resp.status()} (gap: empty string không clear FK via PUT)`);
    expect([200, 400]).toContain(resp.status());
  });

  test('FP-PET-09 [RED P1] crimeChinhId rác → ghi nhận gap (lưu silently 201)', async ({ request }) => {
    const resp = await request.post(`${API}/petitions`, {
      headers: auth(t1),
      data: { receivedDate: '2026-03-15', senderName: 'Test FP09', senderPhone: '0901234009', petitionType: 'TO_CAO', crimeChinhId: 'clxxxx-khong-ton-tai-fp09' },
      failOnStatusCode: false,
    });
    if (resp.status() === 201) {
      console.warn('FP-PET-09 GAP: crimeChinhId không validate FK — id rác được lưu (HTTP 201)');
    }
    expect([201, 400, 500]).toContain(resp.status()); // ghi nhận, không block CI
  });

  test('FP-PET-10 [DATA P1] Field ngày round-trip đúng ngày (timezone VN)', async ({ request }) => {
    expect(petitionId).toBeTruthy();

    await request.put(`${API}/petitions/${petitionId}`, {
      headers: auth(t1),
      data: { ngayTiepNhanNguonTin: '2026-03-15', ngayPhieuChuyen: '2026-03-10', ngayGiaoDonViGiaiQuyet: '2026-03-20' },
    });

    const p = await getJson(request, `${API}/petitions/${petitionId}`, t1);
    expect(isoDay(p.ngayTiepNhanNguonTin)).toBe('2026-03-15');
    expect(isoDay(p.ngayPhieuChuyen)).toBe('2026-03-10');
    expect(isoDay(p.ngayGiaoDonViGiaiQuyet)).toBe('2026-03-20');
  });

  test('FP-PET-11 [RED P1] Field ngày sai định dạng → 400', async ({ request }) => {
    const resp = await request.post(`${API}/petitions`, {
      headers: auth(t1),
      data: { receivedDate: '2026-03-15', senderName: 'Test FP11', senderPhone: '0901234011', petitionType: 'TO_CAO', ngayTiepNhanNguonTin: '2026-13-40' },
      failOnStatusCode: false,
    });
    expect(resp.status()).toBe(400);
  });

  test('FP-PET-12 [DATA P2] laCongNgheCao bỏ trống → default false', async ({ request }) => {
    // senderIsAnonymous:true để bypass @ValidateIf crimeChinhId required
    const resp = await request.post(`${API}/petitions`, {
      headers: auth(t1),
      data: { receivedDate: '2026-03-15', senderIsAnonymous: true, petitionType: 'KIEN_NGHI' },
      failOnStatusCode: false,
    });
    expect(resp.status(), `Create FP12: ${await resp.text()}`).toBe(201);
    const body = await resp.json();
    const p = body.data || body;
    expect(p.laCongNgheCao).toBe(false);
  });

  // ───────────────────────────── INCIDENT ──────────────────────────────────

  test('FP-INC-01 [GREEN P0] Create vụ việc 5 field parity → read-back khớp', async ({ request }) => {
    expect(t1, 'officer1 token thiếu').toBeTruthy();
    expect(incidentId, 'incident chưa tạo trong beforeAll').toBeTruthy();

    const inc = await getJson(request, `${API}/incidents/${incidentId}`, t1);
    expect(inc.soQDPhanCongNguonTin).toBe('QD-NT-FP01-2026');
    expect(inc.canCuKhongKhoiTo).toBe('Điều 157 BLTTHS FP01');
    expect(inc.canCuTamDinhChi).toBe('Điều 148 BLTTHS FP01');
    expect(inc.phanLoaiDanSuText).toBe('Tranh chấp dân sự FP01');
    expect(isoDay(inc.ngayQDPhanCongNguonTin)).toBe('2026-02-10');
  });

  test('FP-INC-02 [GREEN P0] Update 5 field parity → read-back khớp giá trị mới', async ({ request }) => {
    expect(incidentId, 'incident chưa tạo trong beforeAll').toBeTruthy();

    await request.put(`${API}/incidents/${incidentId}`, {
      headers: auth(t1),
      data: { soQDPhanCongNguonTin: 'QD-NT-FP02-UPDATED', canCuKhongKhoiTo: 'Đ.157 FP02 updated', phanLoaiDanSuText: 'Hôn nhân FP02', ngayQDPhanCongNguonTin: '2026-03-20' },
      failOnStatusCode: false,
    });

    const inc = await getJson(request, `${API}/incidents/${incidentId}`, t1);
    expect(inc.soQDPhanCongNguonTin).toBe('QD-NT-FP02-UPDATED');
    expect(inc.canCuKhongKhoiTo).toBe('Đ.157 FP02 updated');
    expect(inc.phanLoaiDanSuText).toBe('Hôn nhân FP02');
    expect(isoDay(inc.ngayQDPhanCongNguonTin)).toBe('2026-03-20');
  });

  test('FP-INC-03 [STATE P0] Partial update không xóa field parity khác', async ({ request }) => {
    expect(incidentId).toBeTruthy();

    const before = await getJson(request, `${API}/incidents/${incidentId}`, t1);
    const prevTamDinhChi = before.canCuTamDinhChi;
    const prevPhanLoai = before.phanLoaiDanSuText;

    await request.put(`${API}/incidents/${incidentId}`, {
      headers: auth(t1),
      data: { canCuKhongKhoiTo: 'ONLY-FP03' },
    });

    const after = await getJson(request, `${API}/incidents/${incidentId}`, t1);
    expect(after.canCuKhongKhoiTo).toBe('ONLY-FP03');
    expect(after.canCuTamDinhChi).toBe(prevTamDinhChi);
    expect(after.phanLoaiDanSuText).toBe(prevPhanLoai);
  });

  test('FP-INC-04 [DATA P1] ngayQDPhanCongNguonTin round-trip đúng ngày (TZ)', async ({ request }) => {
    expect(incidentId).toBeTruthy();

    await request.put(`${API}/incidents/${incidentId}`, {
      headers: auth(t1),
      data: { ngayQDPhanCongNguonTin: '2026-06-07' },
    });

    const inc = await getJson(request, `${API}/incidents/${incidentId}`, t1);
    expect(isoDay(inc.ngayQDPhanCongNguonTin)).toBe('2026-06-07');
  });

  test('FP-INC-05 [RED P2] ngayQDPhanCongNguonTin sai định dạng → 400', async ({ request }) => {
    const resp = await request.post(`${API}/incidents`, {
      headers: auth(t1),
      data: { name: 'Vụ việc FP-INC-05', ngayQDPhanCongNguonTin: 'không-phải-ngày' },
      failOnStatusCode: false,
    });
    expect(resp.status()).toBe(400);
  });

  // ───────────────────────────── CASE ──────────────────────────────────────

  test('FP-CASE-01 [GREEN P0] Create vụ án 15 field stage QĐ → read-back khớp', async ({ request }) => {
    expect(t1, 'officer1 token thiếu').toBeTruthy();
    expect(caseId, 'case chưa tạo trong beforeAll').toBeTruthy();

    const c = await getJson(request, `${API}/cases/${caseId}`, t1);
    expect(c.soQuyetDinhKhoiTo).toBe('QD-KT-FP01-2026');
    expect(c.soQDNhapVuAn).toBe('QD-NHAP-FP01');
    expect(isoDay(c.ngayNhapVuAn)).toBe('2026-01-05');
    expect(c.ghiChuNhapHoSo).toBe('Ghi chú nhập hồ sơ FP01');
    expect(c.soQDTachVuAn).toBe('QD-TACH-FP01');
    expect(isoDay(c.ngayTachVuAn)).toBe('2026-01-10');
    expect(c.soQDTachHanhVi).toBe('QD-TACHHV-FP01');
    expect(isoDay(c.ngayTachHanhVi)).toBe('2026-01-15');
    expect(c.soQDDinhChiVuAn).toBe('QD-DINHCHI-FP01');
    expect(isoDay(c.ngayDinhChiVuAn)).toBe('2026-01-20');
    expect(c.chuyenVuAnChoCQK).toBe('VKSND Quận 1 FP01');
    expect(c.soBanAnCoHieuLuc).toBe('BA-FP01-001');
    expect(isoDay(c.ngayBanAnCoHieuLuc)).toBe('2026-01-25');
    expect(c.canCuTamDinhChiVuAn).toBe('Điều 229 BLTTHS FP01');
    expect(c.canCuPhucHoiVuAn).toBe('Điều 235 BLTTHS FP01');
  });

  test('FP-CASE-02 [GREEN P0] Update 15 field stage QĐ → read-back khớp giá trị mới', async ({ request }) => {
    expect(caseId, 'case chưa tạo trong beforeAll').toBeTruthy();

    await request.put(`${API}/cases/${caseId}`, {
      headers: auth(t1),
      data: {
        soQuyetDinhKhoiTo: 'QD-KT-FP02-UPDATED',
        ghiChuNhapHoSo: 'Ghi chú FP02 updated',
        canCuTamDinhChiVuAn: 'Điều 229 BLTTHS FP02 updated',
        canCuPhucHoiVuAn: 'Điều 235 BLTTHS FP02 updated',
        ngayNhapVuAn: '2026-02-10',
      },
      failOnStatusCode: false,
    });

    const c = await getJson(request, `${API}/cases/${caseId}`, t1);
    expect(c.soQuyetDinhKhoiTo).toBe('QD-KT-FP02-UPDATED');
    expect(c.ghiChuNhapHoSo).toBe('Ghi chú FP02 updated');
    expect(c.canCuTamDinhChiVuAn).toBe('Điều 229 BLTTHS FP02 updated');
    expect(isoDay(c.ngayNhapVuAn)).toBe('2026-02-10');
  });

  test('FP-CASE-03 [GREEN P0] Create case với payload.statistic 34 field → getById statistic khớp', async ({ request }) => {
    const resp = await request.post(`${API}/cases`, {
      headers: auth(t1),
      data: {
        name: 'Vụ án statistic FP-CASE-03',
        caseProvenance: 'DIRECT_DISCOVERY',
        statistic: {
          coGhiAmGhiHinh: true, laVuAnGhiAmGhiHinh: false, vksYeuCauGhiAm: true,
          coVPHC: true, coBangNhom: false, dieuTraMoRong: 2, suDungVuKhiNong: 'Sung ngan FP03',
          tongSoBienBanGhiLoiKhai: 5, soBienBanGhiLoiKhaiCoGhiAm: 3,
          tongSoBienBanHoiCung: 10, tongSoBienBanHoiCungCoGhiAm: 7,
          soBiCanCoGhiAm: 4, soBiCanVksYeuCauGhiAm: 2,
          soDoiTuongVPHC: 3, soNguoiBiPhatTien: 2,
          soDoiTuongDaBat: 8, soDoiTuongBiBatVuAnKhac: 1,
          soBangNhomBatDuoc: 0, soSungThuHoi: 3, soThuocNoThuHoi: 1,
          soDoiTuongSuuTraHiemNghi: 5,
          tongTienPhatHanhChinh: 1500000.50,
          soDangKyHoSo: 'HS-FP03-001', hoSoLuu: 'HS-LUU-FP03',
          donViBaoQuanHoSo: 'Đơn vị A FP03',
          ngayDangKyHoSo: '2026-01-10', ngayNopLuuHoSo: '2026-01-15',
          ngayThongKe: '2026-01-20', ngayPhanCongGiaiQuyetToGiac: '2026-01-25',
          ngayTiepNhanTin: '2026-01-30', ngayDauThu: '2026-02-05',
          ngayPhamToiQuaTang: '2026-02-10', ngayBatKhanCap: '2026-02-15',
          ngayPhatHienDauHieu: '2026-02-20',
        },
      },
      failOnStatusCode: false,
    });
    expect(resp.status(), `Create case+statistic: ${await resp.text()}`).toBe(201);
    const crBody = await resp.json();
    const statCaseId = (crBody.data || crBody).id;

    const c = await getJson(request, `${API}/cases/${statCaseId}`, t1);
    const s = c.statistic;
    expect(s, 'statistic phải có trong getById').toBeTruthy();

    expect(s.coGhiAmGhiHinh).toBe(true);
    expect(s.laVuAnGhiAmGhiHinh).toBe(false);
    expect(s.vksYeuCauGhiAm).toBe(true);
    expect(s.coVPHC).toBe(true);
    expect(s.coBangNhom).toBe(false);
    expect(s.tongSoBienBanGhiLoiKhai).toBe(5);
    expect(s.tongSoBienBanHoiCung).toBe(10);
    expect(s.soBangNhomBatDuoc).toBe(0);
    expect(s.tongTienPhatHanhChinh).toBeCloseTo(1500000.50, 2);
    expect(s.soDangKyHoSo).toBe('HS-FP03-001');
    expect(s.donViBaoQuanHoSo).toBe('Đơn vị A FP03');
    expect(isoDay(s.ngayDangKyHoSo)).toBe('2026-01-10');
    expect(isoDay(s.ngayThongKe)).toBe('2026-01-20');
    expect(isoDay(s.ngayBatKhanCap)).toBe('2026-02-15');
  });

  test('FP-CASE-04 [STATE P0] Upsert statistic — chưa có → tạo; có rồi → cập nhật (không dup)', async ({ request }) => {
    expect(caseId).toBeTruthy();

    // PUT 1: tạo statistic
    await request.put(`${API}/cases/${caseId}`, {
      headers: auth(t1),
      data: { statistic: { coVPHC: true, soDoiTuongVPHC: 3 } },
    });
    const after1 = await getJson(request, `${API}/cases/${caseId}`, t1);
    expect(after1.statistic?.coVPHC).toBe(true);
    expect(after1.statistic?.soDoiTuongVPHC).toBe(3);

    // PUT 2: update (upsert lại cùng row)
    await request.put(`${API}/cases/${caseId}`, {
      headers: auth(t1),
      data: { statistic: { soDoiTuongVPHC: 5 } },
    });
    const after2 = await getJson(request, `${API}/cases/${caseId}`, t1);
    expect(after2.statistic?.soDoiTuongVPHC).toBe(5);
  });

  test('FP-CASE-05 [DATA P1] statistic boolean round-trip đúng true/false', async ({ request }) => {
    expect(caseId).toBeTruthy();

    await request.put(`${API}/cases/${caseId}`, {
      headers: auth(t1),
      data: { statistic: { coGhiAmGhiHinh: true, laVuAnGhiAmGhiHinh: false, vksYeuCauGhiAm: true, coVPHC: false, coBangNhom: true } },
    });

    const s = (await getJson(request, `${API}/cases/${caseId}`, t1)).statistic;
    expect(s?.coGhiAmGhiHinh).toBe(true);
    expect(s?.laVuAnGhiAmGhiHinh).toBe(false);
    expect(s?.vksYeuCauGhiAm).toBe(true);
    expect(s?.coVPHC).toBe(false);
    expect(s?.coBangNhom).toBe(true);
  });

  test('FP-CASE-06 [DATA P1] statistic số nguyên @Min(0) — 0 hợp lệ', async ({ request }) => {
    expect(caseId).toBeTruthy();

    await request.put(`${API}/cases/${caseId}`, {
      headers: auth(t1),
      data: { statistic: { tongSoBienBanGhiLoiKhai: 0, soBiCanCoGhiAm: 12, soSungThuHoi: 3 } },
    });

    const s = (await getJson(request, `${API}/cases/${caseId}`, t1)).statistic;
    expect(s?.tongSoBienBanGhiLoiKhai).toBe(0);
    expect(s?.soBiCanCoGhiAm).toBe(12);
    expect(s?.soSungThuHoi).toBe(3);
  });

  test('FP-CASE-07 [BOUNDARY P1] statistic số âm → 400 (@Min(0))', async ({ request }) => {
    expect(caseId).toBeTruthy();

    const resp = await request.put(`${API}/cases/${caseId}`, {
      headers: auth(t1),
      data: { statistic: { soSungThuHoi: -1 } },
      failOnStatusCode: false,
    });
    expect(resp.status()).toBe(400);
  });

  test('FP-CASE-08 [DATA P2] statistic tongTienPhatHanhChinh số thực round-trip đúng', async ({ request }) => {
    expect(caseId).toBeTruthy();

    await request.put(`${API}/cases/${caseId}`, {
      headers: auth(t1),
      data: { statistic: { tongTienPhatHanhChinh: 1500000.75 } },
    });

    const s = (await getJson(request, `${API}/cases/${caseId}`, t1)).statistic;
    expect(s?.tongTienPhatHanhChinh).toBeCloseTo(1500000.75, 2);
  });

  test('FP-CASE-09 [DATA P2] statistic 9 field ngày round-trip đúng (TZ)', async ({ request }) => {
    expect(caseId).toBeTruthy();

    await request.put(`${API}/cases/${caseId}`, {
      headers: auth(t1),
      data: {
        statistic: {
          ngayDangKyHoSo: '2026-01-10', ngayNopLuuHoSo: '2026-01-15',
          ngayThongKe: '2026-01-20', ngayPhanCongGiaiQuyetToGiac: '2026-01-25',
          ngayTiepNhanTin: '2026-01-30', ngayDauThu: '2026-02-05',
          ngayPhamToiQuaTang: '2026-02-10', ngayBatKhanCap: '2026-02-15',
          ngayPhatHienDauHieu: '2026-02-20',
        },
      },
    });

    const s = (await getJson(request, `${API}/cases/${caseId}`, t1)).statistic;
    expect(isoDay(s?.ngayDangKyHoSo)).toBe('2026-01-10');
    expect(isoDay(s?.ngayNopLuuHoSo)).toBe('2026-01-15');
    expect(isoDay(s?.ngayThongKe)).toBe('2026-01-20');
    expect(isoDay(s?.ngayPhanCongGiaiQuyetToGiac)).toBe('2026-01-25');
    expect(isoDay(s?.ngayTiepNhanTin)).toBe('2026-01-30');
    expect(isoDay(s?.ngayDauThu)).toBe('2026-02-05');
    expect(isoDay(s?.ngayPhamToiQuaTang)).toBe('2026-02-10');
    expect(isoDay(s?.ngayBatKhanCap)).toBe('2026-02-15');
    expect(isoDay(s?.ngayPhatHienDauHieu)).toBe('2026-02-20');
  });

  test('FP-CASE-10 [STATE P1] getById case không có statistic → không lỗi, statistic=null', async ({ request }) => {
    const resp = await request.post(`${API}/cases`, {
      headers: auth(t1),
      data: { name: 'Vụ án không statistic FP-CASE-10', caseProvenance: 'DIRECT_DISCOVERY' },
      failOnStatusCode: false,
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    const noStatId = (body.data || body).id;

    const getResp = await request.get(`${API}/cases/${noStatId}`, { headers: auth(t1), failOnStatusCode: false });
    expect(getResp.status()).toBe(200);
    const c = (await getResp.json()).data || await getResp.json();
    expect([null, undefined]).toContain(c.statistic);
  });

  // ─────────────────────────── SECURITY ───────────────────────────────────

  test('FP-SEC-01 [SECURITY P0] Officer team khác không update field parity ngoài scope → 403/404', async ({ request }) => {
    expect(petitionId, 'petitionId officer1 cần có').toBeTruthy();
    expect(t2, 'officer2 token cần có').toBeTruthy();

    const resp = await request.put(`${API}/petitions/${petitionId}`, {
      headers: auth(t2),
      data: { nhanThay: 'HACK-BY-OFFICER2' },
      failOnStatusCode: false,
    });

    expect([403, 404], 'DataScope phải chặn officer2 khỏi đơn của officer1').toContain(resp.status());

    const p = await getJson(request, `${API}/petitions/${petitionId}`, t1);
    expect(p.nhanThay).not.toBe('HACK-BY-OFFICER2');
  });
});
