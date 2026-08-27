import { describe, it, expect } from "vitest";
import { buildCreateCasePayload } from "../buildCreateCasePayload";
import { mergeCaseApiToFormData } from "../mergeCaseApiToFormData";
import { INITIAL_FORM_DATA, type CaseFormData } from "../types";
import { LEGACY_FORM_LAYOUT, type LegacyTabId } from "@/features/cases/legacy-form-layout.def";

/**
 * Ô hiện trên màn hình mà không lưu được là kiểu hỏng tệ nhất: cán bộ gõ, bấm Lưu, hệ thống
 * báo thành công, dữ liệu biến mất. Hai chiều đều phải chốt — gửi lên và đọc về.
 */

const DAY_DU: Partial<CaseFormData> = {
  caseTitle: "Vụ án thử",
  caseProvenance: "DIRECT_DISCOVERY",
  ngayXayRa: "2026-08-01",
  noiXayRaPhuongXa: "Phường Bến Nghé",
  phanLoaiNguonTinBanDau: "vu_an",
  baoCaoBanGiamDoc: "Báo cáo Ban Giám đốc ngày 12/8",
  soQDPhanCongNguonTin: "12/QĐ-PC02",
  ngayQDPhanCongNguonTin: "2026-08-02",
  soQDKhongKhoiTo: "05/QĐ-KKT",
  ngayQDKhongKhoiTo: "2026-08-03",
  canCuKhongKhoiTo: "Điều 157 khoản 2 BLTTHS",
  lyDoKhongKhoiTo: ["khong_co_su_viec"],
  chuyenVuViecDonViKhac: "CV 88 ngày 04/8",
  nhapVaoVuViecSo: "2026-1122",
  phanLoaiDanSu: "TB 09 ngày 05/8",
  vuViecTamDungTruoc2015: true,
  soQDTamDinhChiNguonTin: "07/QĐ-TĐC",
  ngayQDTamDinhChiNguonTin: "2026-08-05",
  canCuTamDinhChiNguonTin: "Điều 148 BLTTHS",
  lyDoTamDinhChiNguonTin: ["chua_co_giam_dinh"],
  ngayHetThoiHieuVuViec: "2031-08-05",
  khacPhucLyDoTDCVuViec: "BB trao đổi VKS số 12",
  tienDoKhacPhucTDCVuViec: "Đang chờ kết quả giám định",
  soPhucHoiNguonTin: "02/QĐ-PH",
  ngayPhucHoiNguonTin: "2026-08-20",
  vatChungMoTa: "01 điện thoại iPhone 13",
  lenhNhapKho: "PN 33 ngày 06/8",
  noiLuuTruBaoQuan: "Kho vật chứng PC02",
  toiDanhChinhKhoiToId: "crime-174",
  soHoSoCu: "1234",
  diaChiCungCap: "34 Nguyễn Huệ",
};

function payload(extra: Partial<CaseFormData> = {}) {
  return buildCreateCasePayload({ ...INITIAL_FORM_DATA, ...DAY_DU, ...extra }) as Record<string, unknown>;
}

describe("Gửi ô hệ cũ lên máy chủ", () => {
  it.each(
    Object.keys(DAY_DU).filter((k) => k !== "caseTitle" && k !== "caseProvenance" && k !== "baoCaoBanGiamDoc"),
  )('ô "%s" nằm ở cấp trên cùng của payload, không chôn trong metadata', (key) => {
    const p = payload();
    expect(p[key]).toBeDefined();
  });

  it('ô chữ "Trường hợp báo cáo Ban Giám đốc" gửi cả nội dung, không chỉ gửi CÓ/KHÔNG', () => {
    const p = payload();
    // Cột `baoCaoBanGiamDoc` là Boolean (di trú suy từ chữ), nhưng hệ cũ nhập tự do và
    // 34.931 hồ sơ đang có chữ trong đó. Mất chữ là mất chỉ đạo của Ban Giám đốc.
    expect(p.baoCaoBanGiamDocText).toBe("Báo cáo Ban Giám đốc ngày 12/8");
    expect(p.baoCaoBanGiamDoc).toBe(true);
  });

  /**
   * Ô để trống chạm vào HAI cột khác nhau, và hai cột ấy có hai yêu cầu ngược chiều.
   *
   * Cột `baoCaoBanGiamDoc` là `Boolean?`: gửi `false` mỗi lần lưu sẽ biến NULL ("chưa xác
   * định") thành `false` cho mọi hồ sơ chưa kịp bù cột chữ — tự tay xoá thông tin mà không
   * ai yêu cầu. Nên ô trống thì KHÔNG nhắc tới cột này.
   *
   * Cột `baoCaoBanGiamDocText` là ô CHỮ cán bộ gõ. Ô chữ mà xoá không được thì thao tác xoá
   * báo thành công rồi mở lại vẫn thấy nội dung cũ. Nên ô trống phải gửi `null`.
   */
  it("ô báo cáo để trống: cột đúng/sai giữ nguyên, cột chữ được xoá", () => {
    const p = payload({ baoCaoBanGiamDoc: "" });
    expect(p.baoCaoBanGiamDoc).toBeUndefined();
    expect(p.baoCaoBanGiamDocText).toBeNull();
  });

  /**
   * Mã hồ sơ KHÔNG gửi lên: ô ấy là số hiệu tự sinh (DocNumberPreviewField chế độ AUTO),
   * cán bộ không nhập tay. Gửi lên chỉ mở đường cho xung đột mã trùng mà không đổi được gì
   * trên màn hình. DTO cũng cố ý không khai `caseCode` — xem legacy-form-parity.dto.spec.ts.
   */
  it("mã hồ sơ KHÔNG gửi lên — đó là số hiệu tự sinh, không phải ô nhập tay", () => {
    const p = payload({ caseCode: "2026-9999" });
    expect(p.caseCode).toBeUndefined();
  });

  it("số thứ tự thụ lý hệ cũ không còn bị bỏ rơi khi lưu", () => {
    expect(payload().soHoSoCu).toBe("1234");
  });

  /**
   * Lưới an toàn: ĐIỀN KÍN mọi ô trên cả 10 tab rồi kiểm không ô nào rơi giữa đường.
   *
   * Dữ liệu thử dựng THẲNG TỪ đặc tả bố cục, nên thêm ô mới vào đặc tả mà quên nối payload
   * là ca kiểm đỏ ngay — thay vì đợi cán bộ báo mất dữ liệu vài tuần sau.
   */
  it("điền kín mọi ô của đặc tả rồi lưu — không ô nào rơi giữa đường", () => {
    const form: Record<string, unknown> = { ...INITIAL_FORM_DATA, ...DAY_DU };
    const stat: Record<string, unknown> = { ...INITIAL_FORM_DATA.statistic };
    const oCanKiem: { field: string; isStat: boolean }[] = [];

    for (const tabId of Object.keys(LEGACY_FORM_LAYOUT) as LegacyTabId[]) {
      for (const item of LEGACY_FORM_LAYOUT[tabId]) {
        const f = item.field;
        const isStat = f.startsWith("statistic.");
        const key = isStat ? f.slice("statistic.".length) : f;
        const giaTri =
          item.kind === "date"
            ? "2026-08-15"
            : item.kind === "toggle"
              ? true
              : item.kind === "multiselect"
                ? [item.options?.[0]?.value ?? "x"]
                : item.kind === "number"
                  ? "7"
                  : `giá trị ${key}`;
        if (isStat) stat[key] = giaTri;
        else form[key] = giaTri;
        oCanKiem.push({ field: key, isStat });
      }
    }
    form.statistic = stat;

    const p = buildCreateCasePayload(form as unknown as CaseFormData) as Record<string, unknown>;
    const meta = (p.metadata ?? {}) as Record<string, unknown>;
    const statOut = (p.statistic ?? {}) as Record<string, unknown>;

    // Vài ô mang tên khác ở lớp máy chủ vì cột đã có sẵn từ trước. Khai tường minh ở đây
    // thay vì nới lỏng phép kiểm — nới lỏng thì ô mất thật cũng lọt.
    const TEN_O_MAY_CHU: Record<string, string> = {
      // 27/08/2026: ô này nay ghi `donViGiaiQuyet`, không còn ghi `unit`. `unit` là ĐƠN VỊ
      // TIẾP NHẬN — một khái niệm khác — và nó có 0 bản ghi ở cả hai bảng, trong khi bộ
      // di trú đổ dữ liệu thật vào `donViGiaiQuyet` (46.642 đơn thư, 3.286 vụ án).
      supervisingUnit: "donViGiaiQuyet",
      description: "moTaChiTiet",
      ngayTiepNhanNguonTin: "ngayTiepNhan",
      utdt_thoiHanUyThac: "thoiHanUyThac",
      baoCaoBanGiamDoc: "baoCaoBanGiamDocText",
    };

    const thieu = oCanKiem
      .filter(({ field, isStat }) => {
        if (isStat) return statOut[field] === undefined;
        const k = TEN_O_MAY_CHU[field] ?? field;
        return p[k] === undefined && meta[k] === undefined && meta[field] === undefined;
      })
      .map(({ field }) => field);

    expect(Array.from(new Set(thieu))).toEqual([]);
  });
});

describe("Xoá trắng một ô rồi lưu — giá trị cũ phải mất theo", () => {
  /**
   * Máy chủ chỉ ghi những khoá CÓ MẶT trong lời gọi. Nếu ô rỗng được bỏ khỏi payload thì
   * xoá trắng rồi bấm Lưu sẽ báo thành công trong khi giá trị cũ vẫn nằm nguyên dưới cơ sở
   * dữ liệu — cán bộ mở lại thấy thứ mình vừa xoá.
   */
  it.each([
    "phanLoaiNguonTinBanDau",
    "soQDPhanCongNguonTin",
    "vatChungMoTa",
    "toiDanhChinhKhoiToId",
    "khacPhucLyDoTDCVuViec",
    "ngayXayRa",
    "soHoSoCu",
  ])('ô "%s" xoá trắng thì gửi null, không bỏ khoá', (key) => {
    const p = payload({ [key]: "" } as Partial<CaseFormData>);
    expect(p).toHaveProperty(key);
    expect(p[key]).toBeNull();
  });

  it("ô ngày tiếp nhận nguồn tin xoá trắng cũng gửi null", () => {
    const p = payload({ ngayTiepNhanNguonTin: "" });
    expect(p).toHaveProperty("ngayTiepNhan");
    expect(p.ngayTiepNhan).toBeNull();
  });
});

describe("Ủy thác điều tra dùng CHUNG ô với tab Thông tin", () => {
  /**
   * Cột `ngayTiepNhan` và `loaiThongTin` chỉ có MỘT chỗ cho mỗi hồ sơ. Trước đây tab Ủy
   * thác giữ ô riêng (`utdt_ngayTiepNhan`, `utdt_loaiThongTin`) nên hai ô cùng ghi một cột
   * và ô nào lưu sau thì thắng.
   */
  it("ô riêng của tab Ủy thác không còn ghi đè ô chủ", () => {
    const p = buildCreateCasePayload({
      ...INITIAL_FORM_DATA,
      caseTitle: "Vụ án thử",
      caseProvenance: "UY_THAC_DIEU_TRA",
      utdt_donViGiao: "PC01",
      ngayTiepNhanNguonTin: "2026-08-01",
      loaiThongTin: "Tố giác",
      utdt_ngayTiepNhan: "2020-01-01",
      utdt_loaiThongTin: "Giá trị cũ",
    }) as Record<string, unknown>;

    expect(p.ngayTiepNhan).toBe("2026-08-01");
    expect(p.loaiThongTin).toBe("Tố giác");
  });
});

describe("Đọc ô hệ cũ về form khi sửa hồ sơ", () => {
  it("đọc cột typed, không phải mò trong metadata", () => {
    const api = {
      id: "c1",
      name: "Vụ án thử",
      caseProvenance: "DIRECT_DISCOVERY",
      ngayXayRa: "2026-08-01T00:00:00.000Z",
      noiXayRaPhuongXa: "Phường Bến Nghé",
      phanLoaiNguonTinBanDau: "vu_an",
      soQDKhongKhoiTo: "05/QĐ-KKT",
      ngayQDKhongKhoiTo: "2026-08-03T00:00:00.000Z",
      lyDoKhongKhoiTo: ["khong_co_su_viec"],
      vuViecTamDungTruoc2015: true,
      vatChungMoTa: "01 điện thoại iPhone 13",
      lenhNhapKho: "PN 33 ngày 06/8",
      noiLuuTruBaoQuan: "Kho vật chứng PC02",
      toiDanhChinhKhoiToId: "crime-174",
      baoCaoBanGiamDocText: "Báo cáo Ban Giám đốc ngày 12/8",
      soHoSoCu: "1234",
      metadata: {},
    };

    const form = mergeCaseApiToFormData(api as never, INITIAL_FORM_DATA);

    expect(form.ngayXayRa).toBe("2026-08-01");
    expect(form.noiXayRaPhuongXa).toBe("Phường Bến Nghé");
    expect(form.phanLoaiNguonTinBanDau).toBe("vu_an");
    expect(form.soQDKhongKhoiTo).toBe("05/QĐ-KKT");
    expect(form.ngayQDKhongKhoiTo).toBe("2026-08-03");
    expect(form.lyDoKhongKhoiTo).toEqual(["khong_co_su_viec"]);
    expect(form.vuViecTamDungTruoc2015).toBe(true);
    expect(form.vatChungMoTa).toBe("01 điện thoại iPhone 13");
    expect(form.lenhNhapKho).toBe("PN 33 ngày 06/8");
    expect(form.noiLuuTruBaoQuan).toBe("Kho vật chứng PC02");
    expect(form.toiDanhChinhKhoiToId).toBe("crime-174");
    expect(form.baoCaoBanGiamDoc).toBe("Báo cáo Ban Giám đốc ngày 12/8");
    expect(form.soHoSoCu).toBe("1234");
  });

  it("gõ vào rồi lưu rồi mở lại — giá trị giữ nguyên, không rơi rớt", () => {
    const p = payload();
    const api = { id: "c1", name: "Vụ án thử", caseProvenance: "DIRECT_DISCOVERY", metadata: p.metadata, ...p };
    const form = mergeCaseApiToFormData(api as never, INITIAL_FORM_DATA);

    for (const key of ["soQDPhanCongNguonTin", "canCuKhongKhoiTo", "nhapVaoVuViecSo", "phanLoaiDanSu", "khacPhucLyDoTDCVuViec"] as const) {
      expect(form[key], `ô "${key}" mất giá trị sau một vòng lưu và mở lại`).toBe(DAY_DU[key]);
    }
  });
});
