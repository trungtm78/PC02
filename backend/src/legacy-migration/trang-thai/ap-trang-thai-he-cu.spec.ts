import { PrismaClient } from '@prisma/client';
import { chay } from './ap-trang-thai-he-cu';

/**
 * Luật GÁN trạng thái — phần có hậu quả pháp lý, nên mỗi luật một ca kiểm riêng.
 *
 * Bộ suy chữ đã có ca kiểm riêng ở `suy-trang-thai-he-cu.spec.ts`. Tệp này chốt những quyết định
 * mà một câu chữ đúng vẫn có thể dẫn tới một hành động sai.
 */

interface HoSoGia {
  id: string;
  status: string;
  legacyId: number | null;
  legacyRaw: Record<string, unknown>;
  stt?: string;
  code?: string;
  caseCode?: string;
  ngayGiaiQuyet: Date | null;
}

function tao(chu: string, phu: Partial<HoSoGia> = {}): HoSoGia {
  return {
    id: 'r1',
    status: 'MOI_TIEP_NHAN',
    legacyId: 111,
    legacyRaw: { ket_qua_xu_ly_giai_quyet_khac: chu, stt: '80', nam: '2019' },
    stt: '2019-80',
    ngayGiaiQuyet: null,
    ...phu,
  };
}

function prismaGia(don: HoSoGia[] = [], vv: HoSoGia[] = [], va: HoSoGia[] = []) {
  const daGhi: Array<{ bang: string; id: string; data: Record<string, unknown> }> = [];
  const soGhi = { n: 0 };
  const p = {
    petition: {
      findMany: async () => don,
      update: async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        daGhi.push({ bang: 'petition', id: a.where.id, data: a.data });
        return {};
      },
    },
    incident: {
      findMany: async () => vv,
      update: async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        daGhi.push({ bang: 'incident', id: a.where.id, data: a.data });
        return {};
      },
    },
    case: {
      findMany: async () => va,
      update: async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        daGhi.push({ bang: 'case', id: a.where.id, data: a.data });
        return {};
      },
    },
    legacyStatusInference: {
      createMany: async (a: { data: unknown[] }) => {
        soGhi.n += a.data.length;
        return { count: a.data.length };
      },
    },
  } as unknown as PrismaClient;
  return { p, daGhi, soGhi };
}

describe('chay — chạy khô KHÔNG được đụng dữ liệu', () => {
  it('không có --apply thì không một lệnh ghi nào chạm hồ sơ', async () => {
    const { p, daGhi } = prismaGia([tao('trả đơn')]);
    const kq = await chay(p, false);
    expect(daGhi).toEqual([]);
    expect(kq.ap).toHaveLength(1);
    expect(kq.daApDung).toBe(false);
  });

  /** Sổ vẫn được ghi khi chạy khô — đó chính là danh sách để soi trước khi quyết. */
  it('chạy khô VẪN ghi sổ, để có danh sách mà soi', async () => {
    const { p, soGhi } = prismaGia([tao('trả đơn')]);
    await chay(p, false);
    expect(soGhi.n).toBe(1);
  });
});

describe('chay — hai nhóm hàm ý hồ sơ khác: NAY GÁN, và nối liên kết khi khớp', () => {
  /**
   * Hai ca ở đây TRƯỚC ĐÂY chốt điều ngược lại: "khởi tố" và "nhập vụ khác" thì KHÔNG gán, vì
   * chúng hàm ý một hồ sơ ở bảng khác và gán trạng thái mà không dựng liên kết là để hệ thống
   * khẳng định thứ không kiểm chứng được.
   *
   * Anh chốt làm toàn bộ, xác nhận sau. Nên nay gán — nhưng giữ nguyên phần lo lắng ấy bằng cách
   * khác: bóc tham chiếu từ chính câu chữ, và ĐÁNH DẤU vào sổ dòng nào có liên kết, dòng nào
   * không. Để cả 3.614 hồ sơ đứng ở "mới tiếp nhận" cũng là một lời khẳng định sai, chỉ khác là
   * nó im lặng hơn.
   */
  it('ĐÃ KHỞI TỐ nay gán, đơn thư → DA_CHUYEN_VU_AN', async () => {
    const { p, daGhi } = prismaGia([tao('ktva 821-01 ngày 20/9/2021')]);
    const kq = await chay(p, true);
    expect(daGhi[0].data.status).toBe('DA_CHUYEN_VU_AN');
    expect(kq.deLai).toEqual([]);
  });

  it('ĐÃ NHẬP VỤ KHÁC nay gán, đơn thư → DA_NHAP_HO_SO_KHAC', async () => {
    const { p, daGhi } = prismaGia([tao('nhập tố giác 1373-07/5/2019')]);
    await chay(p, true);
    expect(daGhi[0].data.status).toBe('DA_NHAP_HO_SO_KHAC');
  });

  /**
   * Hệ cũ viết `1373-07/5/2019` — số thứ tự, gạch, rồi ngày. Ghép `<năm>-<stt>` ra đúng dạng mã
   * hồ sơ của hệ mới. Đo được 776/5.093 câu có dạng này.
   */
  it('bóc được mã hồ sơ được nhắc tới trong câu', async () => {
    const { p } = prismaGia([tao('nhập tố giác 1373-07/5/2019 (nghiêm)')]);
    const kq = await chay(p, false);
    expect(kq.ap[0].maLienKet).toBe('2019-1373');
  });

  it('câu không có tham chiếu thì để rỗng, không đoán', async () => {
    const { p } = prismaGia([tao('nhập vụ án lừa đảo')]);
    const kq = await chay(p, false);
    expect(kq.ap[0].maLienKet).toBeNull();
  });

  /** Câu nhiều nghĩa phải TỰ KHAI, để người xác nhận soi kỹ đúng nhóm đáng ngờ nhất. */
  it('câu nhiều nghĩa được đánh dấu riêng', async () => {
    const { p } = prismaGia([tao('nhập vv 276/05-2019 bình tân chuyển 30/05/2019')]);
    const kq = await chay(p, false);
    expect(kq.ap[0].nhieuNghia).toBe(true);
    expect(kq.ap[0].trangThaiMoi).toBe('DA_NHAP_HO_SO_KHAC');
  });

  it('câu một nghĩa thì KHÔNG bị đánh dấu — đừng làm loãng cờ cảnh báo', async () => {
    const { p } = prismaGia([tao('trả đơn')]);
    const kq = await chay(p, false);
    expect(kq.ap[0].nhieuNghia).toBe(false);
  });
});

describe('chay — không ép vào giá trị gần đúng', () => {
  /**
   * `CaseStatus` không có "không khởi tố". Ép nó thành `DINH_CHI` hay `DA_KET_LUAN` là nói sai
   * với người đọc báo cáo — hai thứ khác nhau về hậu quả pháp lý.
   */
  /**
   * `CaseStatus` vẫn không có "không khởi tố" — một vụ án đã khởi tố rồi thì không thể "không
   * khởi tố". Ép nó thành `DINH_CHI` là nói sai: hai thứ khác nhau về hậu quả pháp lý.
   */
  it('vụ án + KHÔNG KHỞI TỐ → vẫn để lại, vì CaseStatus không có trạng thái ấy', async () => {
    const { p, daGhi } = prismaGia([], [], [tao('không khởi tố vụ án', { status: 'TIEP_NHAN' })]);
    const kq = await chay(p, true);
    expect(daGhi).toEqual([]);
    expect(kq.deLai[0].lyDo).toMatch(/không có trạng thái tương ứng/);
  });

  it('đơn thư + TRẢ ĐƠN → DA_TRA_DON, KHÔNG phải DA_GIAI_QUYET', async () => {
    const { p, daGhi } = prismaGia([tao('trả đơn')]);
    await chay(p, true);
    expect(daGhi[0].data.status).toBe('DA_TRA_DON');
  });
});

describe('chay — không đè lên việc người thật đã làm', () => {
  /**
   * Hồ sơ đã rời khỏi trạng thái ban đầu nghĩa là cán bộ ĐÃ xử lý trên hệ mới. Phán đoán từ chữ
   * hệ cũ không được đè lên đó — dữ liệu người thật vừa nhập luôn thắng một phép suy.
   */
  it('hồ sơ đã đổi trạng thái trên hệ mới thì KHÔNG đụng', async () => {
    const { p, daGhi } = prismaGia([tao('trả đơn', { status: 'DANG_XU_LY' })]);
    const kq = await chay(p, true);
    expect(daGhi).toEqual([]);
    expect(kq.ap).toEqual([]);
  });

  it('hồ sơ còn nguyên sơ thì mới gán', async () => {
    const { p, daGhi } = prismaGia([tao('trả đơn', { status: 'MOI_TIEP_NHAN' })]);
    await chay(p, true);
    expect(daGhi).toHaveLength(1);
  });
});

describe('chay — mốc giải quyết chỉ đặt khi câu chữ CÓ ngày', () => {
  it('câu có ngày → đặt mốc đúng ngày ấy', async () => {
    const { p, daGhi } = prismaGia([tao('lưu đơn 08/5/2024 (bct6/2024)')]);
    await chay(p, true);
    expect(daGhi[0].data.ngayGiaiQuyet).toEqual(new Date(2024, 4, 8));
  });

  /** Không có ngày thì để rỗng. Bịa `now()` cho hồ sơ đóng từ 2019 là đúng thứ cả đợt này đi sửa. */
  it('câu KHÔNG có ngày → không đặt mốc, không bịa hôm nay', async () => {
    const { p, daGhi } = prismaGia([tao('trả đơn')]);
    await chay(p, true);
    expect(daGhi[0].data.ngayGiaiQuyet).toBeUndefined();
  });

  /** Tạm đình chỉ KHÔNG phải kết thúc, nên dù câu có ngày cũng không đóng mốc giải quyết. */
  it('TẠM ĐÌNH CHỈ có ngày cũng KHÔNG đóng mốc', async () => {
    const { p, daGhi } = prismaGia([tao('tạm đình chỉ 08/5/2024')]);
    await chay(p, true);
    expect(daGhi[0].data.status).toBe('TAM_DINH_CHI');
    expect(daGhi[0].data.ngayGiaiQuyet).toBeUndefined();
  });
});

describe('chay — sổ mang đủ khoá để khách hàng đối chiếu', () => {
  it('mỗi dòng có STT và NĂM hệ cũ, mã hệ mới, trạng thái cũ/mới và nguyên văn', async () => {
    const { p } = prismaGia([tao('trả đơn')]);
    const kq = await chay(p, false);
    expect(kq.ap[0]).toMatchObject({
      sttCu: '80',
      namCu: '2019',
      maHoSo: '2019-80',
      legacyId: 111,
      trangThaiCu: 'MOI_TIEP_NHAN',
      trangThaiMoi: 'DA_TRA_DON',
      nguyenVan: 'trả đơn',
    });
  });

  /**
   * `stt` và `nam` nằm trong JSON hệ cũ dưới dạng SỐ, không phải chuỗi. Bản đầu của hàm đọc chỉ
   * nhận `string` nên trả `null` cho cả 46.580 hồ sơ — danh sách xuất ra vẫn "chạy đúng", chỉ là
   * HAI CỘT QUAN TRỌNG NHẤT với người xác nhận thì trống trơn.
   *
   * Chạy khô trên máy thật mới lộ ra; không ca kiểm nào bắt được vì bộ dữ liệu mẫu của em dùng
   * chuỗi.
   */
  it('đọc được STT và NĂM khi chúng là SỐ trong JSON hệ cũ', async () => {
    const { p } = prismaGia([
      tao('trả đơn', {
        legacyRaw: { ket_qua_xu_ly_giai_quyet_khac: 'trả đơn', stt: 80, nam: 2019 },
      }),
    ]);
    const kq = await chay(p, false);
    expect(kq.ap[0].sttCu).toBe('80');
    expect(kq.ap[0].namCu).toBe('2019');
  });

  it('hồ sơ không có ô kết quả thì bỏ qua hẳn, không vào sổ', async () => {
    const { p, soGhi } = prismaGia([tao('   ')]);
    const kq = await chay(p, false);
    expect(kq.ap).toEqual([]);
    expect(soGhi.n).toBe(0);
  });
});
