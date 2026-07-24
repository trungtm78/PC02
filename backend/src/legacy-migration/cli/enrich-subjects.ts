/**
 * Tạo đối tượng / bị can / bị hại cho VỤ ÁN từ tóm tắt hồ sơ, và khử trùng người XUYÊN hồ sơ
 * theo tiêu chí duy nhất (CCCD / CMND / hộ chiếu).
 *
 * Chạy:
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/enrich-subjects.ts --dry   # chỉ báo cáo
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/enrich-subjects.ts         # ghi thật
 *
 * Chỉ gắn được vào Vụ án: `Subject.caseId` là NOT NULL, chỉ Case có. Đơn thư/Vụ việc không
 * có bảng đối tượng riêng.
 *
 * An toàn: chỉ tạo khi CHƯA có đối tượng nào cho vụ án đó (không đè khi chạy lại). Năm sinh
 * → 01/01/yyyy vì tóm tắt chỉ có năm; `idNumber`/`address` để "" khi không bóc được (cột
 * NOT NULL) — trống trung thực hơn bịa.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { bocDoiTuong } from './subject-extract';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    // Ghép mỗi vụ án với tóm tắt gốc trong bảng chờ.
    const rows = await prisma.$queryRaw<{ caseId: string; hasSubject: boolean; tomTat: string | null }[]>`
      SELECT c.id AS "caseId",
             EXISTS (SELECT 1 FROM subjects sub WHERE sub."caseId" = c.id) AS "hasSubject",
             s.raw->>'tom_tat_noi_dung' AS "tomTat"
      FROM cases c
      JOIN legacy_staging s ON s."sourceFile"||':'||s."sourceId" = c."legacySourceId"
      WHERE c."legacySourceId" IS NOT NULL`;

    let soVuCoDoiTuong = 0;
    let soDoiTuong = 0;
    const byVaiTro = { SUSPECT: 0, VICTIM: 0, UNKNOWN: 0 };
    const dinhDanh = new Map<string, number>(); // khoá định danh → số hồ sơ (khử trùng xuyên vụ)
    let coCccd = 0;
    let coHoChieu = 0;

    for (const r of rows) {
      if (r.hasSubject) continue; // đã có đối tượng (người dùng nhập hoặc lần chạy trước) → không đè
      if (!r.tomTat) continue;
      const dts = bocDoiTuong(r.tomTat);
      if (!dts.length) continue;
      soVuCoDoiTuong++;

      const chuaRoVaiTro: typeof dts = [];
      for (const d of dts) {
        soDoiTuong++;
        byVaiTro[d.vaiTro]++;
        dinhDanh.set(d.khoaDinhDanh, (dinhDanh.get(d.khoaDinhDanh) ?? 0) + 1);
        if (d.cccd) coCccd++;
        if (d.hoChieu) coHoChieu++;

        // CHỐNG VU OAN: chỉ tạo bản ghi khi vai trò RÕ (bị can/bị hại có nhãn). Người chưa rõ
        // vai trò KHÔNG đổ vào bảng đối tượng — gán nhầm thành bị can là vu oan. Nhóm này
        // lưu vào metadata để cán bộ tự phân vai.
        if (d.vaiTro === 'UNKNOWN') {
          chuaRoVaiTro.push(d);
          continue;
        }
        if (!dryRun) {
          await prisma.subject.create({
            data: {
              caseId: r.caseId,
              fullName: d.hoTen,
              dateOfBirth: new Date(Date.UTC(d.namSinh ?? 1900, 0, 1)),
              idNumber: d.cccd ?? d.cmnd ?? d.hoChieu ?? '',
              address: d.diaChi ?? '',
              phone: d.soDienThoai,
              type: d.vaiTro,
              notes: `Trích tự động từ tóm tắt hồ sơ (cần rà soát). Trích dẫn: "${d.trichDan}"`,
            },
          });
        }
      }
      // Người chưa rõ vai trò → ghi vào metadata.doiTuongChuaPhanVai để cán bộ rà, không tạo Subject.
      if (chuaRoVaiTro.length && !dryRun) {
        const cur = (await prisma.case.findUnique({ where: { id: r.caseId }, select: { metadata: true } }))?.metadata as
          | Record<string, unknown>
          | null;
        if (!cur?.doiTuongChuaPhanVai) {
          await prisma.case.update({
            where: { id: r.caseId },
            data: {
              metadata: {
                ...(cur ?? {}),
                doiTuongChuaPhanVai: chuaRoVaiTro.map((d) => ({
                  hoTen: d.hoTen,
                  namSinh: d.namSinh,
                  diaChi: d.diaChi,
                  cccd: d.cccd,
                  trichDan: d.trichDan,
                })),
              },
            },
          });
        }
      }
    }

    // Người xuất hiện ở NHIỀU hồ sơ (theo số định danh duy nhất) — có giá trị nghiệp vụ cao.
    const trungLap = [...dinhDanh.entries()].filter(([k, n]) => n > 1 && !k.startsWith('ten:'));

    console.log(dryRun ? '\n— CHẠY THỬ, KHÔNG GHI GÌ —\n' : '\n— ĐÃ GHI ĐỐI TƯỢNG —\n');
    console.log(`Vụ án khảo sát        : ${rows.length}`);
    console.log(`Vụ án bóc được đối tượng: ${soVuCoDoiTuong}`);
    console.log(`Tổng đối tượng        : ${soDoiTuong}`);
    console.log(`  nghi can/bị can     : ${byVaiTro.SUSPECT}`);
    console.log(`  bị hại              : ${byVaiTro.VICTIM}`);
    console.log(`  đã tạo bản ghi đối tượng: ${byVaiTro.SUSPECT + byVaiTro.VICTIM} (vai trò rõ)`);
  console.log(`  chưa rõ vai trò → metadata: ${byVaiTro.UNKNOWN} (KHÔNG tạo bị can, để cán bộ rà)`);
    console.log(`  có CCCD             : ${coCccd}`);
    console.log(`  có hộ chiếu         : ${coHoChieu}`);
    console.log(`Người xuất hiện ở >1 hồ sơ (theo CCCD/CMND/hộ chiếu): ${trungLap.length}`);
    for (const [k, n] of trungLap.sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`   ${n} hồ sơ · ${k}`);
    }
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
