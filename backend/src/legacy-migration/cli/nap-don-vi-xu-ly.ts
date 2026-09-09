/**
 * Nạp danh mục "Đơn vị xử lý" (`Directory.type = 'DON_VI'`) từ bảng phân loại của bộ di trú.
 *
 * Vì sao cần: đo 09/09/2026, danh mục `DON_VI` chỉ có **5 dòng** trong khi dữ liệu cũ chứa
 * 3.806 tên thô → 2.812 đơn vị sau khi gộp trùng. Cán bộ mở ô "Đơn vị xử lý" ra và gần như
 * không bao giờ tìm thấy đơn vị mình cần.
 *
 * Nguồn là `legacy_unit_aliases` — bảng ĐÃ phân loại thủ công và có duyệt, không phải bộ lọc
 * đoán mới. Dựng luật lọc thứ hai ở đây là đảm bảo hai bên trôi khỏi nhau.
 *
 * Nhóm nạp và lý do: xem `nap-don-vi-xu-ly.util.ts`.
 *
 * Dùng:
 *   set -a && source .env && set +a
 *   node dist/src/legacy-migration/cli/nap-don-vi-xu-ly.js            # chạy thử, KHÔNG ghi
 *   node dist/src/legacy-migration/cli/nap-don-vi-xu-ly.js --that     # ghi thật
 *
 * Chạy lại được nhiều lần: tên đã có trong danh mục thì bỏ qua.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { gopThanhDanhMuc, sinhDayMa, NHOM_NAP } from './nap-don-vi-xu-ly.util';

const LOAI = 'DON_VI';

export async function napDonViXuLy(prisma: PrismaClient, ghiThat: boolean) {
  const [biDanh, daCo] = await Promise.all([
    prisma.legacyUnitAlias.findMany({
      where: { kind: { in: [...NHOM_NAP] } },
      select: { rawValue: true, sampleRaw: true, kind: true, recordCount: true },
    }),
    prisma.directory.findMany({
      where: { type: LOAI },
      select: { name: true, code: true },
    }),
  ]);

  const muc = gopThanhDanhMuc(
    biDanh,
    daCo.map((d) => d.name),
  );
  const ma = sinhDayMa(
    daCo.map((d) => d.code),
    muc.length,
  );

  const choDuyet = muc.filter((m) => m.choDuyet).length;
  console.log(`Bí danh hệ cũ đọc được : ${biDanh.length}`);
  console.log(`Danh mục DON_VI đang có: ${daCo.length}`);
  console.log(`Sẽ thêm                : ${muc.length} (chờ duyệt: ${choDuyet})`);
  if (muc.length) {
    console.log('\n10 mục đầu (nhiều hồ sơ nhất):');
    for (const m of muc.slice(0, 10)) {
      console.log(`  ${m.soHoSo.toString().padStart(5)} hồ sơ  ${m.choDuyet ? '[chờ duyệt] ' : '            '}${m.name}`);
    }
  }

  if (!ghiThat) {
    console.log('\nCHẠY THỬ — chưa ghi gì. Thêm --that để ghi thật.');
    return { them: 0, choDuyet, duKien: muc.length };
  }

  // `createMany` một lần: 1.863 dòng chèn từng dòng là 1.863 vòng đi lại máy chủ.
  await prisma.directory.createMany({
    data: muc.map((m, i) => ({
      type: LOAI,
      code: ma[i],
      name: m.name,
      order: m.order,
      isActive: true,
      // Dấu vết nguồn: người duyệt cần biết mục này từ đâu ra và dựa trên bao nhiêu hồ sơ.
      metadata: {
        nguon: 'legacy_unit_aliases',
        kind: m.kind,
        choDuyet: m.choDuyet,
        soHoSo: m.soHoSo,
      },
    })),
    skipDuplicates: true,
  });

  console.log(`\nĐã thêm ${muc.length} đơn vị.`);
  return { them: muc.length, choDuyet, duKien: muc.length };
}

if (require.main === module) {
  const ghiThat = process.argv.includes('--that');
  // Prisma 7 bỏ trình điều khiển dựng sẵn: `new PrismaClient()` trần ném ngay lúc dựng.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  napDonViXuLy(prisma, ghiThat)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
}
