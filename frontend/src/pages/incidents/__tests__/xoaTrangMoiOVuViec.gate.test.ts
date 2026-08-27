import { describe, it, expect } from 'vitest';
import nguonBuilder from '../buildIncidentPayload.ts?raw';
import nguonTrang from '../IncidentFormPage.tsx?raw';
import nguonNap from '../mergeIncidentApiToFormData.ts?raw';
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

/**
 * MỌI ô lấy giá trị từ `formData`, không chỉ nhóm đi qua `oHeCu`.
 *
 * Phép kiểm "nạp lại từ đúng khoá" phải phủ cả ô chọn-nhiều và ô tích. Lọc theo `oHeCu` thì
 * bốn ô `lyDoKhongKhoiTo`, `lyDoTamDinhChiVuViec`, `xacDinhVuViecTamDung`, `laCongNgheCaoVV`
 * rơi ra ngoài — mà đó cũng là những ô, nếu nạp sai khoá, sẽ bị ghi đè ngay lần lưu đầu.
 */
const MOI_O_TU_FORM: string[] = Array.from(
  new Set(
    Array.from(nguonBuilder.matchAll(/(\w+):[^,\n]*formData\.(\w+)/g)).map((m) => m[1]),
  ),
);

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
 * Bản đầu của cổng này chỉ hỏi "trong khối nạp có dòng nào mang tên ô không" — và nó ĐỂ LỌT
 * đúng ca nguy hiểm nhất: `lyDoTamDinhChi` có dòng nạp, nhưng dòng ấy đọc `d.lyDoTamDinhChi`
 * trong khi cột thật máy chủ trả về là `lyDoTamDinhChiText`. Ô luôn rỗng, nên chỉ cần bấm Lưu
 * là xoá mất ghi chú tạm đình chỉ.
 *
 * Nay cổng hỏi đúng câu: dòng nạp ấy đọc KHOÁ NÀO của máy chủ, và khoá đó có phải khoá đúng
 * không. Tên ô khác tên cột thì phải KHAI ra ở `O_DOI_TEN` — khai sai hoặc quên khai đều đỏ.
 */

/**
 * Ô mà tên trên form khác tên cột máy chủ trả về.
 *
 * Mỗi dòng là một cái bẫy đã được tháo. Thêm ô đổi tên mà không khai ở đây thì cổng đỏ ngay,
 * và đó là chủ đích: đổi tên im lặng chính là cách `lyDoTamDinhChi` lọt qua.
 */
const O_DOI_TEN: Readonly<Record<string, string>> = {
  lyDoTamDinhChi: 'lyDoTamDinhChiText',
};

describe('Mọi khoá gửi lên đều nạp lại được từ ĐÚNG khoá của máy chủ', () => {
  // Đọc TỆP NẠP, không đọc thân trang: sau khi tách module, biểu thức cũ cắt một khối không
  // còn tồn tại và trả chuỗi rỗng — cổng xanh vì không có gì để kiểm.
  const khoiNap = nguonNap.slice(nguonNap.indexOf('return {'));

  /** Khoá máy chủ mà dòng nạp của một ô thật sự đọc (`d.<khoá>`), hoặc `null` nếu không có dòng. */
  const khoaMayChuCua = (o: string): string | null => {
    const dong = new RegExp(`\\n\\s*${o}:((?:[^\\n]|\\n(?!\\s*\\w+:))*)`).exec(khoiNap);
    if (!dong) return null;
    const doc = /d\.(\w+)/.exec(dong[1]);
    return doc ? doc[1] : null;
  };

  it('tìm được khối nạp trong mã nguồn', () => {
    expect(khoiNap.length).toBeGreaterThan(500);
  });

  it('phủ được cả ô chọn-nhiều và ô tích, không chỉ nhóm oHeCu', () => {
    expect(MOI_O_TU_FORM.length).toBeGreaterThan(O_GUI_NULL.length);
    for (const o of ['lyDoKhongKhoiTo', 'lyDoTamDinhChiVuViec', 'xacDinhVuViecTamDung', 'laCongNgheCaoVV']) {
      expect(MOI_O_TU_FORM).toContain(o);
    }
  });

  it.each(MOI_O_TU_FORM)('ô "%s" có dòng nạp lại trong khối nạp chi tiết', (khoa) => {
    expect(khoaMayChuCua(khoa)).not.toBeNull();
  });

  it.each(MOI_O_TU_FORM)('ô "%s" nạp từ ĐÚNG khoá máy chủ', (khoa) => {
    expect(khoaMayChuCua(khoa)).toBe(O_DOI_TEN[khoa] ?? khoa);
  });

  /**
   * Bảng khai đổi tên phải THẬT. Khai một ô không đổi tên là mở sẵn cửa cho lần sau khai bừa.
   */
  it.each(Object.entries(O_DOI_TEN))('ô đổi tên "%s" thật sự đọc "%s"', (o, cot) => {
    expect(o).not.toBe(cot);
    expect(khoiNap).toContain(`d.${cot}`);
  });
});
