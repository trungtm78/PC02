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
 *   node dist/src/legacy-migration/cli/nap-nguon-don.js --that       # ghi thật
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
  gopNguonDon,
  type GiaTriHeCu,
  type MucNguonDon,
} from './nap-nguon-don.util';

/** Một ô trong CSV: bọc nháy kép và nhân đôi nháy bên trong. */
function oCsv(v: string | number | boolean): string {
  return `"${String(v).replace(/"/g, '""')}"`;
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

export async function napNguonDon(
  prisma: PrismaClient,
  ghiThat: boolean,
  duongCsv?: string,
) {
  const [tuDonThu, tuVuAn, daCo] = await Promise.all([
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
    prisma.directory.findMany({
      where: { type: LOAI_DANH_MUC_NGUON_DON },
      select: { name: true, code: true },
    }),
  ]);

  const giaTri: GiaTriHeCu[] = [...tuDonThu, ...tuVuAn].map((r) => ({
    ten: r.nguonDon ?? '',
    soHoSo: r._count._all,
  }));

  const muc = gopNguonDon(
    giaTri,
    daCo.map((d) => d.name),
  );
  const ma = sinhDayMa(
    daCo.map((d) => d.code),
    muc.length,
    TIEN_TO_MA_NGUON_DON,
  );

  const choDuyet = muc.filter((m) => m.choDuyet).length;
  console.log(
    `Cách viết đọc được       : ${giaTri.length} (đơn thư ${tuDonThu.length} · vụ án ${tuVuAn.length})`,
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
    return { them: 0, choDuyet, duKien: muc.length };
  }

  await prisma.directory.createMany({
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

  console.log(`\nĐã thêm ${muc.length} nguồn đơn.`);
  return { them: muc.length, choDuyet, duKien: muc.length };
}

if (require.main === module) {
  const ghiThat = process.argv.includes('--that');
  const iCsv = process.argv.indexOf('--csv');
  const duongCsv = iCsv >= 0 ? process.argv[iCsv + 1] : undefined;
  // Prisma 7 bỏ trình điều khiển dựng sẵn: `new PrismaClient()` trần ném ngay lúc dựng.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  napNguonDon(prisma, ghiThat, duongCsv)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
}
