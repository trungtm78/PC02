/**
 * Suy TRẠNG THÁI THẬT của vụ án di trú từ tín hiệu nguồn, thay vì để tất cả = TIEP_NHAN.
 *
 * Vì sao: di trú đặt mọi vụ án về TIEP_NHAN. Nhưng nguồn có tín hiệu giai đoạn:
 *   • `metadata.ketQuaXuLyKhac` (217 vụ) ghi rõ: "KTVA số…" (khởi tố), "KLĐT ngày…" (kết
 *     luận điều tra), có thể có "đình chỉ"/"tạm đình chỉ"/"truy tố"/"xét xử".
 *   • `ngayKhoiTo` (782 vụ, đã bóc trước) ⇒ ít nhất là ĐANG ĐIỀU TRA.
 * Các mốc quyết định có cột riêng trong dump đều rỗng (sentinel 0) nên không dùng được.
 *
 * Nguyên tắc (anh chốt): CHỈ đổi khi tín hiệu RÕ; không rõ giữ TIEP_NHAN. Chỉ đổi vụ đang
 * TIEP_NHAN (không đè cán bộ đã cập nhật). Idempotent; mặc định `--dry`, ghi khi `--apply`.
 */
import { PrismaClient, CaseStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Suy trạng thái từ ô "kết quả xử lý" + cờ đã có ngày khởi tố. Trả null nếu không đủ rõ
 * (giữ nguyên trạng thái hiện tại). Ưu tiên trạng thái KẾT THÚC/MUỘN nhất.
 */
export function suyTrangThaiVuAn(ketQua: string | null | undefined, coNgayKhoiTo: boolean): CaseStatus | null {
  const t = (ketQua ?? '').toLowerCase();
  const co = (kw: string) => t.includes(kw);

  // "tạm đình chỉ" phải kiểm TRƯỚC "đình chỉ" (chuỗi con).
  if (co('tạm đình chỉ')) return CaseStatus.TAM_DINH_CHI;
  if (co('đình chỉ')) return CaseStatus.DINH_CHI;
  if (co('xét xử') || co('bản án') || co('tòa án') || co('toà án')) return CaseStatus.DANG_XET_XU;
  if (co('truy tố') || co('cáo trạng')) return CaseStatus.DANG_TRUY_TO;
  if (co('klđt') || co('kết luận điều tra')) return CaseStatus.DA_KET_LUAN;
  if (co('ktva') || co('khởi tố') || coNgayKhoiTo) return CaseStatus.DANG_DIEU_TRA;
  return null;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    const cases = await prisma.case.findMany({
      where: { legacySourceId: { not: null }, status: CaseStatus.TIEP_NHAN },
      select: { id: true, ngayKhoiTo: true, metadata: true },
    });

    const dem: Record<string, number> = {};
    let doi = 0;
    for (const c of cases) {
      const meta = (c.metadata ?? {}) as Record<string, unknown>;
      const ketQua = typeof meta.ketQuaXuLyKhac === 'string' ? meta.ketQuaXuLyKhac : null;
      const tt = suyTrangThaiVuAn(ketQua, c.ngayKhoiTo != null);
      if (!tt) continue;
      doi++;
      dem[tt] = (dem[tt] ?? 0) + 1;
      if (apply) await prisma.case.update({ where: { id: c.id }, data: { status: tt } });
    }

    console.log(apply ? '\n— ĐÃ GHI —\n' : '\n— CHẠY THỬ (thêm --apply để ghi) —\n');
    console.log(`Vụ án TIEP_NHAN khảo sát : ${cases.length}`);
    console.log(`  → đổi trạng thái       : ${doi}`);
    for (const [k, n] of Object.entries(dem).sort((a, b) => b[1] - a[1])) {
      console.log(`     ${k.padEnd(16)}: ${n}`);
    }
    console.log(`  → giữ TIEP_NHAN (không rõ): ${cases.length - doi}`);
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
