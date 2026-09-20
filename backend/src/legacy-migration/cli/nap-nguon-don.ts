/**
 * Nạp danh mục "Nguồn đơn/Đơn vị giao" (`Directory.type = 'NGUON_DON'`) từ dữ liệu ĐANG CHẠY.
 *
 * Vì sao cần: hệ cũ để ô này là chữ tự do. Đo 20/09/2026 — 47.456/47.488 đơn có giá trị nhưng
 * **1.431 cách viết** cho cùng vài chục nguồn (Bưu điện 14.758 · Trực tiếp 10.656 · "trực tiếp"
 * 956 · 2.162 dòng ở dạng NFD). Thống kê theo nguồn vì thế vô nghĩa, và cán bộ phải gõ tay.
 *
 * Nguồn đọc là CHÍNH cột `petitions.nguonDon` và `cases.nguonDon` — hai màn dùng CHUNG một
 * danh mục (anh chốt 20/09). Không dựng bảng phân loại trung gian thứ hai.
 *
 * Dùng:
 *   set -a && source .env && set +a
 *   node dist/src/legacy-migration/cli/nap-nguon-don.js              # chạy thử, KHÔNG ghi
 *   node dist/src/legacy-migration/cli/nap-nguon-don.js --csv ra.csv # xuất bảng gộp để soát
 *   node dist/src/legacy-migration/cli/nap-nguon-don.js --that       # ghi danh mục
 *   node dist/src/legacy-migration/cli/nap-nguon-don.js --chuan-hoa  # thêm: đổi hồ sơ cũ về tên chuẩn
 *
 * `--chuan-hoa` là việc KHÁC HẲN và nguy hiểm hơn: dựng danh mục chỉ thêm dòng mới, còn nó
 * sửa 47.456 hồ sơ đang chạy. Vẫn tuân thủ chạy-thử: phải có CẢ `--that` mới ghi.
 *
 * Chạy lại được nhiều lần: mục đã có trong danh mục thì bỏ qua (so theo KHOÁ GỘP, không theo
 * chuỗi thô) — chạy lần hai ra 0 mục mới.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { writeFileSync } from 'node:fs';
import { sinhDayMa } from '../../common/utils/ma-danh-muc.util';
import {
  LOAI_DANH_MUC_NGUON_DON,
  TIEN_TO_MA_NGUON_DON,
} from '../../common/utils/nguon-don.util';
import {
  bangDoiTenChuan,
  gopNguonDon,
  type GiaTriHeCu,
  type MucNguonDon,
} from './nap-nguon-don.util';

/**
 * Một ô trong CSV: bọc nháy kép, nhân đôi nháy bên trong, và VÔ HIỆU HOÁ công thức.
 *
 * Trong 1.431 chuỗi tự do của hệ cũ, một tên mở đầu bằng `=`, `+`, `-` hay `@` sẽ được Excel
 * diễn giải là CÔNG THỨC khi anh mở bảng soát trên máy trạm — từ hiện sai cho tới chạy thứ
 * không ai định chạy. Chèn dấu nháy đơn ở đầu để Excel đọc nó là chữ.
 */
function oCsv(v: string | number | boolean): string {
  const chu = String(v);
  const antoan = /^[=+\-@]/.test(chu) ? `'${chu}` : chu;
  return `"${antoan.replace(/"/g, '""')}"`;
}

/**
 * Bảng gộp để anh soát TRƯỚC khi ghi.
 *
 * Có BOM UTF-8 ở đầu: thiếu nó thì Excel bản Việt mở ra toàn ký tự lạ, và người soát sẽ kết
 * luận dữ liệu hỏng trong khi chỉ là mã ký tự.
 */
export function dungCsv(muc: MucNguonDon[]): string {
  const dong = [
    [
      'Tên chuẩn',
      'Số hồ sơ',
      'Chờ duyệt',
      'Là trực tiếp',
      'Các cách viết đã gộp',
    ]
      .map(oCsv)
      .join(','),
    ...muc.map((m) =>
      [
        oCsv(m.name),
        oCsv(m.soHoSo),
        oCsv(m.choDuyet ? 'x' : ''),
        oCsv(m.laTrucTiep ? 'x' : ''),
        oCsv(m.bienThe.join(' | ')),
      ].join(','),
    ),
  ];
  return '﻿' + dong.join('\r\n') + '\r\n';
}

/**
 * Ghi lại chính hồ sơ về TÊN CHUẨN.
 *
 * Tách khỏi việc dựng danh mục và đứng sau một cờ RIÊNG, vì mức nguy hiểm khác hẳn: dựng danh
 * mục chỉ thêm dòng mới, còn đây sửa 47.456 hồ sơ đang chạy. Chạy theo LÔ và ghi rõ từng bước.
 *
 * `WHERE` lặp lại giá trị cũ nên chạy lại lần hai không đụng dòng nào — đã đúng thì không sửa.
 */
async function chuanHoaHoSo(
  prisma: PrismaClient,
  muc: MucNguonDon[],
  ghiThat: boolean,
) {
  const doi = bangDoiTenChuan(muc);
  if (doi.length === 0) {
    console.log('\nKhông có cách viết nào cần đổi.');
    return { doi: 0, donThu: 0, vuAn: 0, vuViec: 0 };
  }
  console.log(`
Sẽ đổi ${doi.length} cách viết về tên chuẩn trên chính hồ sơ.`);
  if (!ghiThat) {
    for (const d of doi.slice(0, 10)) console.log(`  "${d.cu}" → "${d.chuan}"`);
    console.log('  CHẠY THỬ — chưa ghi gì.');
    return { doi: doi.length, donThu: 0, vuAn: 0, vuViec: 0 };
  }

  let donThu = 0;
  let vuAn = 0;
  let vuViec = 0;
  for (const d of doi) {
    const [a, b, c] = await Promise.all([
      prisma.petition.updateMany({
        where: { nguonDon: d.cu },
        data: { nguonDon: d.chuan },
      }),
      prisma.case.updateMany({
        where: { nguonDon: d.cu },
        data: { nguonDon: d.chuan },
      }),
      prisma.incident.updateMany({
        where: { chuyenTuDonVi: d.cu },
        data: { chuyenTuDonVi: d.chuan },
      }),
    ]);
    donThu += a.count;
    vuAn += b.count;
    vuViec += c.count;
  }
  console.log(`Đã đổi: đơn thư ${donThu} · vụ án ${vuAn} · vụ việc ${vuViec}`);
  return { doi: doi.length, donThu, vuAn, vuViec };
}

export async function napNguonDon(
  prisma: PrismaClient,
  ghiThat: boolean,
  duongCsv?: string,
  chuanHoa = false,
) {
  const [tuDonThu, tuVuAn, tuVuViec, daCo] = await Promise.all([
    prisma.petition.groupBy({
      by: ['nguonDon'],
      where: { nguonDon: { not: null } },
      _count: { _all: true },
    }),
    prisma.case.groupBy({
      by: ['nguonDon'],
      where: { nguonDon: { not: null } },
      _count: { _all: true },
    }),
    // Màn Vụ việc cũng phơi khái niệm này, trên cột `incidents.chuyenTuDonVi` (khai ở
    // `common/tim-kiem/khai/vu-viec.khai.ts` với đúng nhãn "Nguồn đơn/Đơn vị giao"). Bỏ qua
    // nó là nguồn chỉ có ở vụ việc không bao giờ vào danh mục, và bộ lọc ba màn chạy trên
    // hai tập giá trị khác nhau — đúng lớp "hai danh mục trôi khỏi nhau".
    prisma.incident.groupBy({
      by: ['chuyenTuDonVi'],
      where: { chuyenTuDonVi: { not: null } },
      _count: { _all: true },
    }),
    // Lấy CẢ mục đã tắt: quản trị tắt một mục nghĩa là đã bỏ nó có chủ ý — lượt sau hồi sinh
    // lại là dọn xong rồi bẩn lại. `metadata` mang `bienThe` để nhận ra mục đã bị ĐỔI TÊN.
    prisma.directory.findMany({
      where: { type: LOAI_DANH_MUC_NGUON_DON },
      select: { name: true, code: true, order: true, metadata: true },
    }),
  ]);

  const giaTri: GiaTriHeCu[] = [
    ...tuDonThu.map((r) => ({ ten: r.nguonDon ?? '', soHoSo: r._count._all })),
    ...tuVuAn.map((r) => ({ ten: r.nguonDon ?? '', soHoSo: r._count._all })),
    ...tuVuViec.map((r) => ({
      ten: r.chuyenTuDonVi ?? '',
      soHoSo: r._count._all,
    })),
  ];

  const orderGoc = daCo.reduce((max, d) => Math.max(max, d.order ?? 0), 0);
  const muc = gopNguonDon(
    giaTri,
    daCo.map((d) => ({
      name: d.name,
      bienThe: Array.isArray(
        (d.metadata as { bienThe?: unknown } | null)?.bienThe,
      )
        ? (d.metadata as { bienThe: string[] }).bienThe
        : undefined,
    })),
    orderGoc,
  );
  const ma = sinhDayMa(
    daCo.map((d) => d.code),
    muc.length,
    TIEN_TO_MA_NGUON_DON,
  );

  const choDuyet = muc.filter((m) => m.choDuyet).length;
  console.log(
    `Cách viết đọc được       : ${giaTri.length} (đơn thư ${tuDonThu.length} · vụ án ${tuVuAn.length} · vụ việc ${tuVuViec.length})`,
  );
  console.log(`Danh mục NGUON_DON đang có: ${daCo.length}`);
  console.log(
    `Sẽ thêm                  : ${muc.length} (chờ duyệt: ${choDuyet})`,
  );
  if (muc.length) {
    console.log('\n10 mục đầu (nhiều hồ sơ nhất):');
    for (const m of muc.slice(0, 10)) {
      const co = m.laTrucTiep ? '[trực tiếp] ' : '            ';
      console.log(`  ${m.soHoSo.toString().padStart(6)} hồ sơ  ${co}${m.name}`);
    }
  }

  if (duongCsv) {
    writeFileSync(duongCsv, dungCsv(muc), 'utf8');
    console.log(`\nĐã ghi bảng gộp ra ${duongCsv} — soát rồi hãy chạy --that.`);
  }

  if (!ghiThat) {
    console.log('\nCHẠY THỬ — chưa ghi gì. Thêm --that để ghi thật.');
    // Chạy thử phải xem trước CẢ bước chuẩn hoá — đó chính là thứ người vận hành cần biết
    // trước khi gõ `--that`: sẽ đổi bao nhiêu cách viết, và đổi thành gì.
    const xemTruoc = chuanHoa
      ? await chuanHoaHoSo(prisma, muc, false)
      : undefined;
    return { them: 0, choDuyet, duKien: muc.length, chuanHoa: xemTruoc };
  }

  const ketQua = await prisma.directory.createMany({
    data: muc.map((m, i) => ({
      type: LOAI_DANH_MUC_NGUON_DON,
      code: ma[i],
      name: m.name,
      order: m.order,
      isActive: true,
      // Dấu vết nguồn: người duyệt cần biết mục này từ đâu ra và dựa trên bao nhiêu hồ sơ.
      // `laTrucTiep` ghi kèm để tra cứu, nhưng đường CHÍNH vẫn là hàm thuần suy từ tên.
      metadata: {
        nguon: 'petitions.nguonDon + cases.nguonDon',
        choDuyet: m.choDuyet,
        soHoSo: m.soHoSo,
        laTrucTiep: m.laTrucTiep,
        bienThe: m.bienThe,
      },
    })),
    skipDuplicates: true,
  });

  // Báo SỐ DÒNG MÁY CHỦ THẬT SỰ CHÈN, không phải số dự kiến: hai lượt `--that` chồng nhau thì
  // lượt sau bị nuốt sạch mà màn hình vẫn báo "đã thêm 972" — nói dối người vận hành.
  const them = ketQua?.count ?? 0;
  console.log(`
Đã thêm ${them} nguồn đơn (dự kiến ${muc.length}).`);
  if (them !== muc.length) {
    console.log(
      '  ↳ Lệch: có lượt chạy khác vừa thêm trước, hoặc mã đã tồn tại.',
    );
  }
  const ketQuaChuanHoa = chuanHoa
    ? await chuanHoaHoSo(prisma, muc, ghiThat)
    : undefined;

  return { them, choDuyet, duKien: muc.length, chuanHoa: ketQuaChuanHoa };
}

if (require.main === module) {
  const ghiThat = process.argv.includes('--that');
  const iCsv = process.argv.indexOf('--csv');
  const keTiep = iCsv >= 0 ? process.argv[iCsv + 1] : undefined;
  // `--csv --that` từng ghi bảng gộp ra một tệp TÊN LÀ `--that` rồi vẫn ghi cơ sở dữ liệu.
  // Thiếu tên tệp là sai ý người gõ, nên dừng hẳn thay vì đoán.
  if (iCsv >= 0 && (!keTiep || keTiep.startsWith('--'))) {
    console.error('Thiếu tên tệp sau --csv. Ví dụ: --csv nguon-don.csv');
    process.exit(2);
  }
  const duongCsv = iCsv >= 0 ? keTiep : undefined;
  // Prisma 7 bỏ trình điều khiển dựng sẵn: `new PrismaClient()` trần ném ngay lúc dựng.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  const chuanHoa = process.argv.includes('--chuan-hoa');
  napNguonDon(prisma, ghiThat, duongCsv, chuanHoa)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
}
