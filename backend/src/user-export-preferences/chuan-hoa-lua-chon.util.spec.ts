import {
  chuanHoaLuaChon,
  CHE_DO_MAC_DINH,
  SO_MAU_TOI_DA,
  type LuaChonInChungTu,
} from './chuan-hoa-lua-chon.util';

/**
 * Chuẩn hoá lựa chọn in chứng từ đã lưu.
 *
 * Cùng triết lý `bo-cuc-cot.util.ts`: sai kiểu thì BỎ, quá tay thì CẮT — không từ chối cả khối.
 * Một hàng méo (lưu trước khi có cổng, hoặc sửa tay trong CSDL) mà làm popup ném lỗi thì cán bộ
 * mất hẳn đường in, và không có cách nào tự thoát.
 */
describe('chuanHoaLuaChon', () => {
  it('giữ nguyên lựa chọn hợp lệ', () => {
    const ra = chuanHoaLuaChon({ templateIds: ['t1', 't2'], mode: 'merged' });
    expect(ra).toEqual<LuaChonInChungTu>({ templateIds: ['t1', 't2'], mode: 'merged' });
  });

  it.each([[null], [undefined], ['chuỗi'], [123], [[]]])(
    'không phải object (%p) → lựa chọn rỗng mặc định',
    (tho) => {
      expect(chuanHoaLuaChon(tho)).toEqual({ templateIds: [], mode: CHE_DO_MAC_DINH });
    },
  );

  describe('định dạng xuất', () => {
    it.each([['separate'], ['merged'], ['zip']])('nhận `%s`', (che) => {
      expect(chuanHoaLuaChon({ mode: che }).mode).toBe(che);
    });

    /**
     * Chế độ lạ trong CSDL không được lọt ra popup: nó sẽ khiến không nút nào được chọn, và
     * cán bộ nhìn thấy một popup không có định dạng nào — bấm Xuất ra hành vi không ai định
     * nghĩa. Rơi về mặc định là thứ luôn dùng được.
     */
    it.each([['zip-bomb'], [''], [null], [42], [{}]])('chế độ lạ (%p) → về mặc định', (che) => {
      expect(chuanHoaLuaChon({ mode: che }).mode).toBe(CHE_DO_MAC_DINH);
    });
  });

  describe('danh sách mẫu', () => {
    it('không phải mảng thì thành rỗng', () => {
      expect(chuanHoaLuaChon({ templateIds: 't1' }).templateIds).toEqual([]);
    });

    it('bỏ phần tử không phải chuỗi và chuỗi rỗng', () => {
      expect(
        chuanHoaLuaChon({ templateIds: ['t1', 1, null, '', '  ', 't2'] }).templateIds,
      ).toEqual(['t1', 't2']);
    });

    it('cắt khoảng trắng thừa quanh mã mẫu', () => {
      expect(chuanHoaLuaChon({ templateIds: [' t1 '] }).templateIds).toEqual(['t1']);
    });

    /** Trùng lặp làm popup tích một mẫu nhiều lần vô nghĩa và phình bản ghi. */
    it('khử trùng, giữ thứ tự lần xuất hiện đầu', () => {
      expect(chuanHoaLuaChon({ templateIds: ['t2', 't1', 't2'] }).templateIds).toEqual(['t2', 't1']);
    });

    /** Mã mẫu là cuid; chuỗi dài hay ký tự lạ là dấu hiệu payload bịa, không phải mã thật. */
    it.each([['có khoảng trắng giữa'], ['x'.repeat(65)], ['<script>'], ['a/b']])(
      'bỏ mã mẫu không hợp lệ (%p)',
      (ma) => {
        expect(chuanHoaLuaChon({ templateIds: ['t1', ma] }).templateIds).toEqual(['t1']);
      },
    );

    it('CẮT khi quá nhiều mẫu, không từ chối cả khối', () => {
      const nhieu = Array.from({ length: SO_MAU_TOI_DA + 20 }, (_, i) => `t${i}`);
      const ra = chuanHoaLuaChon({ templateIds: nhieu, mode: 'zip' });
      expect(ra.templateIds).toHaveLength(SO_MAU_TOI_DA);
      // Phần hợp lệ vẫn giữ được, kể cả chế độ.
      expect(ra.mode).toBe('zip');
    });
  });

  /** Chạy lần hai trên kết quả lần một phải ra y hệt — nếu không, mỗi lượt đọc lại méo thêm. */
  it('chuẩn hoá hai lần cho cùng kết quả', () => {
    const mot = chuanHoaLuaChon({ templateIds: ['t1', 't1', 2], mode: 'lạ' });
    expect(chuanHoaLuaChon(mot)).toEqual(mot);
  });

  /** Không để khoá nguyên mẫu lọt vào đối tượng trả về. */
  it('không nhận khoá nguyên mẫu từ payload', () => {
    const ra = chuanHoaLuaChon(JSON.parse('{"__proto__":{"x":1},"templateIds":["t1"]}'));
    expect((ra as unknown as Record<string, unknown>)['x']).toBeUndefined();
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
    expect(ra.templateIds).toEqual(['t1']);
  });
});
