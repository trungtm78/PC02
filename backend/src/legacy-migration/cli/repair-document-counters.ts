/**
 * repair-document-counters.ts — dò và sửa BỘ ĐẾM SỐ bị tụt lại sau mã đã dùng thật.
 *
 * VÌ SAO CẦN: bộ sinh số cấp `bộ đếm + 1` và tin bộ đếm là nguồn sự thật duy nhất. Mọi
 * công cụ ghi thẳng vào cột mã (di trú, cấp mã hàng loạt, seed) đều đi vòng qua nó, để lại
 * bộ đếm tụt phía sau. Lần cấp số kế tiếp rơi trúng mã đã có → cột mã là @unique → P2002 →
 * người dùng thấy "Internal server error" và KHÔNG lưu được hồ sơ.
 *
 * Đã xảy ra thật ngày 25/08/2026, ngày đầu vận hành thử: bộ đếm đơn thư kỳ 2026 đứng ở
 * 9894 trong khi mã lớn nhất đang dùng là 11141 → chặn toàn bộ việc tạo đơn thư mới.
 *
 * CHỈ NÂNG, KHÔNG BAO GIỜ HẠ. Hạ bộ đếm sẽ cấp lại số đã dùng — đúng cái lỗi này.
 * MẶC ĐỊNH CHỈ ĐỌC; `--apply` mới ghi. Chạy lại được, kết quả như nhau.
 *
 * Dùng: set -a && source .env && set +a
 *       ts-node src/legacy-migration/cli/repair-document-counters.ts [--apply]
 *
 * Chạy công cụ này SAU MỌI lượt di trú hoặc cấp mã hàng loạt.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** Loại hồ sơ nào lấy mã từ bảng nghiệp vụ nào. Mẫu khác (vật chứng, phiếu…) không có
 *  bảng mã tương ứng nên bộ đếm của chúng là nguồn sự thật duy nhất — không đụng tới. */
const NGUON_MA: Record<string, { bang: string; cot: string }> = {
  PETITION: { bang: 'petitions', cot: 'stt' },
  CASE: { bang: 'cases', cot: 'caseCode' },
  INCIDENT: { bang: 'incidents', cot: 'code' },
};

export interface DongKetQua {
  ten: string;
  documentType: string;
  periodKey: string;
  maxThat: number;
  boDemCu: number;
  boDemMoi: number;
  canSua: boolean;
}

/**
 * Số lớn nhất đang dùng thật trong kỳ, nhận CẢ HAI định dạng mã:
 *   • `2026-9895`      — định dạng hiện hành (năm-stt)
 *   • `DT-2026-00001`  — định dạng cũ còn sót trong dữ liệu
 * Bỏ sót một trong hai là bỏ sót đúng chỗ sinh ra sự cố.
 *
 * AN TOÀN: `bang`/`cot` phải nối vào chuỗi vì SQL không cho tham số hoá tên bảng/cột. Chúng
 * CHỈ đến từ hằng số `NGUON_MA` ngay trên đầu tệp này — không có đường nào cho dữ liệu người
 * dùng chạm tới. `periodKey` thì tham số hoá bình thường ($1/$2). ĐỪNG sao chép mẫu này cho
 * tên bảng/cột đến từ đầu vào bên ngoài.
 */
async function maxDangDung(
  prisma: PrismaClient,
  bang: string,
  cot: string,
  periodKey: string,
): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ max_suffix: number | null }>>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING("${cot}" FROM '[0-9]+$') AS INTEGER)), 0) AS max_suffix
       FROM "${bang}"
      WHERE "${cot}" LIKE $1 OR "${cot}" LIKE $2`,
    `${periodKey}-%`,
    `%-${periodKey}-%`,
  );
  return Number(rows?.[0]?.max_suffix ?? 0);
}

/**
 * Nâng bộ đếm cho khớp mã đã dùng thật. Dùng chung cho CLI này và cho mọi công cụ ghi mã
 * trực tiếp (`backfill-ma-ho-so.ts`) — một nguồn sự thật, không chép logic đi nơi khác.
 *
 * CHỈ NÂNG. Trả về danh sách bộ đếm đã đụng tới.
 */
export async function napLaiBoDem(
  prisma: PrismaClient,
  apply: boolean,
): Promise<DongKetQua[]> {
  const counters = await prisma.documentNumberCounter.findMany({
    include: { template: { select: { name: true, documentType: true } } },
    orderBy: [{ periodKey: 'desc' }],
  });

  const ketQua: DongKetQua[] = [];
  for (const c of counters) {
    const nguon = NGUON_MA[c.template.documentType];
    if (!nguon) continue; // Không có bảng mã đối chiếu → bộ đếm là nguồn sự thật.
    const maxThat = await maxDangDung(prisma, nguon.bang, nguon.cot, c.periodKey);
    const canSua = maxThat > c.currentValue;
    ketQua.push({
      ten: c.template.name,
      documentType: c.template.documentType,
      periodKey: c.periodKey,
      maxThat,
      boDemCu: c.currentValue,
      boDemMoi: canSua ? maxThat : c.currentValue,
      canSua,
    });
  }

  if (apply) {
    for (const r of ketQua.filter((x) => x.canSua)) {
      // Điều kiện `lt` là chốt an toàn cuối: nếu một tiến trình khác vừa nâng bộ đếm lên
      // cao hơn trong lúc mình đang chạy thì KHÔNG hạ nó xuống.
      await prisma.documentNumberCounter.updateMany({
        where: {
          template: { documentType: r.documentType },
          periodKey: r.periodKey,
          currentValue: { lt: r.boDemMoi },
        },
        data: { currentValue: r.boDemMoi, updatedAt: new Date() },
      });
    }
  }

  return ketQua;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });

  console.log(`\n=== Dò bộ đếm số — chế độ: ${apply ? 'GHI THẬT' : 'CHỈ ĐỌC'} ===\n`);

  try {
    const ketQua = await napLaiBoDem(prisma, apply);
    const lech = ketQua.filter((r) => r.canSua);

    console.log('Loại'.padEnd(24), 'Kỳ'.padEnd(8), 'Max thật'.padStart(9), 'Bộ đếm'.padStart(9), 'Lệch'.padStart(7));
    console.log('-'.repeat(62));
    for (const r of ketQua) {
      const dau = r.canSua ? 'LỆCH' : '  ok';
      console.log(
        dau,
        r.ten.padEnd(24),
        r.periodKey.padEnd(8),
        String(r.maxThat).padStart(9),
        String(r.boDemCu).padStart(9),
        String(r.canSua ? r.maxThat - r.boDemCu : 0).padStart(7),
      );
    }

    console.log(`\nTổng: ${ketQua.length} bộ đếm có bảng mã đối chiếu · ${lech.length} bị lệch`);

    if (!lech.length) {
      console.log('\n>>> KHÔNG CÓ BỘ ĐẾM NÀO TỤT LẠI — không cần sửa.');
      return;
    }

    for (const r of lech) {
      console.log(
        `  ${r.ten} kỳ ${r.periodKey}: ${r.boDemCu} → ${r.boDemMoi} (số cấp kế tiếp sẽ là ${r.boDemMoi + 1})`,
      );
    }

    if (!apply) {
      console.log('\n(CHỈ ĐỌC — chưa ghi gì. Thêm --apply để thực thi.)');
      return;
    }
    console.log(`\n>>> ĐÃ NÂNG ${lech.length} bộ đếm.`);
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
