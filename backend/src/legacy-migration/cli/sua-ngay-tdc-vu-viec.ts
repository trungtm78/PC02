/**
 * sua-ngay-tdc-vu-viec.ts — sửa Ngày đề xuất (ngày tiếp nhận) của vụ việc TẠM ĐÌNH CHỈ đã nạp từ hệ cũ.
 *
 * Đo prod 19/09/2026: CẢ 118 hồ sơ collection `TamDinhChi_vu_viec_21` lưu NGƯỢC ô ngày/năm (`tiep_nhan_ngay=2020`,
 * `tiep_nhan_nam=30`); bộ nạp cũ ghép thẳng nên ngày TRÀN — 37 hồ sơ ra 2027–2036 (chiếm đầu danh sách Vụ việc khi sắp
 * Ngày đề xuất giảm dần), 81 hồ sơ ra ngày quá khứ trông hợp lý nhưng sai. Bộ nạp đã sửa (`ngayTiepNhanTdc`); công cụ
 * này sửa phần đã nạp, CÙNG hàm với bộ nạp.
 *
 * AN TOÀN:
 *  • Mặc định CHẠY THỬ (in mẫu); `--that` mới ghi. Luôn `pg_dump` trước.
 *  • Chỉ sửa hồ sơ có ngày khác ngày suy được; bản thô không suy ra ngày có thật → không đoán, bỏ qua.
 *  • Mô tả: chỉ thay dòng "Số tiếp nhận: X/<ngày>" khi CÒN NGUYÊN như bộ nạp cũ sinh — cán bộ đã sửa thì không động.
 *  • Giữ `updatedAt` cũ (sửa dữ liệu di trú, không phải cán bộ sửa); mỗi hồ sơ một dòng nhật ký có trước/sau.
 *  • Chạy lại ra 0.
 *
 * Dùng:  set -a && source .env && set +a
 *        node dist/src/legacy-migration/cli/sua-ngay-tdc-vu-viec.js [--that]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ngayTiepNhanTdc, type LegacyRecord } from '../legacy-mapper';

export const NGUON_TDC = 'TamDinhChi_vu_viec_21';

export interface DongTdc {
  id: string;
  code: string | null;
  ngayDeXuat: Date | null;
  description: string | null;
  legacyRaw: unknown;
  updatedAt?: Date;
}

export interface MucSua {
  id: string;
  code: string | null;
  ngayCu: Date | null;
  ngayMoi: Date;
  moTaMoi?: string;
}

const cungNgay = (a: Date | null, b: Date) =>
  !!a && a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

/** Hồ sơ cần sửa + giá trị mới — hàm thuần, CÙNG `ngayTiepNhanTdc` với bộ nạp. */
export function lapKeHoach(dong: readonly DongTdc[]): MucSua[] {
  const ra: MucSua[] = [];
  for (const d of dong) {
    const raw = (d.legacyRaw ?? {}) as LegacyRecord;
    const { ngay, nam } = ngayTiepNhanTdc(raw);
    if (!ngay || cungNgay(d.ngayDeXuat, ngay)) continue;

    // Dòng bộ nạp CŨ sinh: "Số tiếp nhận: <so>/<ô tiep_nhan_nam gốc>".
    let moTaMoi: string | undefined;
    const so = raw.tiep_nhan_so;
    const cu = `Số tiếp nhận: ${String(so)}/${String(raw.tiep_nhan_nam)}`;
    const moi = `Số tiếp nhận: ${String(so)}/${String(nam)}`;
    if (so != null && nam && cu !== moi && d.description?.includes(cu)) {
      moTaMoi = d.description.replace(cu, moi);
    }
    ra.push({
      id: d.id,
      code: d.code,
      ngayCu: d.ngayDeXuat,
      ngayMoi: ngay,
      moTaMoi,
    });
  }
  return ra;
}

interface PrismaSua {
  incident: {
    findMany(args: unknown): Promise<DongTdc[]>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  auditLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  $transaction<T>(fn: (tx: PrismaSua) => Promise<T>): Promise<T>;
}

const ngayIn = (d: Date | null) =>
  d ? d.toISOString().slice(0, 10) : '(trống)';

export async function suaNgayTdc(
  prisma: PrismaSua,
  that: boolean,
  inRa: (dong: string) => void = console.log,
): Promise<{ seSua: number; daSua: number }> {
  inRa(
    `\n=== Sửa ngày tiếp nhận vụ việc TĐC — chế độ: ${that ? 'GHI THẬT' : 'CHẠY THỬ'} ===\n`,
  );
  const dong = await prisma.incident.findMany({
    where: {
      deletedAt: null,
      legacyRaw: { path: ['__sourceCollection'], equals: NGUON_TDC },
    },
    select: {
      id: true,
      code: true,
      ngayDeXuat: true,
      description: true,
      legacyRaw: true,
      updatedAt: true,
    },
  });
  const keHoach = lapKeHoach(dong);
  const tuongLai = keHoach.filter(
    (k) => (k.ngayCu?.getTime() ?? 0) > Date.now(),
  ).length;
  inRa(
    `Quét ${dong.length} vụ việc TĐC · sẽ sửa ${keHoach.length} (đang ở tương lai: ${tuongLai}) · ` +
      `mô tả sửa kèm: ${keHoach.filter((k) => k.moTaMoi).length}`,
  );
  for (const k of keHoach.slice(0, 12)) {
    inRa(
      `   ${k.code}: ${ngayIn(k.ngayCu)} → ${ngayIn(k.ngayMoi)}${k.moTaMoi ? ' (+ mô tả)' : ''}`,
    );
  }
  if (!that) {
    inRa('\nCHẠY THỬ — chưa ghi gì. Thêm --that để ghi (nhớ pg_dump trước).');
    return { seSua: keHoach.length, daSua: 0 };
  }

  const cuTheoId = new Map(dong.map((d) => [d.id, d]));
  let daSua = 0;
  await prisma.$transaction(async (tx) => {
    for (const k of keHoach) {
      await tx.incident.update({
        where: { id: k.id },
        data: {
          ngayDeXuat: k.ngayMoi,
          ...(k.moTaMoi ? { description: k.moTaMoi } : {}),
          // Sửa dữ liệu di trú, không phải cán bộ sửa — giữ mốc "sửa lần cuối".
          updatedAt: cuTheoId.get(k.id)?.updatedAt,
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'INCIDENT_TDC_NGAY_TIEP_NHAN_SUA',
          subject: 'Incident',
          subjectId: k.id,
          metadata: {
            ma: k.code,
            truoc: ngayIn(k.ngayCu),
            sau: ngayIn(k.ngayMoi),
            suaMoTa: !!k.moTaMoi,
            lyDo: 'Hệ cũ đảo ô ngày/năm của TamDinhChi_vu_viec_21 (sua-ngay-tdc-vu-viec)',
          },
        },
      });
      daSua++;
    }
  });
  inRa(`Đã sửa ${daSua} vụ việc.`);
  return { seSua: keHoach.length, daSua };
}

if (require.main === module) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  suaNgayTdc(prisma as unknown as PrismaSua, process.argv.includes('--that'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect().catch(() => undefined));
}
