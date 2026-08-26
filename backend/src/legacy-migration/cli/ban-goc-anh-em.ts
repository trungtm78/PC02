/**
 * Bản gốc hệ cũ của những hồ sơ KHÔNG giữ `legacyRaw` riêng.
 *
 * Một số hồ sơ di trú là VỎ LIÊN KẾT: bản thô được định tuyến sang thực thể khác cùng khoá
 * nguồn, nên `legacyRaw` của chính nó để trống. Dữ kiện vẫn còn — chỉ nằm ở thực thể anh em.
 *
 * Đo trên máy thật 26/08/2026: 95 đơn thư như vậy. Bộ dọn số 0 đã biết đường lấy từ anh em,
 * còn bộ bù cột thì chưa — nên đúng 95 hồ sơ ấy không được bù cột nào. Tách ra dùng chung
 * thay vì chép lần thứ hai: hai bản sao sẽ trôi khỏi nhau đúng lúc không ai để ý.
 */
import { Prisma } from '@prisma/client';
import type { Entity } from '../field-parity.def';

/** Chỉ phần giao diện thật sự dùng tới — để dựng bản giả trong ca kiểm mà không cần CSDL. */
export interface BangDoc {
  findMany(arg: unknown): Promise<unknown[]>;
}
export interface KhoBang {
  petition: BangDoc;
  incident: BangDoc;
  case: BangDoc;
}

const THU_TU: readonly Entity[] = ['case', 'incident', 'petition'];

/**
 * Tra bản gốc cho các hồ sơ của `entity` đang thiếu `legacyRaw`.
 *
 * Trả về bảng tra theo `legacySourceId`. Không có hồ sơ nào thiếu thì trả bảng rỗng và
 * KHÔNG hỏi CSDL lần nào.
 */
export async function banGocTuAnhEm(
  kho: KhoBang,
  entity: Entity,
  themDieuKien: Record<string, unknown> = {},
): Promise<Map<string, Record<string, unknown>>> {
  const thieu = (await kho[entity].findMany({
    where: {
      legacyRaw: { equals: Prisma.DbNull },
      legacySourceId: { not: null },
      ...themDieuKien,
    },
    select: { legacySourceId: true },
  })) as { legacySourceId: string | null }[];

  const khoa = thieu.map((p) => p.legacySourceId).filter((k): k is string => Boolean(k));
  const map = new Map<string, Record<string, unknown>>();
  if (khoa.length === 0) return map;

  for (const anhEm of THU_TU) {
    if (anhEm === entity) continue;
    const rows = (await kho[anhEm].findMany({
      where: { legacySourceId: { in: khoa } },
      select: { legacySourceId: true, legacyRaw: true },
    })) as { legacySourceId: string | null; legacyRaw: unknown }[];
    for (const r of rows) {
      if (r.legacySourceId && r.legacyRaw && !map.has(r.legacySourceId)) {
        map.set(r.legacySourceId, r.legacyRaw as Record<string, unknown>);
      }
    }
  }
  return map;
}
