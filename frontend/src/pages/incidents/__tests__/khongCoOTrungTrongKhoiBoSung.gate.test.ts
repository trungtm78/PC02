import { describe, it, expect } from 'vitest';
import nguonTrang from '../IncidentFormPage.tsx?raw';
import nguonBinding from '@/features/incidents/legacy-form-binding.ts?raw';

/**
 * CỔNG: khối "Bổ sung hệ mới" KHÔNG được chứa ô mà bố cục hệ cũ đã có.
 *
 * Hai ô cùng ghi một cột là mất dữ liệu trong đúng một lần lưu: cán bộ gõ ở tab, mở khối bổ
 * sung ra sửa việc khác, bấm Lưu — và ô trong khối (đang giữ giá trị cũ) đè lên thứ vừa gõ.
 * Không thông báo gì.
 *
 * Panel "Thông tin nghiệp vụ bổ sung" đã có cổng riêng (`khongDungHaiOChoMotCot`), nhưng cổng
 * ấy chỉ soi panel parity. Khối bổ sung của chính trang thì không ai gác — và nó chứa tới 29
 * ô trùng khi form 10 tab vừa dựng xong.
 *
 * Đọc mã nguồn dạng văn bản: cái cần gác là hai danh sách có giao nhau không, mà dựng cây
 * React lên thì chỉ thấy tab đang mở.
 */
const KHOI_BO_SUNG = nguonTrang.slice(
  nguonTrang.indexOf('tabId="info"'),
  nguonTrang.indexOf('</LegacyTabBody>'),
);

/** Ô mà bố cục hệ cũ đã dựng — đọc từ bảng buộc, không liệt kê tay. */
const O_BO_CUC_HE_CU: ReadonlySet<string> = new Set(
  Array.from(
    nguonBinding
      .slice(
        nguonBinding.indexOf('const CO_COT_RIENG'),
        nguonBinding.indexOf('/** Đích lưu của một ô'),
      )
      .matchAll(/:\s*'(\w+)'/g),
  ).map((m) => m[1]),
);

const O_TRONG_KHOI = Array.from(
  new Set(
    Array.from(KHOI_BO_SUNG.matchAll(/(?:data-)?test[Ii]d="field-(\w+)"/g)).map((m) => m[1]),
  ),
);

describe('Khối "Bổ sung hệ mới" không dựng lại ô mà tab đã có', () => {
  it('đọc được cả hai danh sách, không rơi về rỗng', () => {
    expect(O_BO_CUC_HE_CU.size).toBeGreaterThan(40);
    expect(O_TRONG_KHOI.length).toBeGreaterThan(5);
  });

  it('không ô nào trong khối bổ sung trùng với ô của bố cục hệ cũ', () => {
    const trung = O_TRONG_KHOI.filter((o) => O_BO_CUC_HE_CU.has(o));
    expect(trung).toEqual([]);
  });

  /**
   * Gỡ ô trùng KHÔNG được gỡ nhầm tính năng. Lần đầu chạy bộ gỡ tự động, nó nuốt luôn nút
   * "Khởi tố thành vụ án" vì nút ấy đứng trong cùng một khối với một ô trùng tên.
   */
  it('nút "Khởi tố thành vụ án" vẫn còn', () => {
    expect(nguonTrang).toContain('Khởi tố thành vụ án');
    expect(nguonTrang).toContain('caseProvenance=FROM_INCIDENT');
  });
});
