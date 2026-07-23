import { extractNgayKhoiTo, extractNgayXayRa, extractChuyenVuAn, extractDiaDiem, extractAll } from './text-extract';

/**
 * Dữ liệu test là HAI đoạn tóm tắt THẬT trong dump, do anh chỉ ra khi phát hiện
 * các ô nghiệp vụ bị bỏ trống.
 */
const VU_LU_XIAO_FANG =
  'Khoảng 21 giờ 30 phút ngày 08/10/2016, chị Lu Xiao Fang đi bộ cùng bạn đến ngã ba Tân Thọ-Lạc Long Quân, ' +
  'phường 8, quận Tân Bình thì bị 1 thanh niên chạy xe gắn máy giật chiếc túi xách của chị Lu Xiao Fang ' +
  '(bên trong có 1.200 Nhân dân tệ, 1 ĐTDĐ, 300USD, 02 passport và giấy tờ tùy thân) rồi tăng ga bỏ chạy. ' +
  'Ngày 27/10/2016, Công an quận Tân Bình khởi tố vụ án "Cướp giật tài sản", ngày 31/10/2016, VKSND quận ' +
  'Tân Bình ra Quyết định chuyển vụ án đến Cơ quan CSĐT-Công an TP.Hồ Chí Minh.';

const VU_HANSEN =
  'Khoảng 4 giờ 30 phút ngày 03/12/2016, Hans Christian Ehm Hansen đi xe máy cùng bạn đến trước số 290B/5 ' +
  'Dương Bá Trạc, P1 Q8 thì dừng xe để sử dụng ĐTDĐ Iphone 5 SE . Lúc này Nguyễn Văn Phước chạy xe máy áp sát ' +
  'giật chiếc ĐTDĐ của Hansen. Ngày 05/12/2016, CAQ8 khởi tố vụ án, khởi tố bị can và tạm giam Phước về tội ' +
  '"Cướp giật tài sản" thời hạn đến ngày 03/3/2017.Ngày 27/12/2016, VKSQ8 ra quyết định chuyển vụ án đến cấp TP.';

describe('extractNgayKhoiTo — ngày đứng ngay trước cụm "khởi tố vụ án"', () => {
  it('vụ Lu Xiao Fang → 27/10/2016 (KHÔNG lấy nhầm 08/10 là ngày xảy ra)', () => {
    const d = extractNgayKhoiTo(VU_LU_XIAO_FANG).date!;
    expect([d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()]).toEqual([27, 10, 2016]);
  });

  it('vụ Hansen → 05/12/2016', () => {
    const d = extractNgayKhoiTo(VU_HANSEN).date!;
    expect([d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()]).toEqual([5, 12, 2016]);
  });

  it('kèm đoạn trích gốc để người dùng đối chiếu', () => {
    expect(extractNgayKhoiTo(VU_LU_XIAO_FANG).trace).toContain('27/10/2016');
  });

  it('không có cụm "khởi tố vụ án" → không đoán bừa', () => {
    expect(extractNgayKhoiTo('Ngày 01/01/2020 tiếp nhận đơn của công dân.').date).toBeUndefined();
  });
});

describe('extractNgayXayRa — ngày đầu tiên của đoạn', () => {
  it('vụ Lu Xiao Fang → 08/10/2016', () => {
    const d = extractNgayXayRa(VU_LU_XIAO_FANG).date!;
    expect([d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()]).toEqual([8, 10, 2016]);
  });

  it('vụ Hansen → 03/12/2016', () => {
    const d = extractNgayXayRa(VU_HANSEN).date!;
    expect([d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()]).toEqual([3, 12, 2016]);
  });

  it('ngày tràn 31/02 → bỏ, không tạo ngày rác', () => {
    expect(extractNgayXayRa('Ngày 31/02/2020 xảy ra vụ việc.').date).toBeUndefined();
  });

  it('năm ngoài dải hợp lý → bỏ', () => {
    expect(extractNgayXayRa('Ngày 05/12/1800 …').date).toBeUndefined();
  });
});

describe('extractChuyenVuAn', () => {
  it('vụ Lu Xiao Fang → nêu rõ chuyển đi đâu', () => {
    expect(extractChuyenVuAn(VU_LU_XIAO_FANG).noiDung).toContain('Cơ quan CSĐT');
  });

  it('vụ Hansen → chuyển đến cấp TP', () => {
    expect(extractChuyenVuAn(VU_HANSEN).noiDung).toContain('cấp TP');
  });

  it('không nhắc tới chuyển vụ án → để trống', () => {
    expect(extractChuyenVuAn('Đã khởi tố và điều tra theo thẩm quyền.').noiDung).toBeUndefined();
  });
});

describe('extractDiaDiem', () => {
  it('lấy được nơi xảy ra, không nuốt cả mệnh đề sau', () => {
    const noi = extractDiaDiem('Vào lúc 8 giờ tại số 12 Lê Lợi, phường 1, quận 3 thì bị cướp.').noi!;
    expect(noi).toContain('Lê Lợi');
    expect(noi).not.toContain('bị cướp');
  });
});

describe('extractAll', () => {
  it('gộp đủ các mục và luôn kèm dấu vết', () => {
    const r = extractAll(VU_LU_XIAO_FANG);
    expect(r.ngayKhoiTo).toBeDefined();
    expect(r.ngayXayRa).toBeDefined();
    expect(r.chuyenVuAn).toBeDefined();
    expect(Object.keys(r.dauVet).length).toBeGreaterThanOrEqual(3);
  });

  it('đoạn quá ngắn → không trích gì, không ném lỗi', () => {
    expect(extractAll('abc').dauVet).toEqual({});
  });

  it('tiêu đề rút ra luôn ngắn gọn', () => {
    expect(extractAll(VU_HANSEN).tieuDe!.length).toBeLessThanOrEqual(121);
  });
});
