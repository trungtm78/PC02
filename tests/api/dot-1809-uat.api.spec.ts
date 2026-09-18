import { test, expect, type APIRequestContext } from '@playwright/test';
import * as path from 'path';
import { createRequire } from 'module';
import { getAuthToken } from '../helpers/auth';

/**
 * UAT tầng API — đợt 18/09/2026 (docs/uat/dot-1809). HTTP thật, backend + CSDL thật. Mệnh đề của các ca ở đây là về
 * ĐIỂM CUỐI (chủ ngữ = máy chủ), nên bằng chứng HTTP là đúng tầng.
 */
const GOC = process.env.BASE_URL ?? 'http://localhost:5173';
const API = `${GOC}/api/v1`;
const ExcelJS = createRequire(__filename)(path.resolve(__dirname, '../../backend/node_modules/exceljs'));

const hdr = () => ({ Authorization: `Bearer ${getAuthToken()}` });
const THUC_THE = [
  { ten: 'petitions', cot: 'stt,senderName', canBo: 'enteredById', ma: 'stt' },
  { ten: 'cases', cot: 'caseCode,name', canBo: 'createdById', ma: 'caseCode' },
  { ten: 'incidents', cot: 'code,name', canBo: 'canBoNhapId', ma: 'code' },
] as const;

/**
 * Điểm cuối xuất có giới hạn 5 lượt/phút (tính năng thật, C5.8). Nhận 429 thì chờ đúng `Retry-After` rồi gọi lại
 * MỘT lần — như cán bộ bấm lại sau thông báo; mọi khẳng định về nội dung vẫn nguyên.
 */
async function goiXuat(request: APIRequestContext, url: string, headers?: Record<string, string>) {
  let r = await request.get(url, { headers });
  if (r.status() === 429) {
    const cho = Number(r.headers()['retry-after'] ?? '60');
    await new Promise((x) => setTimeout(x, (cho + 1) * 1000));
    r = await request.get(url, { headers });
  }
  return r;
}

async function json(r: Awaited<ReturnType<APIRequestContext['get']>>) {
  const b = await r.json();
  return b?.data !== undefined && !Array.isArray(b) && b.total === undefined ? b.data : b;
}
async function docXlsx(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const ma: string[] = [];
  ws.eachRow((row: { getCell: (i: number) => { value: unknown } }, i: number) => {
    if (i >= 8 && typeof row.getCell(1).value === 'number') ma.push(String(row.getCell(2).value));
  });
  return { ma, trangIn: ws.pageSetup, ten: ws.name };
}
/** Một cán bộ có hồ sơ: người nhập của dòng đầu danh sách. */
async function motCanBo(request: APIRequestContext, ten: string): Promise<string> {
  const r = await request.get(`${API}/${ten}?limit=50&offset=0`, { headers: hdr() });
  const d = (await r.json()).data as Array<Record<string, { id?: string } | undefined>>;
  const x = d.find((h) => h.enteredBy?.id || h.createdBy?.id || h.canBoNhap?.id);
  return (x?.enteredBy?.id ?? x?.createdBy?.id ?? x?.canBoNhap?.id) as string;
}

test.describe('YC-5 · xuất Excel theo bộ lọc (API)', () => {
  test.describe.configure({ timeout: 150_000 });
  for (const t of THUC_THE) {
    test(`A01 [R5-EXPORT auth] ${t.ten}: chưa đăng nhập → 401, không lộ tệp`, async ({ request }) => {
      const r = await goiXuat(request, `${API}/${t.ten}/export/danh-sach`);
      expect(r.status()).toBe(401);
    });

    test(`A02 [R5-EXPORT cột lạ] ${t.ten}: cột không có → 400 kèm câu rõ`, async ({ request }) => {
      const r = await goiXuat(request, `${API}/${t.ten}/export/danh-sach?cot=${t.cot},matKhau`, hdr());
      expect(r.status()).toBe(400);
      expect(JSON.stringify(await r.json())).toMatch(/matKhau/);
    });

    test(`A03 [R5-FILTER, R5-EXPORT] ${t.ten}: cùng bộ lọc → danh sách = thẻ số = tệp, cùng thứ tự`, async ({ request }) => {
      const canBo = await motCanBo(request, t.ten);
      const q = `${t.canBo}=${canBo}`;
      const ds = await (await request.get(`${API}/${t.ten}?${q}&limit=5&offset=0`, { headers: hdr() })).json();
      const tk = await json(await request.get(`${API}/${t.ten}/stats?${q}`, { headers: hdr() }));
      const r = await goiXuat(request, `${API}/${t.ten}/export/danh-sach?${q}&cot=${t.cot}`, hdr());
      expect(r.status()).toBe(200);
      expect(r.headers()['content-type']).toMatch(/spreadsheetml/);
      const x = await docXlsx(await r.body());
      expect(tk.total, 'thẻ số theo đúng bộ lọc danh sách').toBe(ds.total);
      expect(x.ma.length, 'tệp = đúng số dòng đang lọc').toBe(ds.total);
      const dauDs = (ds.data as Array<Record<string, string>>).map((h) => h[t.ma].replace(/^20(\d\d)-/, '$1-'));
      expect(x.ma.slice(0, dauDs.length).map((m) => m.split(' ')[0])).toEqual(dauDs);
      expect(x.trangIn.orientation).toBe('landscape');
      expect(x.trangIn.paperSize).toBe(9);
    });

    test(`A04 [R5-EMPTY] ${t.ten}: bộ lọc ra 0 dòng → 400 "không có dữ liệu", không tệp rỗng`, async ({ request }) => {
      const r = await goiXuat(
        request,
        `${API}/${t.ten}/export/danh-sach?tk=${encodeURIComponent('*~zzqxwkhongcoaicakhong')}`,
        hdr(),
      );
      expect(r.status()).toBe(400);
      expect(JSON.stringify(await r.json())).toMatch(/Không có dữ liệu/);
    });
  }

  test('A05 [R5-EXPORT phường] tệp Đơn thư phường/xã vẫn xuất, giữ tên tệp, trang in A4 ngang', async ({ request }) => {
    const r = await goiXuat(request, `${API}/petitions/export/ward?chiToPhuong=true`, hdr());
    expect(r.status()).toBe(200);
    expect(decodeURIComponent(r.headers()['content-disposition'] ?? '')).toMatch(/DonThuPhuongXa_/);
    const x = await docXlsx(await r.body());
    expect(x.trangIn.orientation).toBe('landscape');
  });
});

test.describe('Tăng phạm vi · mật độ dòng (API)', () => {
  test('A06 [RD-DENSITY] chỉ nhận gon|doc|day-du, chỉ bảng hợp lệ, cần đăng nhập', async ({ request }) => {
    expect((await request.get(`${API}/user-table-layouts/mat-do`)).status()).toBe(401);
    const sai = await request.put(`${API}/user-table-layouts/petitions/mat-do`, { headers: hdr(), data: { matDo: 'rat-cao' } });
    expect(sai.status()).toBe(400);
    const bangLa = await request.put(`${API}/user-table-layouts/khong-co/mat-do`, { headers: hdr(), data: { matDo: 'gon' } });
    expect(bangLa.status()).toBe(400);
  });

  test('A07 [RD-DENSITY] ghi → đọc lại đúng; "Đặt lại cột" KHÔNG xoá mật độ', async ({ request }) => {
    try {
      expect((await request.put(`${API}/user-table-layouts/cases/mat-do`, { headers: hdr(), data: { matDo: 'gon' } })).ok()).toBe(true);
      expect((await json(await request.get(`${API}/user-table-layouts/mat-do`, { headers: hdr() }))).cases).toBe('gon');
      expect((await request.delete(`${API}/user-table-layouts/cases`, { headers: hdr() })).ok()).toBe(true);
      expect((await json(await request.get(`${API}/user-table-layouts/mat-do`, { headers: hdr() }))).cases).toBe('gon');
    } finally {
      await request.put(`${API}/user-table-layouts/cases/mat-do`, { headers: hdr(), data: { matDo: 'doc' } });
    }
  });
});

test('A08 [OAT] máy chủ báo buildId để giao diện tự lên bản mới', async ({ request }) => {
  const b = await json(await request.get(`${API}/health`));
  expect(b.status).toBe('ok');
  expect(typeof b.buildId).toBe('string');
  expect(b.buildId.length).toBeGreaterThan(0);
});

/**
 * C5.13 — PHẠM VI DỮ LIỆU: cán bộ OFFICER chỉ xuất được hồ sơ trong phạm vi của mình. Chủ ngữ = sản phẩm (tệp
 * người dùng tải về) → bằng chứng HTTP bằng token OFFICER thật (global-setup đăng nhập officer1).
 */
test('A10 [C5.13 SECURITY] OFFICER: tệp xuất = đúng phần mình thấy, ít hơn phần ADMIN thấy', async ({ request }) => {
  test.setTimeout(150_000);
  const fs = createRequire(__filename)('fs') as typeof import('fs');
  const tep = path.resolve(__dirname, '../../test-results/.auth-token-officer1.txt');
  test.skip(!fs.existsSync(tep), 'không có tài khoản officer1 trên môi trường này');
  const tokenCb = fs.readFileSync(tep, 'utf8').trim();
  const hCb = { Authorization: `Bearer ${tokenCb}` };
  const dsCb = await (await request.get(`${API}/petitions?limit=1&offset=0`, { headers: hCb })).json();
  const dsAdmin = await (await request.get(`${API}/petitions?limit=1&offset=0`, { headers: hdr() })).json();
  expect(dsCb.total, 'OFFICER thấy ít hơn ADMIN (phạm vi có áp)').toBeLessThan(dsAdmin.total);
  const r = await goiXuat(request, `${API}/petitions/export/danh-sach?cot=stt`, hCb);
  if (dsCb.total === 0) {
    expect(r.status()).toBe(400);
    return;
  }
  expect(r.status()).toBe(200);
  const x = await docXlsx(await r.body());
  expect(x.ma.length, 'tệp OFFICER = đúng phần OFFICER thấy').toBe(dsCb.total);
});

/** Chạy CUỐI tệp: cố ý dùng hết hạn mức của một điểm cuối. */
test('A09 [C5.8 SECURITY] gọi dồn > 5 lượt/phút vào điểm cuối xuất → bị chặn 429', async ({ request }) => {
  const ma: number[] = [];
  for (let i = 0; i < 7; i++) {
    ma.push((await request.get(`${API}/incidents/export/danh-sach?cot=matKhau`, { headers: hdr() })).status());
  }
  expect(ma).toContain(429);
});
