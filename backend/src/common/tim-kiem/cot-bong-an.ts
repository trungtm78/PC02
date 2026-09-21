import { KHAI_TIM_KIEM } from './khai';
import { cotBongCua, type KhaiThucThe } from './sinh/sinh-tim-kiem';

/**
 * Cột bóng tìm kiếm PHẢI ẩn khỏi mọi đường đọc trả về cho người dùng.
 *
 * Prisma trả MỌI cột vô hướng khi lời gọi không khai `select` — và đường xem chi tiết dùng
 * `include` chứ không `select`, nên cột ghép `tim_kiem_bd` đi thẳng ra API. Nó là bản nối của
 * hàng chục cột, gồm cả số CCCD và số điện thoại: không thêm quyền gì cho người đọc (các cột
 * ấy vốn đã nằm trong bản trả về), nhưng là một khối dữ liệu không ai hỏi, phình payload từng
 * dòng, và sau đợt mở rộng cột ghép còn phình gấp đôi.
 *
 * Chặn ở MỘT chỗ — `omit` toàn cục của PrismaClient — thay vì thêm `select` ở từng lời gọi.
 * Thêm `select` ở n chỗ là n cơ hội quên, và cái quên ấy im lặng.
 *
 * Danh sách suy từ `KHAI_TIM_KIEM`, nên khai thêm một cột bóng là nó tự vào đây. Cổng
 * `cot-bong-khong-lot-payload.gate.spec.ts` đối chiếu với `schema.prisma`: còn một trường `*Bd`
 * nào ngoài danh sách là ĐỎ.
 */
function cotBongCuaKhai(khai: KhaiThucThe): string[] {
  const ra = new Set<string>(['timKiemBd']);
  for (const t of khai.truong) {
    if (t.kieu === 'chu' && t.cot) ra.add(cotBongCua(t.cot).field);
  }
  for (const c of khai.cotBongPhu ?? []) ra.add(cotBongCua(c).field);
  return [...ra];
}

/** `Petition` → `petition`: khoá model trong cấu hình `omit` của Prisma. */
const khoaModel = (model: string) => model[0].toLowerCase() + model.slice(1);

export const OMIT_COT_BONG: Record<string, Record<string, true>> =
  Object.fromEntries(
    KHAI_TIM_KIEM.map((k) => [
      khoaModel(k.model),
      Object.fromEntries(cotBongCuaKhai(k).map((f) => [f, true as const])),
    ]),
  );
