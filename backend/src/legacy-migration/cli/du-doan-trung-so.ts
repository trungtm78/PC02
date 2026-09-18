import type { PrismaClient } from '@prisma/client';
import { maTuBanTho } from './backfill-ma-ho-so';

/** Giá trị Mongo nguyên thuỷ → chuỗi; kiểu khác (đối tượng, mảng) coi như trống. */
function chuoi(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
}

export interface TrungSoHeMoi {
  sourceId: string;
  soHeCu: string;
  /** Loại hồ sơ hệ cũ (`loai`) — cho biết hồ sơ sẽ nạp thành loại nào. */
  loaiHeCu: string;
  /** Loại hồ sơ HỆ MỚI đang giữ số ấy. */
  bangHeMoi: Array<'Đơn thư' | 'Vụ việc' | 'Vụ án'>;
}

/**
 * Xem trước khi nạp (chế độ `--dry`): hồ sơ hệ cũ nào mang số đã có hồ sơ HỆ MỚI tạo giữ.
 *
 * Để người duyệt thấy TRƯỚC khi ghi: hồ sơ trùng CÙNG LOẠI sẽ nhận số mới theo bộ đếm và giữ số
 * hệ cũ ở STT cũ (`buMaHoSo`); trùng KHÁC LOẠI thì giữ nguyên số (bộ đếm tách theo loại).
 */
export async function duDoanTrungSoHeMoi(
  prisma: PrismaClient,
  taiLieu: Array<Record<string, unknown>>,
): Promise<TrungSoHeMoi[]> {
  const theoSo = new Map<
    string,
    Array<{ sourceId: string; loaiHeCu: string }>
  >();
  for (const d of taiLieu) {
    const so = maTuBanTho(d);
    if (!so) continue;
    const ds = theoSo.get(so) ?? [];
    ds.push({ sourceId: chuoi(d['id']), loaiHeCu: chuoi(d['loai']) });
    theoSo.set(so, ds);
  }
  const so = [...theoSo.keys()];
  if (!so.length) return [];

  const [don, viec, an] = await Promise.all([
    prisma.petition.findMany({
      where: { stt: { in: so }, legacySourceId: null },
      select: { stt: true },
    }),
    prisma.incident.findMany({
      where: { code: { in: so }, legacySourceId: null },
      select: { code: true },
    }),
    prisma.case.findMany({
      where: { caseCode: { in: so }, legacySourceId: null },
      select: { caseCode: true },
    }),
  ]);
  const giu = new Map<string, TrungSoHeMoi['bangHeMoi']>();
  const them = (ma: string | null, ten: TrungSoHeMoi['bangHeMoi'][number]) => {
    if (!ma) return;
    giu.set(ma, [...(giu.get(ma) ?? []), ten]);
  };
  don.forEach((d) => them(d.stt, 'Đơn thư'));
  viec.forEach((v) => them(v.code, 'Vụ việc'));
  an.forEach((a) => them(a.caseCode, 'Vụ án'));

  return [...giu.entries()]
    .flatMap(([soHeCu, bangHeMoi]) =>
      (theoSo.get(soHeCu) ?? []).map((h) => ({
        sourceId: h.sourceId,
        soHeCu,
        loaiHeCu: h.loaiHeCu,
        bangHeMoi,
      })),
    )
    .sort((a, b) => a.soHeCu.localeCompare(b.soHeCu));
}
