import { BadRequestException } from '@nestjs/common';
import type { DataScope } from '../../auth/services/unit-scope.service';
import { assertParentInScope } from './scope-filter.util';

/** Chỉ cần đúng các trường mà luật phạm vi đọc. */
interface CongVuAn {
  case: {
    findFirst(args: {
      where: { id: string; deletedAt: null };
      select: { id: true; assignedTeamId: true; investigatorId: true };
    }): Promise<{
      id: string;
      assignedTeamId: string | null;
      investigatorId: string | null;
    } | null>;
  };
}

/**
 * Nạp vụ án CHA rồi kiểm phạm vi GHI của nó — một chỗ cho mọi đường TẠO hoặc CHUYỂN bản ghi con (kết luận,
 * ĐTBS, luật sư, đối tượng, ủy thác, đề xuất).
 *
 * Vì sao cần: sửa/xoá bản ghi con đã kiểm vụ án cha, còn TẠO thì không nhận phạm vi — cán bộ gửi `caseId` của
 * vụ án tổ khác là gắn được bản ghi vào đó (tồn đọng PR #217/#220, sửa 19/09/2026). Điều phối viên cũng không
 * được bỏ qua: ngoài phạm vi chỉ XEM + PHÂN CÔNG (quyết định anh 19/09/2026).
 *
 * Vụ án không có (hoặc đã xoá) → 400 nói rõ, không để khoá ngoại nổ thành lỗi mơ hồ.
 */
export async function kiemVuAnChaDeGhi(
  prisma: CongVuAn,
  caseId: string,
  dataScope: DataScope | null | undefined,
) {
  const vuAn = await prisma.case.findFirst({
    where: { id: caseId, deletedAt: null },
    select: { id: true, assignedTeamId: true, investigatorId: true },
  });
  if (!vuAn)
    throw new BadRequestException(`Vụ án không tồn tại (id: ${caseId})`);
  assertParentInScope(vuAn, dataScope, 'write');
  return vuAn;
}
