import { ForbiddenException } from '@nestjs/common';
import type { DataScope } from '../../auth/services/unit-scope.service';

/**
 * Phạm vi theo tổ của báo cáo TĐC — một chỗ cho phần tính báo cáo và bản nháp (soát IDOR 19/09/2026).
 *
 * `null` = không giới hạn. Quản trị (không có phạm vi) không giới hạn; điều phối viên ĐỌC không giới hạn nhưng GHI
 * theo tổ ghi được (ngoài phạm vi chỉ xem + phân công — quyết định anh 19/09/2026); cán bộ đọc các tổ đọc được, ghi
 * các tổ ghi được. Đọc từ `dataScope` (do interceptor nạp từ CSDL), KHÔNG từ `teamIds` trong JWT — JWT cũ không
 * phản ánh việc vừa rút cán bộ khỏi tổ.
 */
export function phamViTo(
  dataScope: DataScope | null | undefined,
  thaoTac: 'read' | 'write',
): string[] | null {
  if (!dataScope) return null;
  if (thaoTac === 'read')
    return dataScope.canDispatch ? null : dataScope.teamIds;
  return dataScope.writableTeamIds ?? [];
}

/**
 * Các tổ đưa vào báo cáo. Không gửi tổ nào: người không giới hạn → toàn đơn vị (mảng rỗng); cán bộ → các tổ của
 * mình (trước đây rỗng = toàn đơn vị cho mọi người). Xin tổ ngoài phạm vi, hoặc cán bộ không thuộc tổ nào → 403.
 */
export function chonToBaoCao(
  yeuCau: string[],
  phamVi: string[] | null,
  thaoTac: 'read' | 'write' = 'read',
): string[] {
  if (phamVi === null) return yeuCau;
  if (phamVi.length === 0) {
    throw new ForbiddenException(
      thaoTac === 'write'
        ? 'Bạn không có tổ nào được quyền ghi nên không lập được bản nháp báo cáo tạm đình chỉ'
        : 'Bạn chưa thuộc tổ nào nên không xem được báo cáo tạm đình chỉ theo tổ',
    );
  }
  if (yeuCau.length === 0) return phamVi;
  const ngoai = yeuCau.filter((t) => !phamVi.includes(t));
  if (ngoai.length > 0) {
    throw new ForbiddenException(
      'Bạn không có quyền với một số tổ trong báo cáo này',
    );
  }
  return yeuCau;
}

/**
 * Bản nháp xem/ghi được khi: không giới hạn, HOẶC chính mình tạo, HOẶC mọi tổ của bản nháp nằm trong phạm vi. Bản
 * nháp toàn đơn vị (`teamIds` rỗng) chứa số liệu mọi tổ nên chỉ người không giới hạn và người tạo mới thấy.
 */
export function duocXemBanNhap(
  banNhap: { teamIds: string[]; createdById: string },
  userId: string,
  phamVi: string[] | null,
): boolean {
  if (phamVi === null) return true;
  if (banNhap.createdById === userId) return true;
  return (
    banNhap.teamIds.length > 0 &&
    banNhap.teamIds.every((t) => phamVi.includes(t))
  );
}
