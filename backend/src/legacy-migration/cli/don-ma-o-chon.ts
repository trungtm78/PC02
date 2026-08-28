/**
 * don-ma-o-chon.ts — Dọn mã ô chọn hệ cũ còn sót trong các cột CHỮ.
 *
 * Bộ nạp đã được vá để giải mã tại cửa vào (`parityColumns` + bộ dựng thực thể), nhưng dữ liệu
 * đã di trú từ trước vẫn mang mã thô. Đo trên máy thật 28/08/2026:
 *
 *   tinhTrang / tinhTrangHoSo = '-1'   15.176 đơn thư · 1.273 vụ việc · 1.873 vụ án
 *   phanLoaiHoSoNoiBo         = '-1'    4.790 đơn thư ·   184 vụ việc · 1.313 vụ án
 *
 * `-1` là mã canh "chưa chọn" của hệ cũ, không phải dữ liệu — xem `ma-o-chon-he-cu.ts`.
 *
 * AN TOÀN:
 *   • Chỉ đụng bản ghi mà giá trị sau khi giải mã KHÁC giá trị đang có.
 *   • Chữ thật (118 vụ việc "Tạm đình chỉ theo Điều …") đi qua không đổi — bộ giải mã trả lại
 *     chính nó, nên không lọt vào diện cập nhật.
 *   • Mã lạ ngoài bảng GIỮ NGUYÊN và được liệt kê ra để người ta nhìn thấy, không nuốt.
 *   • `legacyRaw` KHÔNG đụng tới — bản gốc bất biến.
 *   • Chạy lại ra cùng kết quả (lần hai không còn gì để đổi).
 *
 * Dùng:  set -a && source .env && set +a
 *        ./node_modules/.bin/ts-node src/legacy-migration/cli/don-ma-o-chon.ts [--dry]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  giaiMaOChon,
  MA_CHUA_CHON,
  type LoaiOChon,
  type ThucTheHoSo,
} from '../ma-o-chon-he-cu';

interface CotCanDon {
  model: 'petition' | 'incident' | 'case';
  thucThe: ThucTheHoSo;
  col: string;
  loai: LoaiOChon;
}

/**
 * Vụ việc dùng tên cột `tinhTrangHoSo`, đơn thư và vụ án dùng `tinhTrang` — cùng một ô trên
 * màn hình, hai tên trong lược đồ. Khai tường minh thay vì suy từ tên: suy sai thì bộ dọn im
 * lặng bỏ qua đúng bảng cần dọn.
 */
const CAN_DON: CotCanDon[] = [
  { model: 'petition', thucThe: 'DON_THU', col: 'tinhTrang', loai: 'tinhTrang' },
  { model: 'petition', thucThe: 'DON_THU', col: 'phanLoaiHoSoNoiBo', loai: 'phanLoaiHoSo' },
  { model: 'incident', thucThe: 'VU_VIEC', col: 'tinhTrangHoSo', loai: 'tinhTrang' },
  { model: 'incident', thucThe: 'VU_VIEC', col: 'phanLoaiHoSoNoiBo', loai: 'phanLoaiHoSo' },
  { model: 'case', thucThe: 'VU_AN', col: 'tinhTrang', loai: 'tinhTrang' },
  { model: 'case', thucThe: 'VU_AN', col: 'phanLoaiHoSoNoiBo', loai: 'phanLoaiHoSo' },
];

export interface KetQuaDon {
  quet: number;
  doi: number;
  /** Mã không tra được bảng chữ — giữ nguyên, in ra để người ta quyết. */
  maLa: Map<string, number>;
}

const BATCH = 1000;

export async function donMotCot(
  prisma: PrismaClient,
  c: CotCanDon,
  dry: boolean,
): Promise<KetQuaDon> {
  const delegate = (prisma as unknown as Record<string, any>)[c.model];
  const kq: KetQuaDon = { quet: 0, doi: 0, maLa: new Map() };
  let cursor: string | undefined;

  for (;;) {
    const rows: Array<Record<string, unknown>> = await delegate.findMany({
      where: { [c.col]: { not: null }, deletedAt: null },
      select: { id: true, [c.col]: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;

    for (const r of rows) {
      kq.quet++;
      const truoc = String(r[c.col] ?? '');
      const sau = giaiMaOChon(c.loai, c.thucThe, truoc);
      // Mã số không tra được bảng chữ: bộ giải mã trả lại chính nó. Đếm ra để báo, không sửa.
      if (sau === truoc && /^-?\d+$/.test(truoc) && !MA_CHUA_CHON.has(truoc)) {
        kq.maLa.set(truoc, (kq.maLa.get(truoc) ?? 0) + 1);
      }
      if (sau === truoc) continue;
      kq.doi++;
      if (!dry) {
        // Rỗng ghi thành NULL, không phải chuỗi rỗng: cột NULL mới thật sự là "chưa nhập", và
        // form hệ mới gửi null khi xoá ô — xem `reference_o_rong_phai_gui_null`.
        await delegate.update({
          where: { id: r['id'] as string },
          data: { [c.col]: sau === '' ? null : sau },
        });
      }
    }
    cursor = rows[rows.length - 1]['id'] as string;
  }
  return kq;
}

/**
 * Khối `metadata` là bản sao hiển thị của dữ liệu cũ, và màn Chi tiết vụ án đọc THẲNG nó
 * (`CaseDetailPage.tsx`). Dọn cột mà bỏ metadata thì cùng một ô hiện đúng ở form và sai ở màn
 * Chi tiết — người ta mất tin vào cả hai chỗ.
 */
export interface KhoaMetadataCanDon {
  model: 'petition' | 'incident' | 'case';
  thucThe: ThucTheHoSo;
  /** Tên khoá TRONG metadata (khác tên cột: vụ việc là `tinhTrangHoSo`, metadata là `tinhTrang`). */
  khoa: string;
  loai: LoaiOChon;
}

export const METADATA_CAN_DON: KhoaMetadataCanDon[] = [
  { model: 'case', thucThe: 'VU_AN', khoa: 'tinhTrang', loai: 'tinhTrang' },
  { model: 'case', thucThe: 'VU_AN', khoa: 'phanLoaiHoSoNoiBo', loai: 'phanLoaiHoSo' },
  { model: 'incident', thucThe: 'VU_VIEC', khoa: 'tinhTrangHoSo', loai: 'tinhTrang' },
  { model: 'petition', thucThe: 'DON_THU', khoa: 'tinhTrang', loai: 'tinhTrang' },
];

export async function donMetadata(
  prisma: PrismaClient,
  c: KhoaMetadataCanDon,
  dry: boolean,
): Promise<KetQuaDon> {
  const delegate = (prisma as unknown as Record<string, any>)[c.model];
  const kq: KetQuaDon = { quet: 0, doi: 0, maLa: new Map() };
  let cursor: string | undefined;

  for (;;) {
    const rows: Array<{ id: string; metadata: unknown }> = await delegate.findMany({
      where: { metadata: { not: null }, deletedAt: null },
      select: { id: true, metadata: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;

    for (const r of rows) {
      kq.quet++;
      const meta = r.metadata;
      // `metadata` là cột JSON tuỳ ý: có hồ sơ để null, có hồ sơ lưu chuỗi. Không chặn ở đây
      // thì bộ dọn nổ giữa chừng và bỏ dở nửa bảng.
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) continue;
      const khoi = meta as Record<string, unknown>;
      if (!(c.khoa in khoi)) continue;

      const truoc = String(khoi[c.khoa] ?? '');
      const sau = giaiMaOChon(c.loai, c.thucThe, truoc);
      if (sau === truoc && /^-?\d+$/.test(truoc) && !MA_CHUA_CHON.has(truoc)) {
        kq.maLa.set(truoc, (kq.maLa.get(truoc) ?? 0) + 1);
      }
      if (sau === truoc) continue;
      kq.doi++;
      if (!dry) {
        const moi = { ...khoi };
        // Rỗng thì GỠ HẲN khoá. Để lại khoá với chuỗi rỗng nghĩa là "đã nhập rồi để trống",
        // khác hẳn "chưa từng nhập" — và màn Chi tiết lọc theo `.filter((r) => r.value)`.
        if (sau === '') delete moi[c.khoa];
        else moi[c.khoa] = sau;
        await delegate.update({ where: { id: r.id }, data: { metadata: moi } });
      }
    }
    cursor = rows[rows.length - 1].id;
  }
  return kq;
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry');
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('Thiếu DATABASE_URL — chạy `set -a && source .env && set +a` trước.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  console.log(dry ? '── CHẠY THỬ, không ghi ──' : '── CHẠY THẬT ──');
  let tongDoi = 0;
  for (const c of CAN_DON) {
    const kq = await donMotCot(prisma, c, dry);
    tongDoi += kq.doi;
    console.log(`${c.model}.${c.col}: quét ${kq.quet}, đổi ${kq.doi}`);
    for (const [ma, n] of kq.maLa) {
      console.log(`   ! mã lạ giữ nguyên: ${ma} (${n} hồ sơ) — không có trong bảng chữ hệ cũ`);
    }
  }
  for (const c of METADATA_CAN_DON) {
    const kq = await donMetadata(prisma, c, dry);
    tongDoi += kq.doi;
    console.log(`${c.model}.metadata.${c.khoa}: quét ${kq.quet}, đổi ${kq.doi}`);
    for (const [ma, n] of kq.maLa) {
      console.log(`   ! mã lạ giữ nguyên: ${ma} (${n} hồ sơ) — không có trong bảng chữ hệ cũ`);
    }
  }
  console.log(`TỔNG: ${tongDoi} ô ${dry ? 'sẽ đổi' : 'đã đổi'}`);
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
