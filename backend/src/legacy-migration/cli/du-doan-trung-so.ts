import type { PrismaClient } from '@prisma/client';
import { laSoHeMoi, maTuBanTho } from './backfill-ma-ho-so';

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

type DongMa = {
  ma: string | null;
  legacySourceId: string | null;
  legacyRaw: unknown;
};

/**
 * Xem trước khi nạp (chế độ `--dry`): hồ sơ hệ cũ CHƯA CÓ trong hệ mới mang số đang là số HỆ MỚI.
 *
 * Cùng luật với `buMaHoSo` (`laSoHeMoi` + cùng năm bộ đếm), để bản xem trước nói đúng điều bước ghi
 * sẽ làm: trùng CÙNG LOẠI → số mới theo bộ đếm, số hệ cũ vào STT cũ; khác loại → giữ số.
 */
export async function duDoanTrungSoHeMoi(
  prisma: PrismaClient,
  taiLieu: Array<Record<string, unknown>>,
  namBoDem: number = new Date().getFullYear(),
): Promise<TrungSoHeMoi[]> {
  const theoSo = new Map<
    string,
    Array<{ sourceId: string; loaiHeCu: string }>
  >();
  for (const d of taiLieu) {
    const so = maTuBanTho(d);
    if (!so || !so.startsWith(`${namBoDem}-`)) continue;
    const ds = theoSo.get(so) ?? [];
    ds.push({ sourceId: chuoi(d['id']), loaiHeCu: chuoi(d['loai']) });
    theoSo.set(so, ds);
  }
  const so = [...theoSo.keys()];
  if (!so.length) return [];

  const [don, viec, an] = await Promise.all([
    prisma.petition.findMany({
      where: { stt: { in: so } },
      select: { stt: true, legacySourceId: true, legacyRaw: true },
    }),
    prisma.incident.findMany({
      where: { code: { in: so } },
      select: { code: true, legacySourceId: true, legacyRaw: true },
    }),
    prisma.case.findMany({
      where: { caseCode: { in: so } },
      select: { caseCode: true, legacySourceId: true, legacyRaw: true },
    }),
  ]);
  const giu = new Map<string, TrungSoHeMoi['bangHeMoi']>();
  const them = (d: DongMa, ten: TrungSoHeMoi['bangHeMoi'][number]) => {
    const raw = (d.legacyRaw ?? null) as Record<string, unknown> | null;
    if (
      !d.ma ||
      !laSoHeMoi({ ma: d.ma, legacySourceId: d.legacySourceId, raw })
    )
      return;
    giu.set(d.ma, [...(giu.get(d.ma) ?? []), ten]);
  };
  don.forEach((d) => them({ ...d, ma: d.stt }, 'Đơn thư'));
  viec.forEach((v) => them({ ...v, ma: v.code }, 'Vụ việc'));
  an.forEach((a) => them({ ...a, ma: a.caseCode }, 'Vụ án'));

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
