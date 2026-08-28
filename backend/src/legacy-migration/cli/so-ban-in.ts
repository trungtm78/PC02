/**
 * So bản in Word của hệ mới với bản in THẬT của hệ cũ, trên cùng một hồ sơ.
 *
 * ── Vì sao cần ──
 *
 * Ca kiểm đơn vị chỉ chứng minh từng ô tra ra đúng giá trị. Nó không chứng minh BẢN IN giống
 * nhau: một chỗ điền viết sai tên, một mẫu chọn nhầm, một đoạn xuống dòng dựng khác — ca kiểm
 * vẫn xanh mà văn bản gửi đi vẫn khác. Ngày 26/08/2026 ca kiểm xanh ba vòng vẫn sót bốn lỗi
 * chặn, đúng vì thiếu bước đặt hai bản cạnh nhau.
 *
 * Công cụ này dựng bản hệ mới bằng ĐÚNG đường mã mà máy chủ dùng (`buildTemplatePlaceholders`
 * + `DocxRenderer` + chính tệp mẫu trong kho), rồi bóc chữ hai bên và chỉ ra từng chỗ lệch.
 *
 * ── Chỉ đọc hệ cũ ──
 *
 * Chỉ `GET /doi-1/XuatFile/<id>` và một lần POST đăng nhập. Không gọi bất kỳ đường ghi nào.
 *
 * ── Dùng ──
 *
 *   npx ts-node src/legacy-migration/cli/so-ban-in.ts 85651 86950 86374
 *   npx ts-node src/legacy-migration/cli/so-ban-in.ts --loai        # mỗi loại một hồ sơ
 *   npx ts-node src/legacy-migration/cli/so-ban-in.ts --json bao-cao.json
 *
 * Biến môi trường: `LEGACY_BASE_URL`, `LEGACY_USER`, `LEGACY_PASS`, `BACKUP_PG_URL`.
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import { decomposeLegacyRecord, type LegacyRecord } from '../legacy-mapper';
import { buildTemplatePlaceholders } from '../../document-templates/entity-placeholders';
import { detectDocxVariables } from '../../document-templates/docx-variables.util';
import { normalizeDocxTags } from '../../document-templates/docx-normalize.util';
import { DocxRenderer } from '../../document-templates/renderers/docx.renderer';
import {
  DAU_MO_HE_CU,
  DAU_DONG_HE_CU,
  thuMucMauHeCu,
} from '../../../prisma/seed-legacy-templates';

const CO_SO = process.env['LEGACY_BASE_URL'] ?? 'https://pc02hcm.com';
const DELIM = { start: DAU_MO_HE_CU, end: DAU_DONG_HE_CU };

/**
 * Ánh xạ `loai` → tệp mẫu, chép NGUYÊN từ `$template_mapping` của `xuatfile.php`.
 *
 * Điểm dễ bỏ sót: `loai` THẬT trong dữ liệu rộng hơn bảng này. Đo 28/08/2026 trên 55.067 hồ sơ,
 * năm giá trị `vu_viec_da_phan_loai` (3.040), `vu_viec_phuong_xa` (1.106), `vu_an_da_phan_loai`
 * (908), `vu_an_phuong_xa` (350), `kien_nghi_vks` (19) đều KHÔNG có trong bảng, nên hệ cũ rơi
 * về mẫu mặc định `vu_an_mau.docx`. Nghĩa là `vu_viec_mau.docx` chưa từng được hệ cũ dùng lần
 * nào — Vụ việc của hệ cũ in bằng mẫu Vụ án.
 */
const MAU_THEO_LOAI: Readonly<Record<string, string>> = {
  vu_an: 'vu_an_mau.docx',
  vu_viec: 'vu_viec_mau.docx',
  don_thu: 'don_thu_mau.docx',
  tra_ho_so: 'tra_ho_so_mau.docx',
  uy_thac_dieu_tra: 'uy_thac_dieu_tra_mau.docx',
  dang_ky_bao_chua: 'dang_ky_bao_chua_mau.docx',
  an_tra_bo_sung: 'an_tra_bo_sung_mau.docx',
  trao_doi_chuyen_an: 'trao_doi_chuyen_an_mau.docx',
  luat_su: 'dang_ky_bao_chua_mau.docx',
  huong_dan: 'huong_dan_mau.docx',
};
const MAU_MAC_DINH = 'vu_an_mau.docx';

export function mauChoLoai(loai: unknown): string {
  return MAU_THEO_LOAI[String(loai ?? '')] ?? MAU_MAC_DINH;
}

/** Thực thể hệ mới ứng với tệp mẫu — dùng để chọn đúng catalog khoá khi tra giá trị. */
export function thucTheChoMau(mau: string): 'DON_THU' | 'VU_VIEC' | 'VU_AN' {
  if (mau === 'vu_an_mau.docx' || mau === 'an_tra_bo_sung_mau.docx') return 'VU_AN';
  if (mau === 'vu_viec_mau.docx') return 'VU_VIEC';
  if (mau === 'uy_thac_dieu_tra_mau.docx') return 'VU_AN';
  return 'DON_THU';
}

/**
 * Bóc chữ hiển thị của một tệp .docx.
 *
 * Cắt theo `</w:p>` để mỗi đoạn Word thành một dòng — nhờ đó khác biệt về NGẮT ĐOẠN cũng lộ ra,
 * chứ không chỉ khác biệt về chữ.
 */
export function chuTrongDocx(buffer: Buffer): string[] {
  const zip = new PizZip(buffer);
  const xml = zip.files['word/document.xml']?.asText() ?? '';
  return (
    xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:br\s*\/>/g, '\n')
      .replace(/<w:tab\s*\/>/g, ' ')
      .replace(/<[^>]+>/g, '')
      // Giải mã ĐỦ thực thể XML, `&amp;` sau cùng.
      //
      // Thiếu `&quot;` là công cụ tự báo lệch giả: PhpWord nhét thẳng dấu `"` vào XML còn
      // docxtemplater mã hoá thành `&quot;`, hai cách viết KHÁC nhau của CÙNG một ký tự và
      // Word hiện y như nhau. Bản đầu của công cụ này báo mọi câu có ngoặc kép là lệch — một
      // báo động giả đủ sức chôn vùi những chỗ lệch thật.
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .split('\n')
      .map((d) => d.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );
}

export interface DongLech {
  /** `sua` = cùng chỗ nhưng khác chữ · `thieu` = chỉ hệ cũ có · `thua` = chỉ hệ mới có. */
  kieu: 'sua' | 'thieu' | 'thua';
  heCu: string;
  heMoi: string;
}

/**
 * So hai danh sách dòng, có CĂN DÒNG.
 *
 * So theo vị trí thì một dòng thừa ở đầu làm mọi dòng sau lệch theo — bản đầu của công cụ báo
 * 9 dòng lệch cho một hồ sơ mà thật ra chỉ có 1. Dùng dãy con chung dài nhất để căn, nên chỉ
 * những dòng thật sự khác mới hiện ra.
 */
export function soDong(heCu: string[], heMoi: string[]): DongLech[] {
  const m = heCu.length;
  const n = heMoi.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = heCu[i] === heMoi[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const lech: DongLech[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (heCu[i] === heMoi[j]) {
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lech.push({ kieu: 'thieu', heCu: heCu[i], heMoi: '' });
      i += 1;
    } else {
      lech.push({ kieu: 'thua', heCu: '', heMoi: heMoi[j] });
      j += 1;
    }
  }
  while (i < m) {
    lech.push({ kieu: 'thieu', heCu: heCu[i], heMoi: '' });
    i += 1;
  }
  while (j < n) {
    lech.push({ kieu: 'thua', heCu: '', heMoi: heMoi[j] });
    j += 1;
  }

  // Một dòng bị SỬA hiện ra thành một cặp thiếu+thừa liền nhau; gộp lại cho dễ đọc.
  const gop: DongLech[] = [];
  for (let k = 0; k < lech.length; k += 1) {
    const a = lech[k];
    const b = lech[k + 1];
    if (a.kieu === 'thieu' && b?.kieu === 'thua') {
      gop.push({ kieu: 'sua', heCu: a.heCu, heMoi: b.heMoi });
      k += 1;
    } else {
      gop.push(a);
    }
  }
  return gop;
}

async function dangNhapHeCu(): Promise<string> {
  const res = await fetch(`${CO_SO}/thanh-vien`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      act: 'act_dang_nhap',
      email: process.env['LEGACY_USER'] ?? 'admin',
      password: process.env['LEGACY_PASS'] ?? '123456@',
    }),
    redirect: 'manual',
  });
  const cookie = res.headers.getSetCookie?.() ?? [];
  if (!cookie.length) throw new Error('Không lấy được phiên đăng nhập hệ cũ.');
  return cookie.map((c) => c.split(';')[0]).join('; ');
}

/** Tải bản in của hệ cũ. CHỈ ĐỌC — `GET`, đúng đường nút "Xuất Word" trên màn danh sách. */
async function taiBanInHeCu(cookie: string, id: string): Promise<Buffer> {
  const res = await fetch(`${CO_SO}/doi-1/XuatFile/${id}`, { headers: { cookie } });
  const kieu = res.headers.get('content-type') ?? '';
  if (!kieu.includes('wordprocessingml')) {
    throw new Error(`Hồ sơ ${id}: hệ cũ không trả tệp Word (${kieu}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Gắn cán bộ nhập vào bản ghi, đúng như máy thật có.
 *
 * `${nguoi_nhan}` và `${ten_ngan}` không nằm trong hồ sơ: hệ cũ tra `nguoi_them` sang bảng
 * `thanh_vien` rồi điền riêng. Bộ di trú cũng nối quan hệ ấy — máy thật gắn đủ cho cả 47.169
 * đơn thư (đo 28/08/2026). Nhưng bộ dựng bản ghi là hàm THUẦN, không tra được CSDL, nên giàn
 * thử phải tự gắn; không gắn thì công cụ báo `- Lưu: PC02-Đ1 (Tổ 2), .` là lệch, trong khi
 * máy thật in đúng `T.Thanh`. Báo động giả kiểu ấy làm người đọc mất tin vào cả bản đối chiếu.
 *
 * Hệ mới lưu họ tên tách đôi theo quy ước tiếng Anh: chữ cuối là tên gọi, phần còn lại là họ
 * và tên đệm.
 */
export function ganCanBoNhap(banGhi: Record<string, unknown>, ten: string): void {
  const phan = ten.trim().split(/\s+/).filter(Boolean);
  if (!phan.length) return;
  banGhi['enteredBy'] = {
    firstName: phan[phan.length - 1],
    lastName: phan.slice(0, -1).join(' '),
  };
}

/** Dựng bản ghi hệ mới đúng như bộ di trú dựng, rồi in bằng đúng đường mã của máy chủ. */
export function inBangHeMoi(rec: LegacyRecord, mau: string, tenCanBo?: string): Buffer {
  const duong = path.join(thuMucMauHeCu(), mau);
  const bytes = fs.readFileSync(duong);
  const thucThe = thucTheChoMau(mau);

  const tach = decomposeLegacyRecord(rec);
  const banGhi =
    thucThe === 'VU_AN'
      ? (tach.case ?? tach.incident ?? tach.petition)
      : thucThe === 'VU_VIEC'
        ? (tach.incident ?? tach.petition ?? tach.case)
        : (tach.petition ?? tach.incident ?? tach.case);
  if (!banGhi) throw new Error('Bộ di trú không dựng được bản ghi nào từ hồ sơ này.');
  if (tenCanBo) ganCanBoNhap(banGhi, tenCanBo);

  const bien = detectDocxVariables(normalizeDocxTags(bytes), DELIM).map((name) => ({
    name,
    label: name,
    source: 'auto' as const,
    field: name,
    required: false,
  }));
  const duLieu = buildTemplatePlaceholders(thucThe, bien, banGhi, {}, DELIM);
  return new DocxRenderer().render({ buffer: bytes, data: duLieu, delimiters: DELIM });
}

/**
 * Đọc hồ sơ để dựng bản in hệ mới.
 *
 * ── Vì sao ưu tiên dữ liệu SỐNG ──
 *
 * Bản sao CSDL trên máy là ảnh chụp một thời điểm. Cán bộ vẫn sửa hồ sơ trên hệ cũ hằng ngày,
 * nên so bản in hệ cũ (dựng từ dữ liệu HÔM NAY) với bản hệ mới (dựng từ ảnh chụp) là so hai
 * hồ sơ khác nhau: lần chạy đầu báo 28 dòng lệch cho hồ sơ 86950, mà phần lớn chỉ là cán bộ đã
 * sửa lại phần nội dung sau ngày chụp.
 *
 * Đọc Mongo hệ cũ ở chế độ CHỈ ĐỌC. Không có `LEGACY_MONGO_URI` thì rơi về bản sao, kèm cảnh
 * báo — chứ không lặng lẽ so nhầm.
 */
async function docHoSo(url: string, ids: string[]): Promise<LegacyRecord[]> {
  const mongoUri = process.env['LEGACY_MONGO_URI'];
  if (mongoUri) {
    const { MongoClient } = await import('mongodb');
    const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 30_000 });
    await mongo.connect();
    try {
      return (await mongo
        .db()
        .collection('ho_so_doi_1')
        .find({ id: { $in: ids.map((i) => Number(i)) } })
        .toArray()) as unknown as LegacyRecord[];
    } finally {
      await mongo.close();
    }
  }

  console.warn(
    '⚠ Không có LEGACY_MONGO_URI — đọc từ bản sao. Hồ sơ đã sửa sau ngày chụp sẽ báo lệch giả.',
  );
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ doc: LegacyRecord }>(
      `select doc from legacy_ho_so_doi_1 where legacy_id = any($1::text[])`,
      [ids],
    );
    return rows.map((r) => r.doc);
  } finally {
    await client.end();
  }
}

/** Tên cán bộ theo `nguoi_them`, tra bảng `thanh_vien` của hệ cũ — CHỈ ĐỌC. */
async function tenCanBoTheoId(ids: number[]): Promise<Map<number, string>> {
  const ra = new Map<number, string>();
  const mongoUri = process.env['LEGACY_MONGO_URI'];
  if (!mongoUri || !ids.length) return ra;
  const { MongoClient } = await import('mongodb');
  const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 30_000 });
  await mongo.connect();
  try {
    const rows = await mongo
      .db()
      .collection('thanh_vien')
      .find({ id: { $in: ids } })
      .toArray();
    for (const r of rows) ra.set(Number(r['id']), String(r['ten'] ?? ''));
  } finally {
    await mongo.close();
  }
  return ra;
}

async function idMoiLoai(url: string): Promise<string[]> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>(
      `select distinct on (doc->>'loai') legacy_id as id
         from legacy_ho_so_doi_1
        where coalesce(doc->>'loai', '') <> ''
        order by doc->>'loai', (legacy_id)::bigint desc`,
    );
    return rows.map((r) => r.id);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const url =
    process.env['BACKUP_PG_URL'] ??
    'postgresql://postgres:postgres@127.0.0.1:5433/pc02_legacy_backup';
  const dauRaJson = process.argv.includes('--json')
    ? process.argv[process.argv.indexOf('--json') + 1]
    : undefined;
  const ids = process.argv.includes('--loai')
    ? await idMoiLoai(url)
    : process.argv.slice(2).filter((a) => /^\d+$/.test(a));
  if (!ids.length) {
    console.error('Cần ít nhất một id hồ sơ hệ cũ, hoặc cờ --loai.');
    process.exit(1);
  }

  const cookie = await dangNhapHeCu();
  const hoSo = await docHoSo(url, ids);
  const tenCanBo = await tenCanBoTheoId(
    [...new Set(hoSo.map((r) => Number(r['nguoi_them'])).filter((n) => Number.isFinite(n)))],
  );
  const bao: unknown[] = [];

  for (const id of ids) {
    const rec = hoSo.find((r) => String(r['id']) === id);
    if (!rec) {
      console.log(`\n─── ${id}: KHÔNG có trong bản sao CSDL, bỏ qua.`);
      continue;
    }
    const mau = mauChoLoai(rec['loai']);
    let lech: DongLech[];
    try {
      const cu = chuTrongDocx(await taiBanInHeCu(cookie, id));
      const moi = chuTrongDocx(inBangHeMoi(rec, mau, tenCanBo.get(Number(rec['nguoi_them']))));
      lech = soDong(cu, moi);
    } catch (e) {
      console.log(`\n─── ${id} (${rec['loai']} → ${mau}): LỖI — ${(e as Error).message}`);
      continue;
    }

    console.log(
      `\n─── ${id} · loai=${rec['loai']} · mẫu=${mau} · ${lech.length ? `${lech.length} dòng LỆCH` : 'KHỚP HOÀN TOÀN'}`,
    );
    for (const d of lech.slice(0, 25)) {
      console.log(`  [${d.kieu}]`);
      if (d.heCu) console.log(`    hệ cũ : ${d.heCu}`);
      if (d.heMoi) console.log(`    hệ mới: ${d.heMoi}`);
    }
    if (lech.length > 25) console.log(`  … còn ${lech.length - 25} dòng nữa`);
    bao.push({ id, loai: rec['loai'], mau, soDongLech: lech.length, lech });
  }

  if (dauRaJson) {
    fs.writeFileSync(dauRaJson, JSON.stringify(bao, null, 2), 'utf-8');
    console.log(`\n✓ Đã ghi ${dauRaJson}`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
