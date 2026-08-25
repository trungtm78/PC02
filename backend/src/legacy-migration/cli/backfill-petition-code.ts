/**
 * backfill-petition-code.ts — cấp MÃ HỒ SƠ chuẩn `năm-stt` cho đơn thư di trú còn mang mã
 * tạm `DT-LEGACY-<khoá nguồn>`.
 *
 * VÌ SAO CẦN: đường nhập đặt `stt = DT-LEGACY-<khoá>` lúc TẠO (xem legacy-migration.service)
 * rồi trông chờ một bước cấp mã chạy sau. Bước ấy trước nay làm bằng SQL tại chỗ nên không
 * chạy cho hồ sơ nhập về sau — đo ngày 25/08: 45.298 hồ sơ có mã chuẩn, 1.333 vẫn mang mã
 * tạm. Cán bộ nhìn thấy mã này trên màn hình, nên nó là lỗi hiển thị chứ không chỉ là dọn
 * dẹp nội bộ.
 *
 * QUY TẮC SUY TỪ DỮ LIỆU, KHÔNG PHẢI TỪ MÃ NGUỒN: đối chiếu 8 mẫu ngẫu nhiên trong nhóm
 * 45.298 hồ sơ đã có mã cho thấy `stt = <nam>-<stt>` — dùng trường `stt`, KHÔNG phải
 * `stt_cu` (vd 2018-2360 có nam=2018, stt=2360, stt_cu=1964).
 *
 * • Chỉ đụng hồ sơ đang mang mã tạm — không bao giờ đè mã đã cấp.
 * • `stt` là @unique: trùng thì thêm hậu tố `-2`, `-3`… thay vì ném lỗi giữa chừng.
 * • Duyệt theo legacySourceId để chạy lại cho kết quả y hệt.
 * • MẶC ĐỊNH CHỈ ĐỌC; `--apply` mới ghi.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { napLaiBoDem } from './repair-document-counters';

const TAM = 'DT-LEGACY-';

/** Mã cơ sở từ bản thô hệ cũ, hoặc undefined khi thiếu dữ kiện. */
export function maCoSo(nam: unknown, stt: unknown): string | undefined {
  const n = nam == null ? '' : String(nam).trim();
  const s = stt == null ? '' : String(stt).trim();
  if (!/^\d{4}$/.test(n) || !/^\d+$/.test(s)) return undefined;
  return `${n}-${s}`;
}

/** Mã duy nhất: giữ nguyên nếu chưa ai dùng, không thì thêm hậu tố tăng dần. */
export function capMaDuyNhat(base: string, daDung: Set<string>): string {
  if (!daDung.has(base)) {
    daDung.add(base);
    return base;
  }
  for (let i = 2; ; i++) {
    const ma = `${base}-${i}`;
    if (!daDung.has(ma)) {
      daDung.add(ma);
      return ma;
    }
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });

  console.log(`\n=== Cấp mã đơn thư — chế độ: ${apply ? 'GHI THẬT' : 'CHỈ ĐỌC'} ===\n`);

  try {
    // Mọi mã đang tồn tại (kể cả hồ sơ đã xoá mềm) — `stt` là @unique trên toàn bảng.
    const daDung = new Set(
      (await prisma.petition.findMany({ select: { stt: true } })).map((p) => p.stt),
    );

    const canCap = await prisma.petition.findMany({
      where: { stt: { startsWith: TAM }, deletedAt: null },
      select: { id: true, stt: true, legacySourceId: true, legacyRaw: true },
      orderBy: { legacySourceId: 'asc' },
    });
    console.log(`Đơn thư còn mã tạm: ${canCap.length.toLocaleString('vi-VN')}`);

    // Một số đơn thư di trú là VỎ LIÊN KẾT: bản thô hệ cũ được định tuyến sang vụ án hoặc
    // vụ việc cùng khoá nguồn, nên `petitions.legacyRaw` để trống (đo 25/08: 161 hồ sơ).
    // Dữ kiện cấp mã vẫn có — chỉ nằm ở thực thể anh em. Lấy từ đó thay vì bỏ cuộc.
    const thieuRaw = canCap.filter((p) => !p.legacyRaw && p.legacySourceId).map((p) => p.legacySourceId!);
    const rawAnhEm = new Map<string, Record<string, unknown>>();
    if (thieuRaw.length) {
      for (const c of await prisma.case.findMany({
        where: { legacySourceId: { in: thieuRaw } },
        select: { legacySourceId: true, legacyRaw: true },
      })) {
        if (c.legacySourceId && c.legacyRaw) rawAnhEm.set(c.legacySourceId, c.legacyRaw as Record<string, unknown>);
      }
      for (const i of await prisma.incident.findMany({
        where: { legacySourceId: { in: thieuRaw } },
        select: { legacySourceId: true, legacyRaw: true },
      })) {
        if (i.legacySourceId && i.legacyRaw && !rawAnhEm.has(i.legacySourceId)) {
          rawAnhEm.set(i.legacySourceId, i.legacyRaw as Record<string, unknown>);
        }
      }
      console.log(`  (${thieuRaw.length} đơn thư không có bản thô — tìm được ${rawAnhEm.size} ở vụ án/vụ việc cùng khoá)`);
    }

    let daCap = 0;
    let thieuDuKien = 0;
    const viDu: string[] = [];
    const hong: string[] = [];

    for (const p of canCap) {
      const raw = (p.legacyRaw ??
        (p.legacySourceId ? rawAnhEm.get(p.legacySourceId) : undefined) ??
        {}) as Record<string, unknown>;
      const base = maCoSo(raw['nam'], raw['stt']);
      if (!base) {
        thieuDuKien++;
        continue;
      }
      const ma = capMaDuyNhat(base, daDung);
      if (viDu.length < 5) viDu.push(`${p.stt} → ${ma}`);
      if (apply) {
        try {
          await prisma.petition.update({ where: { id: p.id }, data: { stt: ma } });
        } catch (e) {
          // `stt` là @unique và cán bộ vẫn đang tạo hồ sơ trong lúc lượt này chạy. Một va
          // chạm không được phép làm hỏng 1.332 hồ sơ còn lại — ghi nhận rồi đi tiếp, chạy
          // lại sẽ nhặt nốt vì công cụ chỉ đụng hồ sơ còn mã tạm.
          hong.push(`${p.stt} → ${ma}: ${(e as Error).message.split('\n')[0]}`);
          continue;
        }
      }
      daCap++;
    }

    console.log(`${apply ? 'Đã cấp' : 'Sẽ cấp'}      : ${daCap.toLocaleString('vi-VN')}`);
    console.log(`Thiếu dữ kiện : ${thieuDuKien.toLocaleString('vi-VN')} (giữ nguyên mã tạm)`);
    if (hong.length) {
      console.log(`Không cấp được: ${hong.length} (chạy lại sẽ nhặt nốt)`);
      console.log(`  ${hong.slice(0, 5).join('\n  ')}`);
    }
    if (viDu.length) console.log(`\nVí dụ:\n  ${viDu.join('\n  ')}`);

    // BẮT BUỘC: công cụ này ghi thẳng vào cột mã, đi vòng qua bộ sinh số, nên bộ đếm bị bỏ
    // lại phía sau. Không nhích nó thì lần cấp số kế tiếp rơi trúng mã vừa gán → @unique →
    // người dùng không lưu được hồ sơ. Đã xảy ra thật ngày 25/08/2026 và chặn cả ngày đầu
    // vận hành thử. Nâng ngay tại đây để lỗi ấy không thể lặp lại.
    console.log(`\n--- Nạp lại bộ đếm số ---`);
    const boDem = await napLaiBoDem(prisma, apply);
    const daNang = boDem.filter((b) => b.canSua);
    if (!daNang.length) {
      console.log('Không bộ đếm nào tụt lại.');
    } else {
      for (const b of daNang) {
        console.log(`  ${b.ten} kỳ ${b.periodKey}: ${b.boDemCu} → ${b.boDemMoi}`);
      }
      console.log(`${apply ? 'Đã nâng' : 'Sẽ nâng'} ${daNang.length} bộ đếm.`);
    }

    if (!apply) console.log(`\n(CHỈ ĐỌC — chưa ghi gì. Thêm --apply để thực thi.)`);
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
