/**
 * audit-address-vs-bihai.ts — BUG-002 (UAT epic hợp nhất field, 2026-08-23).
 *
 * VẤN ĐỀ ĐO ĐƯỢC: cột `cases.diaChiCungCap` ("Địa chỉ" của người tố cáo/báo tin) đang
 * chứa TÊN BỊ HẠI — trùng từng ký tự với `metadata.biHai` ở 1.268/1.278 hồ sơ.
 * Đây đúng là điều kế hoạch cảnh báo (PLAN-A1-05: "biHai ≠ địa chỉ → corruption"),
 * nhưng dữ liệu đã ở trạng thái đó từ đợt di trú TRƯỚC, và epic hợp nhất field đã
 * thăng cột này thành nơi lưu chuẩn rồi đưa lên biểu nhập dưới nhãn "Địa chỉ" —
 * khiến dữ liệu sai trở nên chính thức hơn thay vì bị phát hiện.
 *
 * NGUYÊN TẮC CỦA CÔNG CỤ NÀY: đây là hồ sơ tố tụng.
 *   - MẶC ĐỊNH chỉ ĐỌC và xuất báo cáo. Không sửa gì.
 *   - Chỉ khi có `--apply` mới dọn, và CHỈ dọn trường hợp an toàn tuyệt đối:
 *     giá trị cột GIỐNG HỆT `metadata.biHai` VÀ không mang bất kỳ dấu hiệu địa chỉ nào.
 *   - Không suy đoán địa chỉ đúng. Ô địa chỉ được trả về TRỐNG, giá trị gốc vẫn nằm
 *     nguyên trong `metadata` (lưới an toàn) và được ghi vào sổ `migration_conflict`
 *     để người có thẩm quyền rà lại.
 *
 * Dùng:  set -a && source .env && set +a
 *        ./node_modules/.bin/ts-node src/legacy-migration/cli/audit-address-vs-bihai.ts [--apply] [--out <path>]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';

/** Dấu hiệu cho thấy chuỗi thật sự là một địa chỉ, không phải tên người. */
const ADDRESS_HINT =
  /(đường|phố|phường|quận|huyện|xã|thị trấn|thị xã|tỉnh|thành phố|tp\.|q\.\d|p\.\d|số\s*\d|\d+\/\d+|ấp|khu phố|kp\.|tổ\s*\d)/i;

type Row = {
  id: string;
  caseCode: string | null;
  diaChiCungCap: string | null;
  biHai: string | null;
};

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx >= 0 ? process.argv[outIdx + 1] : 'audit-address-vs-bihai.json';
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    const rows = await prisma.$queryRawUnsafe<Row[]>(`
      SELECT id,
             "caseCode",
             "diaChiCungCap",
             metadata->>'biHai' AS "biHai"
      FROM cases
      WHERE "diaChiCungCap" IS NOT NULL
        AND NULLIF(btrim(metadata->>'biHai'), '') IS NOT NULL
    `);

    const identical: Row[] = [];
    const identicalButLooksLikeAddress: Row[] = [];
    for (const r of rows) {
      const a = (r.diaChiCungCap ?? '').trim();
      const b = (r.biHai ?? '').trim();
      if (a !== b) continue;
      if (ADDRESS_HINT.test(a)) identicalButLooksLikeAddress.push(r);
      else identical.push(r);
    }

    const totalAddr = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM cases WHERE "diaChiCungCap" IS NOT NULL`,
    );

    const report = {
      generatedAt: new Date().toISOString(),
      mode: apply ? 'APPLY' : 'CHỈ ĐỌC',
      tongHoSoCoDiaChi: Number(totalAddr[0]?.n ?? 0),
      trungKhopHoanToan: identical.length + identicalButLooksLikeAddress.length,
      anToanDeDon: identical.length,
      canNguoiRaSoat: identicalButLooksLikeAddress.length,
      mauAnToan: identical.slice(0, 20).map((r) => ({ caseCode: r.caseCode, giaTri: r.diaChiCungCap })),
      mauCanRaSoat: identicalButLooksLikeAddress.slice(0, 20).map((r) => ({ caseCode: r.caseCode, giaTri: r.diaChiCungCap })),
    };

    console.log('\n=== Đối soát "Địa chỉ" vs "Bị hại" (BUG-002) ===');
    console.log(`Chế độ: ${report.mode}`);
    console.log(`Hồ sơ có địa chỉ:                ${report.tongHoSoCoDiaChi}`);
    console.log(`Địa chỉ TRÙNG KHỚP tên bị hại:   ${report.trungKhopHoanToan}`);
    console.log(`  · an toàn để dọn (không giống địa chỉ chút nào): ${report.anToanDeDon}`);
    console.log(`  · cần người rà soát (có dấu hiệu địa chỉ):       ${report.canNguoiRaSoat}`);

    if (apply && identical.length > 0) {
      const runId = `address-vs-bihai-${new Date().toISOString()}`;
      // Ghi sổ TRƯỚC khi đụng dữ liệu — mất điện giữa chừng vẫn còn dấu vết.
      await prisma.migrationConflict.createMany({
        data: identical.map((r) => ({
          runId,
          entity: 'Case',
          recordId: r.id,
          field: 'diaChiCungCap',
          colValue: r.diaChiCungCap,
          metaValue: r.biHai,
          note: 'Ô Địa chỉ chứa tên bị hại (BUG-002) — đã trả về trống, giá trị gốc còn trong metadata.biHai',
        })),
      });
      const ids = identical.map((r) => r.id);
      const res = await prisma.case.updateMany({
        where: { id: { in: ids } },
        data: { diaChiCungCap: null },
      });
      console.log(`Đã trả về trống ${res.count} ô địa chỉ; ${identical.length} dòng đã ghi sổ rà soát (runId=${runId}).`);
      console.log('Giá trị gốc KHÔNG bị xoá — vẫn nằm trong metadata.biHai và trong sổ xung đột.');
    } else if (apply) {
      console.log('Không có trường hợp nào đủ an toàn để dọn tự động.');
    } else {
      console.log('\nĐây là lượt CHỈ ĐỌC — chưa thay đổi gì. Thêm --apply để dọn phần an toàn.');
    }

    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Báo cáo: ${outPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
