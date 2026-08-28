import { chuanHoaBoCuc, BE_RONG_TOI_THIEU, BE_RONG_TOI_DA, SO_COT_TOI_DA } from './bo-cuc-cot.util';

/**
 * Bố cục cột người dùng tự chỉnh được lưu thành một khối JSON. Cột JSON không tự bảo vệ mình,
 * nên mọi thứ đi vào phải qua đây — nếu không, một payload méo sẽ nằm luôn trong cơ sở dữ
 * liệu và làm hỏng bảng của chính người ấy ở MỌI lần mở sau, mà không ai biết vì sao.
 *
 * Giữ đúng triết lý của `useColumnVisibility.ts:12-16` và `UserShortcut`: LƯU THỨ NGƯỜI DÙNG
 * ĐÃ ĐỔI, không lưu trạng thái đầy đủ. Cột vắng mặt = lấy theo khai báo trong mã.
 */
describe('Chuẩn hoá bố cục cột', () => {
  it('giữ nguyên bố cục hợp lệ', () => {
    const vao = { tomTat: { width: 320, hidden: false, position: 2 } };
    expect(chuanHoaBoCuc(vao)).toEqual(vao);
  });

  it('bỏ khoá rỗng — cột không có ghi đè nào thì không cần nằm trong khối', () => {
    expect(chuanHoaBoCuc({ a: {} })).toEqual({});
  });

  it('không phải object thì thành khối rỗng, không ném lỗi', () => {
    for (const v of [null, undefined, 'chuoi', 42, [1, 2]]) {
      expect(chuanHoaBoCuc(v)).toEqual({});
    }
  });

  describe('bề rộng', () => {
    /**
     * Chặn dưới là để cán bộ không kéo mất hẳn một cột rồi không tìm lại được. Chặn trên là để
     * một số vô lý không đẩy bảng rộng hàng vạn điểm ảnh và treo trình duyệt.
     */
    it('kẹp vào biên thay vì loại bỏ — kéo quá tay vẫn ra kết quả dùng được', () => {
      expect(chuanHoaBoCuc({ a: { width: 5 } })).toEqual({ a: { width: BE_RONG_TOI_THIEU } });
      expect(chuanHoaBoCuc({ a: { width: 99999 } })).toEqual({ a: { width: BE_RONG_TOI_DA } });
    });

    it('làm tròn số lẻ — điểm ảnh không có phần thập phân', () => {
      expect(chuanHoaBoCuc({ a: { width: 120.7 } })).toEqual({ a: { width: 121 } });
    });

    it('bề rộng không phải số thì bỏ hẳn khoá ấy, giữ các khoá còn lại', () => {
      expect(chuanHoaBoCuc({ a: { width: 'to', hidden: true } })).toEqual({ a: { hidden: true } });
      expect(chuanHoaBoCuc({ a: { width: NaN } })).toEqual({});
      expect(chuanHoaBoCuc({ a: { width: Infinity } })).toEqual({});
    });
  });

  describe('ẩn/hiện và thứ tự', () => {
    it('`hidden` phải đúng kiểu boolean, không nhận chuỗi', () => {
      expect(chuanHoaBoCuc({ a: { hidden: 'true' } })).toEqual({});
      expect(chuanHoaBoCuc({ a: { hidden: true } })).toEqual({ a: { hidden: true } });
      // `false` LÀ một ghi đè có nghĩa: người dùng bật lại một cột vốn ẩn mặc định.
      expect(chuanHoaBoCuc({ a: { hidden: false } })).toEqual({ a: { hidden: false } });
    });

    it('vị trí âm hoặc quá lớn bị bỏ', () => {
      expect(chuanHoaBoCuc({ a: { position: -1 } })).toEqual({});
      expect(chuanHoaBoCuc({ a: { position: 1000 } })).toEqual({});
      expect(chuanHoaBoCuc({ a: { position: 0 } })).toEqual({ a: { position: 0 } });
    });
  });

  describe('tên cột', () => {
    it('tên rỗng hoặc quá dài bị bỏ', () => {
      expect(chuanHoaBoCuc({ '': { width: 100 } })).toEqual({});
      expect(chuanHoaBoCuc({ ['x'.repeat(65)]: { width: 100 } })).toEqual({});
    });

    /** Chặn ký tự lạ để khối lưu không thành chỗ nhét dữ liệu tuỳ ý. */
    it('tên có ký tự ngoài chữ-số-gạch bị bỏ', () => {
      expect(chuanHoaBoCuc({ 'a b': { width: 100 } })).toEqual({});
      expect(chuanHoaBoCuc({ '<script>': { width: 100 } })).toEqual({});
      expect(chuanHoaBoCuc({ 'a.b-c_d1': { width: 100 } })).toEqual({ 'a.b-c_d1': { width: 100 } });
    });

    /**
     * `__proto__` đi vào một object literal sẽ làm hỏng nguyên mẫu — đúng lớp lỗi đã bắt ở
     * công thức tính (v0.68.0.0).
     */
    it('khoá nguyên mẫu bị bỏ', () => {
      // Dùng 100 chứ không phải 50: 50 nằm dưới ngưỡng nên bị kẹp lên 60, và ca kiểm sẽ đỏ vì
      // dữ liệu chọn sai chứ không phải vì khoá nguyên mẫu lọt qua.
      const ra = chuanHoaBoCuc(JSON.parse('{"__proto__":{"width":100},"a":{"width":100}}'));
      expect(ra).toEqual({ a: { width: 100 } });
      expect(({} as Record<string, unknown>)['width']).toBeUndefined();
    });
  });

  it('quá nhiều cột thì cắt, không từ chối cả khối', () => {
    const vao: Record<string, unknown> = {};
    for (let i = 0; i < SO_COT_TOI_DA + 20; i++) vao[`c${i}`] = { width: 100 };
    expect(Object.keys(chuanHoaBoCuc(vao))).toHaveLength(SO_COT_TOI_DA);
  });

  /** Chuẩn hoá hai lần ra cùng kết quả — nếu không, mỗi lần lưu lại làm dữ liệu trôi đi một ít. */
  it('chuẩn hoá lần hai không đổi gì', () => {
    const mot = chuanHoaBoCuc({ a: { width: 120.7 }, b: { hidden: true, position: 3 } });
    expect(chuanHoaBoCuc(mot)).toEqual(mot);
  });
});
