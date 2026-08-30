import { suyTrangThai, bocNgay, MAU_TRANG_THAI } from './suy-trang-thai-he-cu';

/**
 * Bộ suy trạng thái từ chữ hệ cũ.
 *
 * Mọi câu dùng làm ca kiểm dưới đây đều lấy TỪ DỮ LIỆU THẬT trên máy thật ngày 30/08/2026, kèm
 * số bản ghi đo được — không câu nào do em nghĩ ra. Bịa một câu mẫu rồi kiểm nó là kiểm chính
 * trí tưởng tượng của mình.
 */
describe('suyTrangThai — câu thật từ hệ cũ', () => {
  const THAT: Array<[string, string, number]> = [
    ['trả đơn', 'TRA_DON', 257],
    ['tđc giải quyết (bct6/2022)', 'TAM_DINH_CHI', 201],
    ['không khởi tố vụ án', 'KHONG_KHOI_TO', 111],
    ['không ktva (bct6/2022)', 'KHONG_KHOI_TO', 77],
    ['tạm đình chỉ (t11/2022)', 'TAM_DINH_CHI', 63],
    ['lưu đơn 08/5/2024 (bct6/2024)', 'LUU_DON', 55],
    ['đã giải quyết', 'DA_GIAI_QUYET', 79],
    ['chuyển pc03 catp hcm (m hùng)', 'DA_CHUYEN_DON_VI', 93],
    ['nhập tố giác 1373-07/5/2019 (nghiêm)', 'DA_NHAP_VU_KHAC', 87],
    ['khởi tố vụ án', 'DA_KHOI_TO', 29],
    ['ktva 821-01 ngày 20/9/2021 (rà soát t8/2022)', 'DA_KHOI_TO', 20],
    ['phân loại dân sự', 'PHAN_LOAI_DAN_SU', 39],
    ['hướng dẫn khởi kiện số 5566/hd-pc02-đ5', 'HUONG_DAN', 4],
  ];

  it.each(THAT)('“%s” → %s', (chu, mong) => {
    const k = suyTrangThai(chu);
    expect({ chu, tt: k.trangThai, ly: k.ly }).toEqual({ chu, tt: mong, ly: 'RO_RANG' });
  });

  /**
   * Phủ định phải THẮNG khẳng định. "không khởi tố" chứa "khởi tố"; xét sai thứ tự thì 1.165 hồ
   * sơ KHÔNG khởi tố bị ghi thành ĐÃ khởi tố — đảo ngược hoàn toàn ý nghĩa pháp lý.
   */
  it('phủ định thắng khẳng định — "không ktva" KHÔNG ra ĐÃ KHỞI TỐ', () => {
    for (const c of ['không khởi tố vụ án', 'không ktva (bct6/2022)', 'ko khởi tố', 'không khởi tố va']) {
      expect({ c, tt: suyTrangThai(c).trangThai }).toEqual({ c, tt: 'KHONG_KHOI_TO' });
    }
  });

  /**
   * `ktva` là viết tắt của KHỞI TỐ VỤ ÁN, không dấu. Bỏ sót nó là bỏ sót 2.570 hồ sơ — chính vì
   * bộ mẫu đầu tiên chỉ tìm "khởi tố" có dấu mà độ phủ tụt từ 74% xuống 53%.
   */
  it('bắt được viết tắt không dấu ktva', () => {
    expect(suyTrangThai('ktva 12/10/2023').trangThai).toBe('DA_KHOI_TO');
    expect(suyTrangThai('ktva').trangThai).toBe('DA_KHOI_TO');
  });
});

describe('suyTrangThai — KHÔNG đoán khi không chắc', () => {
  /**
   * Ca này TRƯỚC ĐÂY chốt "khớp nhiều mẫu → KHÔNG suy, để người xem quyết". Lượt đầu đúng: thà
   * bỏ 501 hồ sơ còn hơn khai sai tư cách pháp lý.
   *
   * Anh chốt làm toàn bộ, xác nhận sau. Nên nay CÓ chọn, theo thứ tự ưu tiên xếp từ "câu nào mô
   * tả số phận của CHÍNH hồ sơ này" — nhập/chuyển nói hồ sơ đi đâu, còn khởi tố thường nói về
   * vụ án sinh ra sau đó. Nhưng `ly` vẫn là NHAP_NHANG, và danh sách xuất ra ĐÁNH DẤU riêng
   * nhóm này để người xác nhận soi kỹ đúng chỗ đáng ngờ nhất.
   */
  it('khớp NHIỀU mẫu → chọn theo ưu tiên NHƯNG vẫn khai là nhiều nghĩa', () => {
    const k = suyTrangThai('nhập vv 276/05-2019 bình tân chuyển 30/05/2019, lên tố giác 15/07/2019');
    expect(k.ly).toBe('NHAP_NHANG');
    // "nhập" mô tả số phận của chính hồ sơ này, "chuyển" chỉ là một mốc trên đường đi.
    expect(k.trangThai).toBe('DA_NHAP_VU_KHAC');
    expect(k.khop.length).toBeGreaterThan(1);
  });

  /** Trạng thái ĐANG LÀM không bao giờ thắng một kết quả thật. */
  it('"đang xử lý" luôn thua một kết quả thật trong cùng câu', () => {
    const k = suyTrangThai('đã tiếp nhận, ra qđ phân công; sau đó trả đơn');
    expect(k.trangThai).toBe('TRA_DON');
  });

  it('khớp KHÔNG mẫu nào → KHONG_KHOP, để nguyên', () => {
    for (const c of ['abcxyz', 'không', '.']) {
      const k = suyTrangThai(c);
      expect({ c, tt: k.trangThai }).toEqual({ c, tt: null });
    }
  });

  it('ô rỗng → RONG, không phải KHONG_KHOP', () => {
    expect(suyTrangThai('').ly).toBe('RONG');
    expect(suyTrangThai(null).ly).toBe('RONG');
    expect(suyTrangThai(undefined).ly).toBe('RONG');
  });
});

describe('bocNgay — ngày viết tay trong câu', () => {
  it('bóc được ngày ở giữa câu', () => {
    expect(bocNgay('lưu đơn 08/5/2024 (bct6/2024)')).toEqual(new Date(2024, 4, 8));
    expect(bocNgay('ktva 821-01 ngày 20/9/2021')).toEqual(new Date(2021, 8, 20));
  });

  it('câu không ghi ngày → null, không đoán', () => {
    expect(bocNgay('trả đơn')).toBeNull();
    expect(bocNgay('không khởi tố vụ án')).toBeNull();
  });

  /**
   * "31/4/2024" không tồn tại. `new Date(2024, 3, 31)` tự cuộn sang 1/5 — im lặng biến một ngày
   * gõ sai thành một ngày có thật ở tháng khác, và hồ sơ nhảy sang kỳ báo cáo khác.
   */
  it('ngày không tồn tại → null, KHÔNG cuộn sang tháng sau', () => {
    expect(bocNgay('lưu đơn 31/4/2024')).toBeNull();
    expect(bocNgay('lưu đơn 30/2/2024')).toBeNull();
  });

  it('năm ngoài 1900–2100 → null', () => {
    expect(bocNgay('lưu đơn 08/5/3024')).toBeNull();
    expect(bocNgay('lưu đơn 08/5/0225')).toBeNull();
  });

  it('tháng và ngày ngoài dải → null', () => {
    expect(bocNgay('x 08/13/2024')).toBeNull();
    expect(bocNgay('x 32/5/2024')).toBeNull();
  });
});

describe('Bộ mẫu', () => {
  it('mỗi mẫu khai ít nhất một chuỗi để khớp', () => {
    const rong = MAU_TRANG_THAI.filter((m) => m.co.length === 0).map((m) => m.trangThai);
    expect(rong).toEqual([]);
  });

  /**
   * Chỉ MỘT mẫu được phép mang loại trừ, và đó là mẫu khởi tố — vì chỉ nó có phủ định trùng
   * chuỗi. Thêm loại trừ ở chỗ khác là dấu hiệu bộ mẫu đang chồng chéo.
   */
  /**
   * Chuỗi loại trừ chỉ có ở hai mẫu, và cả hai đều vì cùng một lý do: phủ định trùng chuỗi với
   * khẳng định ("không khởi tố" chứa "khởi tố", "tạm đình chỉ" chứa "đình chỉ"). Thêm loại trừ ở
   * chỗ khác là dấu hiệu bộ mẫu đang chồng chéo.
   */
  it('chỉ hai mẫu mang chuỗi loại trừ, và đều vì phủ định trùng chuỗi', () => {
    const coTru = MAU_TRANG_THAI.filter((m) => (m.tru ?? []).length > 0).map((m) => m.trangThai);
    expect(coTru.sort()).toEqual(['DA_KHOI_TO', 'DINH_CHI']);
  });

  /**
   * Ca sinh ra từ chính cái bẫy ấy: "tạm đình chỉ" CHỨA "đình chỉ". Thiếu loại trừ thì 1.839 hồ
   * sơ tạm dừng bị đọc thành đóng hẳn — hai hậu quả pháp lý khác nhau.
   */
  it('"tạm đình chỉ" KHÔNG bị đọc thành "đình chỉ"', () => {
    expect(suyTrangThai('tạm đình chỉ (t11/2022)').trangThai).toBe('TAM_DINH_CHI');
    expect(suyTrangThai('tđc giải quyết').trangThai).toBe('TAM_DINH_CHI');
    expect(suyTrangThai('đình chỉ giải quyết ngày 5/3/2021').trangThai).toBe('DINH_CHI');
  });
});
