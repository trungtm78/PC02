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

describe('chay — hai nhóm CỐ Ý để lại', () => {
  /**
   * "Khởi tố" hàm ý có một VỤ ÁN ở bảng khác. Gán trạng thái mà không dựng liên kết là để hệ
   * thống nói "đã khởi tố" mà không chỉ ra được vụ án nào — một câu khẳng định không kiểm chứng
   * được, đúng lớp lỗi mà cả đợt soát này đi vá.
   */
  it('ĐÃ KHỞI TỐ không gán — để lại kèm lý do', async () => {
    const { p, daGhi } = prismaGia([tao('ktva 821-01 ngày 20/9/2021')]);
    const kq = await chay(p, true);
    expect(daGhi).toEqual([]);
    expect(kq.ap).toEqual([]);
    expect(kq.deLai).toHaveLength(1);
    expect(kq.deLai[0].lyDo).toMatch(/liên kết/);
  });

  it('ĐÃ NHẬP VỤ KHÁC cũng để lại — cùng lý do', async () => {
    const { p, daGhi } = prismaGia([tao('nhập tố giác 1373-07/5/2019')]);
    const kq = await chay(p, true);
    expect(daGhi).toEqual([]);
    expect(kq.deLai[0].trangThai).toBe('DA_NHAP_VU_KHAC');
  });
});

describe('chay — không ép vào giá trị gần đúng', () => {
  /**
   * `CaseStatus` không có "không khởi tố". Ép nó thành `DINH_CHI` hay `DA_KET_LUAN` là nói sai
   * với người đọc báo cáo — hai thứ khác nhau về hậu quả pháp lý.
   */
  it('vụ án + KHÔNG KHỞI TỐ → để lại, vì CaseStatus không có trạng thái ấy', async () => {
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

  it('hồ sơ không có ô kết quả thì bỏ qua hẳn, không vào sổ', async () => {
    const { p, soGhi } = prismaGia([tao('   ')]);
    const kq = await chay(p, false);
    expect(kq.ap).toEqual([]);
    expect(soGhi.n).toBe(0);
  });
});
