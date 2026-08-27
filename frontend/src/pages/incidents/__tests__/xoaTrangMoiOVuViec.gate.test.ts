import { describe, it, expect } from 'vitest';
import nguonBuilder from '../buildIncidentPayload.ts?raw';
import nguonTrang from '../IncidentFormPage.tsx?raw';
import { buildIncidentPayload } from '../buildIncidentPayload';
import { INITIAL_INCIDENT_FORM, type IncidentFormData } from '../incident-form.types';

/**
 * CỔNG: mọi ô cán bộ nhìn thấy trên form Vụ việc, khi xoá trắng rồi bấm Lưu, phải gửi `null`.
 *
 * Máy chủ chỉ ghi những khoá CÓ MẶT trong lời gọi (`dto.X !== undefined`, xem
 * `incidents.service.ts`). Ô rỗng bị bỏ khỏi thân lời gọi thì thao tác xoá báo thành công mà
 * giá trị cũ vẫn nằm nguyên dưới cơ sở dữ liệu — cán bộ mở lại thấy thứ mình vừa xoá.
 *
 * Bản trước dùng `const s = (v) => v || undefined` cho ~45 ô, tức TOÀN BỘ form Vụ việc không
 * xoá trắng được ô nào. Cùng lớp lỗi đã vá cho Vụ án (#245) và Đơn thư.
 */

/** Đọc thẳng từ mã nguồn để cổng không phải liệt kê tay — thêm ô mới là tự được phủ. */
const O_GUI_NULL: string[] = Array.from(
  nguonBuilder.matchAll(/(\w+): oHeCu\(formData\.(\w+)\)/g),
).map((m) => m[1]);

function payload(sua: Partial<IncidentFormData>): Record<string, unknown> {
  return buildIncidentPayload({ ...INITIAL_INCIDENT_FORM, ...sua } as IncidentFormData, {
    isEditMode: true,
    metaState: {},
    parityState: {},
  });
}

describe('Xoá trắng một ô Vụ việc rồi lưu — giá trị cũ phải mất theo', () => {
  it('đọc được danh sách ô từ mã nguồn, không rơi về rỗng khi biểu thức hỏng', () => {
    expect(O_GUI_NULL.length).toBeGreaterThanOrEqual(40);
  });

  it.each(O_GUI_NULL)('ô "%s" xoá trắng thì gửi null, không bỏ khoá', (khoa) => {
    const p = payload({ [khoa]: '' } as Partial<IncidentFormData>);
    expect(p).toHaveProperty(khoa);
    expect(p[khoa]).toBeNull();
  });

  /**
   * Hai ô chọn-nhiều: bỏ hết lựa chọn là một hành động, không phải "không nhắc tới". Bỏ khoá
   * thì lựa chọn cũ ở lại và cán bộ không gỡ được lý do đã chọn nhầm.
   */
  it.each(['lyDoKhongKhoiTo', 'lyDoTamDinhChiVuViec'])(
    'ô chọn-nhiều "%s" bỏ hết lựa chọn thì gửi mảng rỗng, không bỏ khoá',
    (khoa) => {
      const p = payload({ [khoa]: [] } as unknown as Partial<IncidentFormData>);
      expect(p).toHaveProperty(khoa);
      expect(p[khoa]).toEqual([]);
    },
  );

  /** Ô tích: `false` là một lựa chọn. Bỏ khoá thì bỏ tích xong lưu vẫn còn tích. */
  it('ô tích bỏ tích thì gửi false, không bỏ khoá', () => {
    const p = payload({ laCongNgheCaoVV: false });
    expect(p).toHaveProperty('laCongNgheCaoVV');
    expect(p.laCongNgheCaoVV).toBe(false);
  });
});

describe('Trang Vụ việc phải dùng hàm dựng payload đã vá', () => {
  /**
   * Ca kiểm này canh chỗ hỏng THẬT. Hàm `buildIncidentPayload` có đúng cách mấy mà trang vẫn
   * tự dựng thân lời gọi bằng `|| undefined` thì cán bộ vẫn không xoá được ô nào.
   */
  it('IncidentFormPage không còn tự dựng payload bằng "|| undefined"', () => {
    const con = Array.from(nguonTrang.matchAll(/formData\.(\w+) \|\| undefined/g)).map((m) => m[1]);
    expect(con).toEqual([]);
  });

  it('IncidentFormPage không còn hàm rút gọn "v || undefined"', () => {
    expect(nguonTrang).not.toContain('(v: string) => v || undefined');
  });

  it('IncidentFormPage gọi buildIncidentPayload', () => {
    expect(nguonTrang).toContain('buildIncidentPayload(formData');
  });
});

/**
 * CHIỀU NGƯỢC — bài học #245, và là điều kiện để bản vá trên KHÔNG thành thảm hoạ.
 *
 * Gửi `null` cho một ô mà form không nạp lại được từ máy chủ nghĩa là: mở hồ sơ ra, ô hiện
 * trống (vì không nạp), bấm Lưu, và giá trị thật dưới cơ sở dữ liệu bị xoá sạch. Mỗi lần lưu
 * là một lần mất thêm dữ liệu, không thông báo gì.
 *
 * Nên mọi khoá gửi lên đều phải có một dòng đọc tương ứng trong khối nạp chi tiết.
 */
describe('Mọi khoá gửi lên đều nạp lại được từ chi tiết máy chủ', () => {
  const khoiNap = nguonTrang.slice(
    nguonTrang.indexOf('setFormData({'),
    nguonTrang.indexOf('setRecordUpdatedAt('),
  );

  it('tìm được khối nạp trong mã nguồn', () => {
    expect(khoiNap.length).toBeGreaterThan(500);
  });

  it.each(O_GUI_NULL)('ô "%s" có dòng nạp lại trong khối nạp chi tiết', (khoa) => {
    expect(khoiNap).toContain(`${khoa}:`);
  });
});
