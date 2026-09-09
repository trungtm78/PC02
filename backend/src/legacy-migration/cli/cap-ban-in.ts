import fs from 'node:fs';
import path from 'node:path';

import { MAU_HE_CU } from '../../../prisma/seed-legacy-templates';

import {
  chuTrongDocx,
  dangNhapHeCu,
  dinhDangDoan,
  manhChuTrongDocx,
  soDong,
  soKieuChu,
  taiBanInHeCu,
  type DinhDangDoan,
  type DongLech,
  type LechKieuChu,
} from './so-ban-in';

/**
 * Đặt bản in hệ cũ cạnh bản in hệ mới CỦA CÙNG MỘT HỒ SƠ.
 *
 * ── Vì sao có tệp này thay vì sửa `so-ban-in.ts` ──
 *
 * `so-ban-in.ts` TỰ DỰNG LẠI phép render của hệ mới, và lệch với máy chủ thật ở năm chỗ: đọc
 * mẫu từ đĩa chứ không từ cột `fileBytes` trong CSDL (bản trong CSDL đã chuẩn hoá), đánh MỌI
 * biến là `auto`/`required:false` thay vì theo bản seed, không truyền người in, không truyền ô
 * thủ công, và chỉ so theo một thực thể. Vá năm chỗ ấy rồi tin công cụ là lặp lại đúng cách đã
 * cho ra kết luận "0 chỗ lệch" hồi 28/08.
 *
 * Ở đây bản hệ mới là thứ máy chủ THẬT trả về cho chính lời gọi mà giao diện dùng, nên năm chỗ
 * lệch biến mất theo định nghĩa: hiện vật đem so CHÍNH LÀ thứ cán bộ nhận được.
 *
 * Hệ cũ vẫn CHỈ ĐỌC: `GET /doi-1/XuatFile/<id>`, đúng đường của nút "Xuất Word".
 */

export type ThucThe = 'DON_THU' | 'VU_VIEC' | 'VU_AN';

/** Tên bảng hệ mới ↔ thực thể. Một bảng, đọc được cả hai chiều — hai bảng rời sẽ trôi khỏi nhau. */
const BANG_THUC_THE = {
  petition: 'DON_THU',
  incident: 'VU_VIEC',
  case: 'VU_AN',
} as const satisfies Record<string, ThucThe>;

const DUONG_THUC_THE: Record<ThucThe, string> = {
  DON_THU: 'petitions',
  VU_VIEC: 'incidents',
  VU_AN: 'cases',
};

export function duongXuatHeMoi(thucThe: ThucThe, id: string): string {
  return `/api/v1/${DUONG_THUC_THE[thucThe]}/${id}/export-documents`;
}

export function thucTheChoDuong(bang: keyof typeof BANG_THUC_THE): ThucThe {
  return BANG_THUC_THE[bang];
}

export interface LechDinhDang {
  doanSo: number;
  heCu: string;
  heMoi: string;
}

function ta(d: DinhDangDoan | undefined): string {
  if (!d) return 'KHÔNG có đoạn này';
  return `canLe=${d.canLe || 'mặc định'} thut=${d.thutDauDong}`;
}

/**
 * So ĐỊNH DẠNG từng đoạn.
 *
 * Đây là chỗ phép so chữ không với tới: hệ cũ (`xuatfile.php`) đổi mỗi lần xuống dòng thành
 * một đoạn Word căn đều + thụt đầu dòng, hệ mới dùng ngắt dòng mềm. Chữ giống hệt nhau, nên
 * báo cáo cũ xếp khác biệt này là "trình bày, không phải dữ liệu" rồi bỏ qua — trong khi mở
 * hai tệp đặt cạnh nhau thì đó là thứ đập vào mắt trước tiên.
 *
 * So theo VỊ TRÍ đoạn, và số đoạn lệch cũng phải báo: so phần đầu rồi thôi là giấu mất chỗ
 * một bên thiếu hẳn mấy đoạn.
 */
export function soDinhDang(heCu: DinhDangDoan[], heMoi: DinhDangDoan[]): LechDinhDang[] {
  const lech: LechDinhDang[] = [];
  for (let i = 0; i < Math.max(heCu.length, heMoi.length); i += 1) {
    const a = heCu[i];
    const b = heMoi[i];
    if (a && b && a.canLe === b.canLe && a.thutDauDong === b.thutDauDong) continue;
    lech.push({ doanSo: i + 1, heCu: ta(a), heMoi: ta(b) });
  }
  return lech;
}

/** Một cặp KHÔNG lấy được — ghi lại thay vì để nó nuốt cả lượt chạy. */
export interface CapHong {
  maMau: string;
  legacyId: number;
  loi: string;
}

export interface CapBanIn {
  mau: string;
  maMau: string;
  legacyId: number;
  thucThe: ThucThe;
  idHeMoi: string;
  tepCu: string;
  tepMoi: string;
  lechChu: DongLech[];
  lechDinhDang: LechDinhDang[];
  /** Đậm · nghiêng · gạch chân · cỡ chữ — tầng thứ ba, và là tầng anh bắt được lỗi 09/09. */
  lechKieuChu: LechKieuChu[];
}

/** Ghi cặp tệp ra đĩa và tính hai bảng lệch. Tách khỏi phần mạng để kiểm được. */
export function dungCap(
  thongTin: Omit<CapBanIn, 'tepCu' | 'tepMoi' | 'lechChu' | 'lechDinhDang' | 'lechKieuChu'>,
  banCu: Buffer,
  banMoi: Buffer,
  thuMuc: string,
): CapBanIn {
  fs.mkdirSync(thuMuc, { recursive: true });
  const goc = `${thongTin.maMau}-${thongTin.legacyId}`;
  const tepCu = path.join(thuMuc, `${goc}-HE-CU.docx`);
  const tepMoi = path.join(thuMuc, `${goc}-HE-MOI.docx`);
  fs.writeFileSync(tepCu, banCu);
  fs.writeFileSync(tepMoi, banMoi);
  return {
    ...thongTin,
    tepCu,
    tepMoi,
    lechChu: soDong(chuTrongDocx(banCu), chuTrongDocx(banMoi)),
    lechDinhDang: soDinhDang(dinhDangDoan(banCu), dinhDangDoan(banMoi)),
    lechKieuChu: soKieuChu(manhChuTrongDocx(banCu), manhChuTrongDocx(banMoi)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phần chạy: lấy hai bản in THẬT rồi đặt cạnh nhau.
// ─────────────────────────────────────────────────────────────────────────────

const CO_SO_MOI = process.env['NEW_BASE_URL'] ?? 'http://171.244.40.245';

async function dangNhapHeMoi(): Promise<string> {
  const res = await fetch(`${CO_SO_MOI}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: process.env['NEW_USER'] ?? 'admin@pc02.local',
      password: process.env['NEW_PASS'] ?? '',
    }),
  });
  const j = (await res.json()) as { accessToken?: string };
  if (!j.accessToken) throw new Error('Không đăng nhập được hệ mới — đặt NEW_PASS.');
  return j.accessToken;
}

/** Mã mẫu → id mẫu trên máy chủ. Id là của MÁY CHỦ, không suy ra được từ tên tệp. */
async function idMauTheoMa(token: string, thucThe: ThucThe): Promise<Map<string, string>> {
  const res = await fetch(`${CO_SO_MOI}/api/v1/${DUONG_THUC_THE[thucThe]}/export-templates`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const j = (await res.json()) as { data?: { id: string; code: string }[] } | { id: string; code: string }[];
  const ds = Array.isArray(j) ? j : (j.data ?? []);
  return new Map(ds.map((t) => [t.code, t.id]));
}

/**
 * Xuất bản in của hệ mới QUA ĐÚNG ĐƯỜNG giao diện dùng.
 *
 * Cả 11 mẫu `HE_CU_*` đều `needsNumber = false` (đo trên máy thật 09/09/2026), nên lời gọi này
 * KHÔNG tiêu số văn bản và không làm lệch bộ đếm sổ.
 */
async function xuatBanHeMoi(
  token: string,
  thucThe: ThucThe,
  idHeMoi: string,
  idMau: string,
): Promise<Buffer> {
  const res = await fetch(`${CO_SO_MOI}${duongXuatHeMoi(thucThe, idHeMoi)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ templateIds: [idMau], mode: 'merged' }),
  });
  const kieu = res.headers.get('content-type') ?? '';
  if (!kieu.includes('wordprocessingml')) {
    throw new Error(`Hệ mới không trả tệp Word (${kieu}): ${(await res.text()).slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export interface DongGhepCap {
  /** Tên tệp mẫu của hệ cũ, vd `don_thu_mau.docx`. */
  mau: string;
  legacyId: number;
  idHeMoi: string;
  thucThe: ThucThe;
  /** Nút "Xuất biên nhận" của hệ cũ — nhánh riêng, không đi theo `loai`. */
  bienNhan?: boolean;
}

function bangLech(cap: CapBanIn[], hong: CapHong[]): string {
  const d: string[] = [
    '| Mẫu | Hồ sơ | Dòng chữ lệch | Đoạn định dạng lệch | Chỗ lệch kiểu chữ |',
    '|---|---|---|---|---|',
  ];
  for (const c of cap) {
    d.push(
      `| ${c.maMau} | ${c.legacyId} | ${c.lechChu.length} | ${c.lechDinhDang.length} | ` +
        `${c.lechKieuChu.length} |`,
    );
  }
  for (const h of hong) {
    d.push(`| ${h.maMau} | ${h.legacyId} | KHÔNG LẤY ĐƯỢC | ${h.loi} | — |`);
  }
  return d.join('\n');
}

/**
 * Nghỉ giữa hai lượt xuất.
 *
 * Đường xuất của hệ mới bị chặn 5 lượt/phút (`@Throttle` trên chính endpoint ấy). Lượt chạy đầu
 * đã đâm vào giới hạn ở cặp thứ 8 — nên phải đi đúng nhịp máy chủ cho phép, chứ không phải thử
 * lại cho tới khi lọt.
 */
function nghi(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Lấy một cặp bản in. Tách ra để lượt chạy kiểm được mà không cần mạng. */
export type LayCap = (g: DongGhepCap, maMau: string) => Promise<{ banCu: Buffer; banMoi: Buffer }>;

export interface KetQuaChay {
  cap: CapBanIn[];
  hong: CapHong[];
}

/**
 * Chạy hết bảng ghép cặp.
 *
 * MỘT CẶP HỎNG KHÔNG ĐƯỢC LÀM MẤT CẢ LƯỢT. Lượt chạy đầu ngày 09/09 đâm vào giới hạn tần suất
 * ở cặp thứ 8 và ném ra ngoài, nên báo cáo của bảy cặp trước — vốn đã tải xong và đã đo — không
 * bao giờ được ghi. Cặp hỏng nay vào cột riêng trong bảng, ghi rõ vì sao, chứ không lặng lẽ
 * biến mất khỏi báo cáo.
 */
export async function chayVoi(
  ghep: DongGhepCap[],
  thuMuc: string,
  layCap: LayCap,
  nghiMs = 0,
): Promise<KetQuaChay> {
  const cap: CapBanIn[] = [];
  const hong: CapHong[] = [];
  for (const [thuTu, g] of ghep.entries()) {
    const khai = MAU_HE_CU.find((m) => m.file === g.mau);
    if (!khai) throw new Error(`Không có mẫu ${g.mau} trong MAU_HE_CU.`);
    if (thuTu > 0 && nghiMs) await nghi(nghiMs);
    try {
      const { banCu, banMoi } = await layCap(g, khai.code);
      const c = dungCap(
        {
          mau: g.mau,
          maMau: khai.code,
          legacyId: g.legacyId,
          thucThe: g.thucThe,
          idHeMoi: g.idHeMoi,
        },
        banCu,
        banMoi,
        thuMuc,
      );
      cap.push(c);
      console.log(
        `${khai.code} · hồ sơ ${g.legacyId}: ${c.lechChu.length} dòng chữ lệch, ` +
          `${c.lechDinhDang.length} đoạn lệch định dạng, ${c.lechKieuChu.length} chỗ lệch kiểu chữ`,
      );
    } catch (e) {
      hong.push({ maMau: khai.code, legacyId: g.legacyId, loi: (e as Error).message });
      console.error(`${khai.code} · hồ sơ ${g.legacyId}: KHÔNG LẤY ĐƯỢC — ${(e as Error).message}`);
    }
  }

  fs.mkdirSync(thuMuc, { recursive: true });
  fs.writeFileSync(
    path.join(thuMuc, 'bang-lech.md'),
    `# Đối chiếu bản in — hệ cũ ↔ hệ mới\n\n${bangLech(cap, hong)}\n`,
    'utf8',
  );
  fs.writeFileSync(path.join(thuMuc, 'chi-tiet.json'), JSON.stringify({ cap, hong }, null, 1), 'utf8');
  return { cap, hong };
}

export async function chay(ghep: DongGhepCap[], thuMuc: string): Promise<KetQuaChay> {
  const cookie = await dangNhapHeCu();
  const token = await dangNhapHeMoi();
  const idMau = new Map<ThucThe, Map<string, string>>();

  const layCap: LayCap = async (g, maMau) => {
    if (!idMau.has(g.thucThe)) idMau.set(g.thucThe, await idMauTheoMa(token, g.thucThe));
    const id = idMau.get(g.thucThe)?.get(maMau);
    if (!id) throw new Error(`Máy chủ không mời mẫu ${maMau} cho ${g.thucThe}.`);
    return {
      banCu: await taiBanInHeCu(cookie, String(g.legacyId), g.bienNhan ?? false),
      banMoi: await xuatBanHeMoi(token, g.thucThe, g.idHeMoi, id),
    };
  };

  // 13 giây: giới hạn của máy chủ là 5 lượt/phút trên chính đường xuất này.
  return chayVoi(ghep, thuMuc, layCap, 13_000);
}

if (require.main === module) {
  const [tepGhep, thuMuc] = process.argv.slice(2);
  if (!tepGhep || !thuMuc) {
    console.error('Dùng: cap-ban-in <tep-ghep.json> <thu-muc-ra>');
    process.exit(2);
  }
  void chay(JSON.parse(fs.readFileSync(tepGhep, 'utf8')) as DongGhepCap[], thuMuc).catch((e) => {
    console.error('LỖI:', (e as Error).message);
    process.exit(1);
  });
}
