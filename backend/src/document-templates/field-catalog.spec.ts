import {
  resolveField,
  assertFieldInCatalog,
  listCatalog,
  catalogKeys,
  FIELD_CATALOG,
} from './field-catalog';
import { BadRequestException } from '@nestjs/common';

describe('field-catalog', () => {
  describe('resolveField — VU_AN (giữ hành vi caseMap cũ)', () => {
    it('soVuAn ← caseCode', () => {
      expect(resolveField('VU_AN', 'soVuAn', { caseCode: 'VA-01' })).toBe('VA-01');
    });
    it('dieuTraVien ← investigator, ghép HỌ TRƯỚC TÊN SAU', () => {
      // Dữ liệu mẫu cũ đặt "Nguyễn" (một HỌ) vào `firstName` và mong đợi "Nguyễn An" — nó mã
      // hoá đúng cái quy ước sai đã sinh ra lỗi anh báo 25/08/2026. Nay dùng dữ liệu đúng
      // như cơ sở dữ liệu thật lưu: `lastName` = họ và tên đệm, `firstName` = tên gọi.
      expect(
        resolveField('VU_AN', 'dieuTraVien', {
          investigator: { firstName: 'An', lastName: 'Nguyễn Văn' },
        }),
      ).toBe('Nguyễn Văn An');
    });
    it('donVi ← unitRef.name', () => {
      expect(resolveField('VU_AN', 'donVi', { unitRef: { name: 'PC02' } })).toBe('PC02');
    });
  });

  describe('resolveField — VU_VIEC (giữ hành vi incidentMap cũ)', () => {
    it('soVuViec ← code', () => {
      expect(resolveField('VU_VIEC', 'soVuViec', { code: 'VV-09' })).toBe('VV-09');
    });
    it('nguonTin ← nhãn tiếng Việt của enum NguonPhatTin', () => {
      expect(resolveField('VU_VIEC', 'nguonTin', { nguonPhatTin: 'CA_NHAN_TO_GIAC' })).toBe(
        'Cá nhân tố giác',
      );
    });
  });

  describe('resolveField — DON_THU', () => {
    it('ghiTen ← senderName', () => {
      expect(resolveField('DON_THU', 'ghiTen', { senderName: 'Trần Bình' })).toBe('Trần Bình');
    });
    it('noiDung computed = detailContent || summary', () => {
      expect(resolveField('DON_THU', 'noiDung', { detailContent: '', summary: 'tóm tắt' })).toBe(
        'tóm tắt',
      );
      expect(resolveField('DON_THU', 'noiDung', { detailContent: 'chi tiết' })).toBe('chi tiết');
    });
    /**
     * Bản trước chốt "Có/Không". Đo bản in hệ cũ 09/09/2026: mẫu đổ thẳng
     * `${truong_hop_bao_cao_ban_giam_doc}` — in CHỮ, rỗng thì để trống, không bao giờ in "Không".
     */
    it('baoCaoBGD: chỉ có ô đánh dấu thì nói Có, không thuộc thì để TRỐNG', () => {
      expect(resolveField('DON_THU', 'baoCaoBGD', { baoCaoBanGiamDoc: true })).toBe('Có');
      expect(resolveField('DON_THU', 'baoCaoBGD', { baoCaoBanGiamDoc: false })).toBe('');
    });
  });

  it('field không tồn tại → chuỗi rỗng', () => {
    expect(resolveField('VU_AN', 'khongCo', {})).toBe('');
  });

  describe('assertFieldInCatalog (whitelist — bảo mật)', () => {
    it('field hợp lệ → không throw', () => {
      expect(() => assertFieldInCatalog('DON_THU', 'ghiTen')).not.toThrow();
    });
    it('field ngoài catalog → BadRequestException', () => {
      expect(() => assertFieldInCatalog('DON_THU', '__proto__')).toThrow(BadRequestException);
      expect(() => assertFieldInCatalog('VU_AN', 'hack')).toThrow(BadRequestException);
    });
  });

  it('listCatalog trả {key,label,group} — KHÔNG kèm resolve', () => {
    const list = listCatalog('VU_AN');
    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      expect(item).toEqual({
        key: expect.any(String),
        label: expect.any(String),
        group: expect.any(String),
      });
    }
  });

  it('catalogKeys gồm soVanBan (số cấp khi in)', () => {
    expect(catalogKeys('VU_AN')).toContain('soVanBan');
    expect(catalogKeys('DON_THU')).toContain('soVanBan');
  });

  it('FIELD_CATALOG có đủ 3 entityType', () => {
    expect(Object.keys(FIELD_CATALOG).sort()).toEqual(['DON_THU', 'VU_AN', 'VU_VIEC']);
  });
});

/**
 * SỐ VĂN BẢN và MÃ ĐƠN VỊ trên bộ mẫu PC01 phải in RA ĐÚNG NHƯ HỆ CŨ.
 *
 * Anh chốt: cùng một hồ sơ thì hai hệ phải ra giống hệt nhau. Đo trên bản in thật của hệ cũ
 * ngày 09/09/2026:
 *
 *   hồ sơ 37315 (`stt = 2016-172`) → `172/ĐX-PC02-Đ1` · `172/PC-PC02-Đ1` · `172/TB-PC02-Đ1`
 *                                     · `172/HD-PC02-Đ1`  (CÙNG một số, chỉ khác hậu tố loại)
 *   hồ sơ 69971 (`stt = 5620`)     → `5620/ĐX-PC02-Đ1`
 *
 * Hai điều rút ra:
 * 1. Số văn bản LÀ STT của chính hồ sơ, không phải bộ đếm riêng theo loại chứng từ.
 * 2. Hậu tố `Đ1` KHÔNG đổi theo đội được giao — hồ sơ 37315 giao Đội 8, hồ sơ 69971 giao Công an
 *    phường Hòa Hưng, cả hai vẫn in `-Đ1`. Đó là đơn vị PHÁT HÀNH (Đội Tham mưu tổng hợp).
 *
 * Bản trước in `0045/ĐX-PC02-Đ1/ĐX-PC02-DOI-4`: số lấy từ bộ đếm, hậu tố bị nhân đôi (bộ cấp số
 * gắn một lần, mẫu viết thêm một lần), và `teamCode` in ra MÃ NỘI BỘ `DOI-4`.
 */
describe('số văn bản in ra như hệ cũ', () => {
  it('lấy STT TRẦN của hồ sơ, không ghép năm', () => {
    expect(resolveField('DON_THU', 'soVanBan', { stt: '2016-172' } as never)).toBe('172');
    expect(resolveField('DON_THU', 'soVanBan', { code: '2017-18' } as never)).toBe('18');
    expect(resolveField('DON_THU', 'soVanBan', { caseCode: '2025-175' } as never)).toBe('175');
  });

  it('hồ sơ di trú: lấy đúng giá trị thô của hệ cũ', () => {
    expect(resolveField('DON_THU', 'soVanBan', { stt: '2025-5620', legacyRaw: { stt: '5620' } } as never)).toBe(
      '5620',
    );
  });

  it('hồ sơ chưa có số thì để TRỐNG, không bịa', () => {
    expect(resolveField('DON_THU', 'soVanBan', {} as never)).toBe('');
  });

  it('mã đơn vị là Đ1 — đơn vị PHÁT HÀNH, không đổi theo đội được giao', () => {
    expect(resolveField('DON_THU', 'teamCode', { assignedTeam: { code: 'DOI-4', name: 'Đội 4 (TT)' } } as never)).toBe(
      'Đ1',
    );
    expect(resolveField('DON_THU', 'teamCode', { assignedTeam: { code: 'D8' } } as never)).toBe('Đ1');
    expect(resolveField('DON_THU', 'teamCode', {} as never)).toBe('Đ1');
  });

  /** Ghép lại đúng dòng "Số:" của mẫu để thấy kết quả cuối cùng. */
  it('ghép lại thành đúng dòng hệ cũ in ra', () => {
    const r = { stt: '2016-172' } as never;
    const dong = `Số: ${resolveField('DON_THU', 'soVanBan', r)}/ĐX-PC02-${resolveField('DON_THU', 'teamCode', r)}`;

    expect(dong).toBe('Số: 172/ĐX-PC02-Đ1');
  });
});

/**
 * NĂM ở dòng ký phải là năm của HỒ SƠ, không phải năm hiện tại.
 *
 * Mẫu Phiếu đề xuất ghi CỨNG "Ngày … tháng … năm 2026", nên hồ sơ tiếp nhận năm 2016 in ra
 * 2026 — sai với toàn bộ hồ sơ di trú. Hệ cũ đổ thẳng `$info['nam']`.
 */
describe('năm ở dòng ký', () => {
  it('hồ sơ di trú: lấy đúng năm thô của hệ cũ', () => {
    expect(resolveField('DON_THU', 'namHoSo', { legacyRaw: { nam: '2016' } } as never)).toBe('2016');
  });

  it('hồ sơ hệ mới: lấy năm của ngày ký', () => {
    const nam = String(new Date().getFullYear());

    expect(resolveField('DON_THU', 'namHoSo', {} as never)).toBe(nam);
  });

  it('hồ sơ di trú thiếu ô năm → in TRỐNG, không lùi về năm nay', () => {
    // Hệ cũ đổ thẳng: rỗng thì in rỗng. Lùi về năm nay là bịa ra một năm không có ở đâu cả.
    expect(resolveField('DON_THU', 'namHoSo', { legacyRaw: { ngay: '14', nam: '' } } as never)).toBe(
      '',
    );
  });
});

/**
 * Hai ô in SAI trên gần như mọi hồ sơ, đo trên máy thật 09/09/2026.
 *
 * So bản in Phiếu đề xuất của hệ mới với bản in hệ cũ của CÙNG hồ sơ 37315:
 *
 *   hệ cũ : "Đơn Tố giác ghi ngày 28/11/2016"
 *   hệ mới: "Đơn ghi ngày 28/11/2016"                    <- mất loại đơn
 *
 *   hệ cũ : "Thuộc trường hợp báo cáo Ban giám đốc: Công ty Cổ phần Ánh Dương Việt Nam"
 *   hệ mới: "Thuộc trường hợp báo cáo Ban giám đốc: Có"  <- in cột BOOLEAN thay vì cột CHỮ
 *
 * Quy mô: 46.655/47.169 hồ sơ (98,9%) có `petitionType` rỗng mà `loaiThongTin` có chữ — hệ cũ in
 * chính chữ ấy. 35.502 hồ sơ có `baoCaoBanGiamDocText`, mà bản in đọc cột boolean bên cạnh.
 */
describe('hai ô đọc nhầm cột', () => {
  it('loại đơn: chưa phân loại thì lấy loại thông tin như hệ cũ in', () => {
    expect(resolveField('DON_THU', 'loaiDon', { loaiThongTin: 'Tố giác' } as never)).toBe('Tố giác');
  });

  it('loại đơn: đã phân loại thì dùng nhãn của hệ mới', () => {
    const ra = resolveField('DON_THU', 'loaiDon', {
      petitionType: 'DON_TO_CAO',
      loaiThongTin: 'Tố giác',
    } as never);

    expect(ra).toBe('Đơn tố cáo');
  });

  it('báo cáo BGĐ: in CHỮ, không in "Có"', () => {
    const ra = resolveField('DON_THU', 'baoCaoBGD', {
      baoCaoBanGiamDoc: true,
      baoCaoBanGiamDocText: 'Công ty Cổ phần Ánh Dương Việt Nam',
    } as never);

    expect(ra).toBe('Công ty Cổ phần Ánh Dương Việt Nam');
  });

  it('báo cáo BGĐ: chỉ có ô đánh dấu, không có chữ → vẫn nói được là Có', () => {
    expect(resolveField('DON_THU', 'baoCaoBGD', { baoCaoBanGiamDoc: true } as never)).toBe('Có');
  });

  it('báo cáo BGĐ: không thuộc trường hợp → in TRỐNG như hệ cũ, không in "Không"', () => {
    // Mẫu hệ cũ chỉ đổ `${truong_hop_bao_cao_ban_giam_doc}`; rỗng thì in rỗng.
    expect(resolveField('DON_THU', 'baoCaoBGD', { baoCaoBanGiamDoc: false } as never)).toBe('');
  });
});

/**
 * BA MỤC CÒN LẠI — anh chốt "làm giống như cũ hết" (09/09/2026).
 *
 * So bản in Phiếu đề xuất của hệ mới với bản in hệ cũ, cùng hồ sơ 37315:
 *
 *   | mục | hệ cũ | hệ mới (trước khi sửa) |
 *   |---|---|---|
 *   | dòng địa điểm | `…, ngày 14 tháng 12 năm 2016` (ngày của HỒ SƠ) | `…, ngày 09 tháng 09 năm 2026` (hôm nay) |
 *   | Ban chỉ huy   | `Đội 1` (đơn vị PHÁT HÀNH, chữ CỨNG trong mẫu cũ) | `Đội 8` (đội được giao) |
 *   | Đề xuất       | `Giao Đội 8 tiếp nhận kiểm tra, xác minh, …` | `./.` (rỗng ở 47.079/47.169 hồ sơ) |
 *
 * Câu "Đề xuất" của hệ cũ nằm trong CHÍNH MẪU:
 *   `Đề xuất: Giao ${don_vi_giai_quyet} tiếp nhận kiểm tra, xác minh, báo cáo Đ/c Chỉ huy Phòng
 *    phụ trách để giải quyết theo quy định./.`
 * Mẫu hệ mới viết `Đề xuất: {deXuat}./.` nên phần điền KHÔNG kèm "./." ở cuối.
 */
describe('ba mục còn lại — giống hệ cũ', () => {
  it('dòng địa điểm lấy NGÀY CỦA HỒ SƠ, không phải hôm nay', () => {
    const r = { legacyRaw: { ngay: 14, thang: 12, nam: 2016 } } as never;

    expect(resolveField('DON_THU', 'ngayPhatHanh', r)).toBe('ngày 14 tháng 12 năm 2016');
  });

  it('giữ luật đệm số 0 KHÔNG đối xứng của hệ cũ: đệm ngày, KHÔNG đệm tháng', () => {
    const r = { legacyRaw: { ngay: 9, thang: 8, nam: 2026 } } as never;

    expect(resolveField('DON_THU', 'ngayPhatHanh', r)).toBe('ngày 09 tháng 8 năm 2026');
  });

  it('tên đội là đơn vị PHÁT HÀNH, không phải đội được giao', () => {
    const r = { assignedTeam: { name: 'Đội 8', code: 'D8' } } as never;

    expect(resolveField('DON_THU', 'tenDoi', r)).toBe('Đội 1');
  });

  it('đề xuất: cán bộ chưa viết thì ghép câu như mẫu hệ cũ', () => {
    const r = { donViGiaiQuyet: 'Đội 8' } as never;

    expect(resolveField('DON_THU', 'deXuat', r)).toBe(
      'Giao Đội 8 tiếp nhận kiểm tra, xác minh, báo cáo Đ/c Chỉ huy Phòng phụ trách để giải quyết theo quy định',
    );
  });

  it('đề xuất: cán bộ ĐÃ viết thì dùng đúng chữ của cán bộ', () => {
    const r = { deXuat: 'Chuyển Công an quận 5', donViGiaiQuyet: 'Đội 8' } as never;

    expect(resolveField('DON_THU', 'deXuat', r)).toBe('Chuyển Công an quận 5');
  });
});
