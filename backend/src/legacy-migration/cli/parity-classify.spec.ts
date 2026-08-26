import { cotChuaNoi, phanLoaiO, STATUS_CAN_COT, type DauVaoPhanLoai } from './parity-classify';

/**
 * Hai ca đầu là hai chỗ bộ sinh ma trận suy sai, tái dựng từ SỐ ĐO trên máy chạy ngày
 * 26/08/2026 — không phải từ mã. Bộ sinh cũ báo "đã có nhà" cho cả hai, trong khi 35.261 và
 * 15.039 hồ sơ đang kẹt ở `legacyRaw`.
 */
const nen = (p: Partial<DauVaoPhanLoai> = {}): DauVaoPhanLoai => ({
  field: 'x',
  targets: [],
  cotThat: new Map(),
  mapCol: null,
  laResolve: false,
  kieuHeCu: '',
  ...p,
});

describe('phanLoaiO — đích phải chứa nổi, lời khai phải có người đọc', () => {
  describe('cột ĐÚNG/SAI không phải là nhà của một field chữ', () => {
    const cot = new Map([['baoCaoBanGiamDoc', 'Boolean']]);
    const dau = nen({
      field: 'truong_hop_bao_cao_ban_giam_doc',
      kieuHeCu: 'text',
      targets: [{ column: 'baoCaoBanGiamDoc', inMetadata: false }],
      cotThat: cot,
    });

    it('KHÔNG được báo OK — 35.261 hồ sơ có chữ, cột một bit giữ không nổi', () => {
      expect(phanLoaiO(dau).status).not.toBe('OK');
    });

    it('phải rơi vào nhóm "cần cột" để cổng kiểm bắt được', () => {
      expect(STATUS_CAN_COT.has(phanLoaiO(dau).status)).toBe(true);
    });

    it('thêm cột chữ bên cạnh là đủ — không đòi bỏ cột ĐÚNG/SAI đi', () => {
      const kq = phanLoaiO({
        ...dau,
        targets: [
          { column: 'baoCaoBanGiamDoc', inMetadata: false },
          { column: 'baoCaoBanGiamDocText', inMetadata: false },
        ],
        cotThat: new Map([...cot, ['baoCaoBanGiamDocText', 'String']]),
      });
      expect(kq).toEqual({ status: 'OK', column: 'baoCaoBanGiamDocText' });
    });
  });

  describe('lời khai RESOLVE chỉ tính ở thực thể có người đọc', () => {
    it('không builder nào đọc → không được miễn, phải báo cần cột', () => {
      const kq = phanLoaiO(nen({ field: 'tinh_trang', laResolve: true, targets: [] }));
      expect(kq.status).toBe('NEEDS_COLUMN');
      expect(STATUS_CAN_COT.has(kq.status)).toBe(true);
    });

    /**
     * Đổ vào `metadata` KHÔNG phải là đã phân giải xong. `case/tinh_trang` đúng cảnh ấy: builder
     * chỉ đặt `metadata.tinhTrang` trong khi bảng `cases` đã có cột `tinhTrang` bỏ trống. Nhận
     * lời khai RESOLVE ở đây là ô rơi khỏi danh sách "cần cột" và không ai bù nữa.
     */
    it('chỉ đổ vào metadata thì chưa phải có nhà — phải báo METADATA_ONLY', () => {
      const kq = phanLoaiO(
        nen({
          field: 'tinh_trang',
          laResolve: true,
          targets: [{ column: 'metadata.tinhTrang', inMetadata: true }],
          cotThat: new Map([['tinhTrang', 'String']]),
        }),
      );
      expect(kq.status).toBe('METADATA_ONLY');
      expect(STATUS_CAN_COT.has(kq.status)).toBe(true);
    });

    /**
     * Khoá TRUNG GIAN vẫn tính là đã phân giải: `crimeChinhLegacyValue` không phải cột nào,
     * nó là thứ bộ nạp nhận rồi đổi thành `crimeChinhId`. Đo trên máy chạy 27/08/2026: 14.594
     * đơn thư có `crimeChinhId` so với 14.511 đơn có mã tội danh cũ.
     */
    it('đổ vào khoá trung gian (không phải cột) vẫn là RESOLVE', () => {
      const kq = phanLoaiO(
        nen({
          field: 'toi_danh_chinh_blhs2015',
          laResolve: true,
          targets: [{ column: 'crimeChinhLegacyValue', inMetadata: false }],
          cotThat: new Map([['crimeChinhId', 'String']]),
        }),
      );
      expect(kq.status).toBe('RESOLVE');
    });

    it('builder có đọc và đổ vào cột thật → giữ nguyên RESOLVE, kèm tên cột', () => {
      const kq = phanLoaiO(
        nen({
          field: 'tinh_trang',
          laResolve: true,
          targets: [{ column: 'tinhTrangHoSo', inMetadata: false }],
          cotThat: new Map([['tinhTrangHoSo', 'String']]),
        }),
      );
      expect(kq).toEqual({ status: 'RESOLVE', column: 'tinhTrangHoSo' });
    });
  });

  it('builder đổ vào metadata → METADATA_ONLY, không phải OK', () => {
    expect(
      phanLoaiO(nen({ targets: [{ column: 'metadata.abc', inMetadata: true }] })).status,
    ).toBe('METADATA_ONLY');
  });

  it('cột có sẵn nhưng builder chưa đọc → FIX_BUILDER', () => {
    expect(
      phanLoaiO(nen({ mapCol: 'ghiChu', cotThat: new Map([['ghiChu', 'String']]) })).status,
    ).toBe('FIX_BUILDER');
  });
});

describe('cotChuaNoi — chỉ kết luận lệch khi CÓ bằng chứng lệch', () => {
  it.each([
    ['String', 'text', true],
    ['String', 'number', true],
    ['Boolean', 'checkbox', true],
    ['Boolean', 'text', false],
    ['Boolean', 'select', false],
  ])('cột %s nhận field kiểu %s → %s', (cot, kieu, mong) => {
    expect(cotChuaNoi(cot, kieu)).toBe(mong);
  });

  /**
   * Bản đầu của luật này coi cả `text → DateTime` và `text → Int` là mất kiểu. Đo lại trên
   * bảng định nghĩa trường hệ cũ ngày 26/08/2026 thì hỏng: hệ cũ khai kiểu của Ô NHẬP chứ
   * không phải kiểu lưu, nên `ngay_viet_don`, `ngay_tiep_nhan_nguon_tin`, `ngay_phieu_chuyen`
   * đều mang kiểu `text` dù chứa mốc thời gian. Luật ấy báo động 6 cột ngày với 127.000 hồ sơ
   * hoàn toàn lành lặn.
   *
   * Đọc một chuỗi ra ngày là ĐỔI CÁCH BIỂU DIỄN của cùng một giá trị. Xét một chuỗi ra
   * đúng/sai là VỨT nội dung. Chỉ chuyện thứ hai mới là mất dữ liệu.
   */
  it.each([
    ['DateTime', 'text'],
    ['Int', 'text'],
  ])('cột %s nhận field khai kiểu %s vẫn hợp lệ — hệ cũ khai mọi ô là text', (cot, kieu) => {
    expect(cotChuaNoi(cot, kieu)).toBe(true);
  });

  /**
   * `tinh_trang` là field lõi, không nằm trong bảng định nghĩa trường tuỳ chỉnh nên không có
   * kiểu khai. Suy ra "lệch" từ chỗ trống ấy sẽ đẻ ra báo động giả hàng loạt, và một cổng
   * kiểm kêu oan là một cổng kiểm sắp bị tắt.
   */
  it('kiểu hệ cũ không biết thì không kết luận là lệch', () => {
    expect(cotChuaNoi('Boolean', '')).toBe(true);
    expect(cotChuaNoi('Int', '   ')).toBe(true);
  });
});
