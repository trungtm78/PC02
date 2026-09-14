/**
 * Nạp danh mục "Loại thông tin" (`Directory.type = 'LOAI_THONG_TIN'`) từ dữ liệu cũ và chuẩn hoá
 * ô Loại thông tin + nhóm hạn của Đơn thư.
 *
 * Vì sao cần: hệ cũ không có danh mục loại thông tin — cán bộ gõ tay. Đo trên bản sao 14/09/2026:
 * 735 giá trị khác nhau ("Tố giác" / "tố giác" / "Tố giác "), 86 hồ sơ trống, và `petitionType`
 * (nhóm hạn) trống ở TOÀN BỘ 46.741 hồ sơ. Form nay chỉ còn ô Loại thông tin chọn từ danh mục, nên
 * danh mục phải có sẵn và hồ sơ phải mang đúng tên trong danh mục thì ô mới hiện được giá trị.
 *
 * Luật gộp, suy từ tóm tắt, và lý do từng quyết định: xem `nap-loai-thong-tin.util.ts`.
 *
 * Ghi bằng SQL thô theo lô để KHÔNG đẩy `updatedAt` của hàng chục nghìn hồ sơ không ai sửa.
 * Mỗi câu UPDATE lặp lại giá trị đã đọc làm điều kiện: cán bộ sửa hồ sơ giữa lúc đọc và lúc ghi
 * thì không bị đè.
 *
 * Dùng:
 *   set -a && source .env && set +a
 *   node dist/src/legacy-migration/cli/nap-loai-thong-tin.js                  # chạy thử, KHÔNG ghi
 *   node dist/src/legacy-migration/cli/nap-loai-thong-tin.js --that           # ghi thật
 *   node dist/src/legacy-migration/cli/nap-loai-thong-tin.js --csv=/tmp/x.csv # đổi chỗ lưu bảng gộp
 *
 * Chạy lại được: lần hai ra 0 mục mới, 0 hồ sơ phải ghi.
 */
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { sinhDayMa } from './nap-don-vi-xu-ly.util';
import {
  bangGopCsv,
  gopLoaiThongTin,
  lapKeHoach,
  type GiaTriDem,
  type HoSoLoai,
} from './nap-loai-thong-tin.util';

const LOAI = 'LOAI_THONG_TIN';
/** Tiền tố mã — CÙNG tiền tố ô "Tạo mới" trên form dùng (`directory.service.ts`), để dãy mã không đụng nhau. */
const TIEN_TO_MA = 'LTT';
const LO = 500;

type HoSoDoc = HoSoLoai & { stt: string };

function demTheoGiaTri(hoSo: readonly HoSoDoc[]): GiaTriDem[] {
  const dem = new Map<string | null, number>();
  for (const h of hoSo)
    dem.set(h.loaiThongTin, (dem.get(h.loaiThongTin) ?? 0) + 1);
  return [...dem.entries()].map(([giaTri, soHoSo]) => ({ giaTri, soHoSo }));
}

export async function napLoaiThongTin(
  prisma: PrismaClient,
  ghiThat: boolean,
  duongDanCsv: string,
) {
  const [hoSo, vuViec, vuAn, daCo] = await Promise.all([
    // Tóm tắt trống thì lấy đầu nội dung: hồ sơ di trú hay để trống tóm tắt mà nội dung vẫn mở
    // đầu bằng "Tố giác …".
    prisma.$queryRaw<HoSoDoc[]>`
      SELECT id, stt, "loaiThongTin", "petitionType",
             left(coalesce(nullif(btrim(summary), ''), "detailContent"), 300) AS "tomTat"
      FROM petitions WHERE "deletedAt" IS NULL`,
    prisma.$queryRaw<GiaTriDem[]>`
      SELECT "loaiThongTin" AS "giaTri", count(*)::int AS "soHoSo"
      FROM incidents WHERE "deletedAt" IS NULL GROUP BY 1`,
    prisma.$queryRaw<GiaTriDem[]>`
      SELECT loai_thong_tin AS "giaTri", count(*)::int AS "soHoSo"
      FROM cases WHERE "deletedAt" IS NULL GROUP BY 1`,
    prisma.directory.findMany({
      where: { type: LOAI },
      select: { name: true, code: true, metadata: true },
    }),
  ]);

  const danhMuc = gopLoaiThongTin(
    demTheoGiaTri(hoSo),
    [...vuViec, ...vuAn],
    daCo,
  );
  const mucMoi = danhMuc.filter((m) => !m.daCo);
  const ma = sinhDayMa(
    daCo.map((d) => d.code),
    mucMoi.length,
    TIEN_TO_MA,
  );
  const keHoach = lapKeHoach(hoSo, danhMuc);
  fs.writeFileSync(duongDanCsv, bangGopCsv(danhMuc));

  // In MẪU chứ không chỉ con số: con số không lộ được một nhóm bị gộp nhầm, danh sách thì có.
  const theoId = new Map(hoSo.map((h) => [h.id, h]));
  console.log(`Đơn thư đọc được            : ${hoSo.length}`);
  console.log(`Danh mục ${LOAI} đang có: ${daCo.length}`);
  console.log(
    `Mục sau khi gộp             : ${danhMuc.length} (mới ${mucMoi.length}, chờ duyệt ${mucMoi.filter((m) => m.choDuyet).length})`,
  );
  console.log(`Hồ sơ đổi về tên chuẩn      : ${keHoach.doiTen.length}`);
  console.log(`Hồ sơ trống điền từ tóm tắt : ${keHoach.dienTrong.length}`);
  console.log(`Hồ sơ trống không suy được  : ${keHoach.khongSuyDuoc.length}`);
  console.log(`Hồ sơ gán nhóm hạn          : ${keHoach.ganNhom.length}`);
  console.log(`Bảng gộp                    : ${duongDanCsv}`);

  console.log('\n30 mục nhiều hồ sơ nhất:');
  for (const m of danhMuc.slice(0, 30)) {
    const nhan = `${m.daCo ? '[đã có] ' : ''}${m.choDuyet ? '[chờ duyệt] ' : ''}`;
    console.log(
      `  ${String(m.soHoSo).padStart(6)}  ${m.nhomHan.padEnd(9)} ${nhan}${m.name}  ← ${m.bienThe.slice(0, 5).join(' | ')}`,
    );
  }
  console.log('\nHồ sơ trống điền từ tóm tắt (15 mẫu):');
  for (const d of keHoach.dienTrong.slice(0, 15)) {
    const h = theoId.get(d.id);
    console.log(
      `  ${h?.stt.padEnd(12)} → ${d.moi.padEnd(20)} ${(h?.tomTat ?? '').slice(0, 70)}`,
    );
  }
  console.log(
    '\nKhông suy được (10 mẫu): ' +
      keHoach.khongSuyDuoc
        .slice(0, 10)
        .map((id) => theoId.get(id)?.stt)
        .join(' '),
  );

  const ketQua = {
    mucMoi: mucMoi.length,
    doiTen: keHoach.doiTen.length,
    dienTrong: keHoach.dienTrong.length,
    ganNhom: keHoach.ganNhom.length,
    khongSuyDuoc: keHoach.khongSuyDuoc.length,
    daGhi: { muc: 0, loai: 0, nhom: 0 },
  };

  if (!ghiThat) {
    console.log(
      '\nCHẠY THỬ — chưa ghi gì. Đọc bảng gộp rồi thêm --that để ghi thật.',
    );
    return ketQua;
  }

  if (mucMoi.length) {
    const tao = await prisma.directory.createMany({
      data: mucMoi.map((m, i) => ({
        type: LOAI,
        code: ma[i],
        name: m.name,
        order: m.order,
        isActive: true,
        // Dấu vết nguồn: người duyệt cần biết mục này từ đâu ra, dựa trên bao nhiêu hồ sơ, gộp gì.
        metadata: {
          nhomHan: m.nhomHan,
          nguon: 'legacy',
          choDuyet: m.choDuyet,
          soHoSo: m.soHoSo,
          bienThe: m.bienThe,
        },
      })),
      skipDuplicates: true,
    });
    ketQua.daGhi.muc = tao.count;
  }

  // Đổi loại TRƯỚC: câu gán nhóm hạn bên dưới chặn theo tên loại SAU khi đã chuẩn hoá.
  const doiLoai = [...keHoach.doiTen, ...keHoach.dienTrong];
  for (let i = 0; i < doiLoai.length; i += LO) {
    const lo = doiLoai.slice(i, i + LO);
    ketQua.daGhi.loai += await prisma.$executeRaw`
      UPDATE petitions p SET "loaiThongTin" = v.moi
      FROM unnest(${lo.map((d) => d.id)}::text[], ${lo.map((d) => d.cu)}::text[], ${lo.map((d) => d.moi)}::text[])
        AS v(id, cu, moi)
      WHERE p.id = v.id AND p."loaiThongTin" IS NOT DISTINCT FROM v.cu`;
  }

  for (let i = 0; i < keHoach.ganNhom.length; i += LO) {
    const lo = keHoach.ganNhom.slice(i, i + LO);
    ketQua.daGhi.nhom += await prisma.$executeRaw`
      UPDATE petitions p SET "petitionType" = v.nhom::"LoaiDon"
      FROM unnest(${lo.map((g) => g.id)}::text[], ${lo.map((g) => g.loai)}::text[], ${lo.map((g) => g.nhom)}::text[])
        AS v(id, loai, nhom)
      WHERE p.id = v.id AND p."petitionType" IS NULL AND p."loaiThongTin" = v.loai`;
  }

  console.log(
    `\nĐã thêm ${ketQua.daGhi.muc} mục, đổi loại ${ketQua.daGhi.loai} hồ sơ, gán nhóm hạn ${ketQua.daGhi.nhom} hồ sơ.`,
  );
  return ketQua;
}

if (require.main === module) {
  const ghiThat = process.argv.includes('--that');
  const thamSoCsv = process.argv.find((a) => a.startsWith('--csv='));
  const duongDanCsv = thamSoCsv
    ? thamSoCsv.slice('--csv='.length)
    : 'loai-thong-tin-bang-gop.csv';
  // Prisma 7 bỏ trình điều khiển dựng sẵn: `new PrismaClient()` trần ném ngay lúc dựng.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  napLoaiThongTin(prisma, ghiThat, duongDanCsv)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
}
