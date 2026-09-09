import * as fs from 'fs';
import * as path from 'path';

import { MAU_HE_CU, bienCuaMauHeCu, thuMucMauHeCu } from './seed-legacy-templates';

/**
 * CỔNG: thêm thực thể cho một mẫu KHÔNG được làm mẫu ấy điền kém đi.
 *
 * Từ 09/09/2026 một mẫu có mặt ở nhiều thực thể (5.227 hồ sơ trước đó không in được vì mẫu chỉ
 * khai một thực thể). Nhưng "mời in được" chưa đủ: nếu catalog của thực thể kia thiếu khoá thì
 * cán bộ mở popup, thấy mẫu, bấm xuất, và nhận tờ giấy thiếu ô. Hỏng LẶNG LẼ — tệ hơn là không
 * có mẫu, vì không có gì báo.
 *
 * Cổng so BỘ Ô GÕ TAY giữa các thực thể của cùng một mẫu, chứ không đòi mọi ô đều tự điền: hai
 * mẫu hệ cũ chưa từng in (`so_dang_ky_bao_chua`, `an_tra_bo_sung_mau`) có những ô vốn dĩ cán bộ
 * phải gõ (`ho_ten_ls`, `vks_tra`) — không nguồn dữ liệu nào cấp được.
 *
 * Cổng này đã bắt đúng hai lỗ hổng khi thêm thực thể: `dia-chi-bi-hai` thiếu ở Vụ việc và
 * `toi-danh-ban-dau` thiếu ở Đơn thư — cả hai cột đều CÓ dữ liệu thật (715 vụ việc ·
 * 15.253/47.169 đơn thư), tức ô trống chứ không phải ô không có gì để điền.
 */
describe('thêm thực thể không làm mẫu điền kém đi', () => {
  it.each(MAU_HE_CU.filter((m) => m.entityTypes.length > 1).map((m) => [m.code, m] as const))(
    '%s — bộ ô gõ tay GIỐNG NHAU ở mọi thực thể',
    (_ma, m) => {
      const buf = fs.readFileSync(path.join(thuMucMauHeCu(), m.file));
      const chinh = m.entityTypes[0];
      const goTayChinh = bienCuaMauHeCu(buf, chinh)
        .filter((v) => v.source !== 'auto')
        .map((v) => v.name)
        .sort();

      for (const tt of m.entityTypes.slice(1)) {
        const goTay = bienCuaMauHeCu(buf, tt)
          .filter((v) => v.source !== 'auto')
          .map((v) => v.name)
          .sort();

        expect({ thucThe: tt, goTay }).toEqual({ thucThe: tt, goTay: goTayChinh });
      }
    },
  );
});
