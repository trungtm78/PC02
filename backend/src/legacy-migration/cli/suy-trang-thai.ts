import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { writeFileSync } from 'fs';
import { chay } from '../trang-thai/ap-trang-thai-he-cu';

/**
 * Bộ lệnh suy trạng thái từ chữ hệ cũ.
 *
 *   npx ts-node src/legacy-migration/cli/suy-trang-thai.ts            # chạy khô
 *   npx ts-node src/legacy-migration/cli/suy-trang-thai.ts --apply    # ghi thật
 *
 * Luôn xuất ba tệp CSV, dù chạy khô hay ghi thật:
 *
 *   da-gan.csv       hồ sơ đã (hoặc sẽ) đổi trạng thái — DANH SÁCH ĐỂ KHÁCH HÀNG XÁC NHẬN
 *   de-lai.csv       suy được nhưng cố ý không gán, kèm lý do
 *   khong-suy.csv    không suy được hoặc nhập nhằng — cán bộ rà tay
 *
 * Mọi tệp đều khoá theo **STT và NĂM hệ cũ**, vì hệ cũ định danh hồ sơ bằng cặp ấy chứ không
 * bằng một số toàn cục. Kèm nguyên văn câu chữ để người xác nhận soi được phán đoán, không phải
 * tin lời máy.
 */

/** CSV cho Excel tiếng Việt: BOM để không vỡ dấu, dấu chấm phẩy để không vỡ cột. */
function csv(cot: string[], dong: Array<Array<string | number | null | undefined>>): string {
  const o = (v: string | number | null | undefined) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return '﻿' + [cot.join(';'), ...dong.map((d) => d.map(o).join(';'))].join('\r\n');
}

const TEN_THUC_THE: Record<string, string> = {
  don_thu: 'Đơn thư',
  vu_viec: 'Vụ việc',
  vu_an: 'Vụ án',
};

async function main() {
  const apDung = process.argv.includes('--apply');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });

  console.log(apDung ? '⚠  GHI THẬT vào cơ sở dữ liệu' : 'Chạy khô — không ghi gì vào hồ sơ');

  const kq = await chay(prisma, apDung);

  const nam = (s: string | null) => s ?? '';
  writeFileSync(
    'da-gan.csv',
    csv(
      ['Loại hồ sơ', 'Năm (hệ cũ)', 'STT (hệ cũ)', 'Mã hồ sơ (hệ mới)', 'Trạng thái cũ', 'Trạng thái mới', 'Ngày suy từ câu chữ', 'Nguyên văn hệ cũ'],
      kq.ap.map((d) => [
        TEN_THUC_THE[d.thucThe],
        nam(d.namCu),
        nam(d.sttCu),
        d.maHoSo,
        d.trangThaiCu,
        d.trangThaiMoi,
        d.ngaySuy ? d.ngaySuy.toLocaleDateString('vi-VN') : '',
        d.nguyenVan,
      ]),
    ),
  );

  writeFileSync(
    'de-lai.csv',
    csv(
      ['Loại hồ sơ', 'STT (hệ cũ)', 'Trạng thái suy được', 'Vì sao không gán', 'Nguyên văn hệ cũ'],
      kq.deLai.map((d) => [TEN_THUC_THE[d.thucThe], nam(d.sttCu), d.trangThai, d.lyDo, d.nguyenVan]),
    ),
  );

  writeFileSync(
    'khong-suy.csv',
    csv(
      ['Loại hồ sơ', 'STT (hệ cũ)', 'Vì sao', 'Khớp những gì', 'Nguyên văn hệ cũ'],
      kq.khongSuy.map((d) => [
        TEN_THUC_THE[d.thucThe],
        nam(d.sttCu),
        d.ly === 'NHAP_NHANG' ? 'Câu mang nhiều trạng thái' : 'Không khớp mẫu nào',
        d.khop.join(' + '),
        d.nguyenVan,
      ]),
    ),
  );

  const dem = (xs: Array<{ trangThaiMoi?: string; trangThai?: string }>) => {
    const m = new Map<string, number>();
    for (const x of xs) {
      const k = x.trangThaiMoi ?? x.trangThai ?? '?';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  console.log(`\nRun: ${kq.runId}`);
  console.log(`\nĐÃ ${apDung ? 'GÁN' : 'SẼ GÁN'}: ${kq.ap.length} hồ sơ`);
  for (const [k, v] of dem(kq.ap)) console.log(`   ${String(v).padStart(6)}  ${k}`);
  console.log(`\nĐỂ LẠI (cần rà tay): ${kq.deLai.length}`);
  for (const [k, v] of dem(kq.deLai)) console.log(`   ${String(v).padStart(6)}  ${k}`);
  console.log(`\nKHÔNG SUY ĐƯỢC: ${kq.khongSuy.length}`);
  console.log('\nĐã xuất: da-gan.csv · de-lai.csv · khong-suy.csv');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
