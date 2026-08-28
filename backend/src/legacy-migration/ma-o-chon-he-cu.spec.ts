import {
  MA_CHUA_CHON,
  BANG_TINH_TRANG,
  giaiMaTinhTrang,
  giaiMaToiDanhBanDau,
} from './ma-o-chon-he-cu';

/**
 * Hệ cũ lưu ô `<select>` bằng SỐ, chữ chỉ tra ra lúc hiện. Ta chép số ấy vào một cột chữ tự do
 * rồi in nguyên số ra màn hình — vụ án `2026-11139` hiện `-1` ở ô "Tình trạng hồ sơ".
 *
 * Bằng chứng trong mã hệ cũ:
 *   _PC02/Modules/VuAn/act/insert.php:90        'tinh_trang' => -1        (mặc định lúc tạo)
 *   _PC02/Modules/VuAn/act/capnhattinhtrang.php  intval(REQUEST(...))     (ghi SỐ, không phải chữ)
 *   _PC02/templates/HoSo_list.tpl:427            tinhTrangMap[-1]="Chưa chọn"
 *
 * Đo trên bản sao dữ liệu gốc `pc02_legacy_backup.legacy_ho_so_doi_1` (28/08/2026): trường
 * `tinh_trang` chỉ có hai dạng — KHÔNG CÓ (36.883) hoặc `-1` (18.184). Không một bản ghi nào
 * mang mã thật. Nghĩa là ta chép đúng, chỉ hiện sai.
 */
describe('Giải mã ô chọn hệ cũ', () => {
  describe('Tình trạng hồ sơ', () => {
    /** Cốt lõi: `-1` là mã canh "chưa chọn", không phải dữ liệu. Đây là thứ anh nhìn thấy. */
    it('`-1` ra chuỗi rỗng — hệ cũ hiện "Chưa chọn", ta để trống', () => {
      expect(giaiMaTinhTrang('VU_AN', '-1')).toBe('');
      expect(giaiMaTinhTrang('VU_VIEC', '-1')).toBe('');
      expect(giaiMaTinhTrang('DON_THU', '-1')).toBe('');
    });

    /**
     * Bảng mã KHÁC NHAU theo thực thể — lấy từ chính ô lọc hệ cũ ngày 28/08/2026.
     * Dùng nhầm bảng thì `0` của vụ việc ("đang xác minh") in ra thành chữ của vụ án.
     */
    it('mã thật ra đúng chữ của ĐÚNG thực thể', () => {
      expect(giaiMaTinhTrang('VU_AN', '0')).toBe('Vụ án đang điều tra');
      expect(giaiMaTinhTrang('VU_VIEC', '0')).toBe('Vụ việc đang xác minh');
      expect(giaiMaTinhTrang('VU_AN', '5')).toBe('Vụ án Tạm đình chỉ');
      expect(giaiMaTinhTrang('VU_VIEC', '3')).toBe('Vụ việc Tạm đình chỉ');
    });

    /**
     * `-2` là MỘT LỰA CHỌN THẬT ("Chưa rõ"), không phải mã canh. Gộp nó vào diện xoá là mất
     * một thông tin cán bộ đã chủ động chọn.
     */
    it('`-2` là lựa chọn thật "Chưa rõ", KHÔNG bị coi là chưa chọn', () => {
      expect(MA_CHUA_CHON.has('-2')).toBe(false);
      expect(giaiMaTinhTrang('VU_AN', '-2')).toBe('Chưa rõ');
    });

    /**
     * Vụ việc có 118 bản ghi mang chữ thật ("Tạm đình chỉ theo Điều 134"). Bộ giải mã đụng vào
     * chúng là xoá dữ liệu người ta đã nhập.
     */
    it('chữ thật đi qua KHÔNG đổi', () => {
      expect(giaiMaTinhTrang('VU_VIEC', 'Tạm đình chỉ theo Điều 134')).toBe(
        'Tạm đình chỉ theo Điều 134',
      );
    });

    /** Mã lạ ngoài bảng: GIỮ NGUYÊN. Bịa chữ hoặc xoá đi đều tệ hơn để người ta nhìn thấy. */
    it('mã ngoài bảng giữ nguyên, không bịa và không xoá', () => {
      expect(giaiMaTinhTrang('VU_AN', '99')).toBe('99');
    });

    it('rỗng/không có vẫn là rỗng', () => {
      expect(giaiMaTinhTrang('VU_AN', null)).toBe('');
      expect(giaiMaTinhTrang('VU_AN', undefined)).toBe('');
      expect(giaiMaTinhTrang('VU_AN', '  ')).toBe('');
    });

    /** Chạy lại trên dữ liệu đã giải mã phải ra y hệt — nếu không, chạy hai lần hỏng dữ liệu. */
    it('giải mã hai lần ra cùng kết quả', () => {
      const mot = giaiMaTinhTrang('VU_AN', '0');
      expect(giaiMaTinhTrang('VU_AN', mot)).toBe(mot);
    });

    it('bảng mã có đủ ba thực thể và không bảng nào rỗng', () => {
      for (const k of ['VU_AN', 'VU_VIEC', 'DON_THU'] as const) {
        expect(Object.keys(BANG_TINH_TRANG[k]).length).toBeGreaterThan(0);
      }
    });
  });

  describe('Tội danh ban đầu', () => {
    /**
     * `toi-danh-ban-dau` là KHOÁ tới bảng tội danh hệ cũ, không phải chữ
     * (`_PC02/Modules/_tools/act/test.php:50` — `mdb_get_ids("ho_so",…,'toi-danh-ban-dau')`).
     * Tra `pc02_legacy_backup.legacy_toidanh`: 67 → Điều 174. Trong 55.067 bản ghi hệ cũ có
     * 54.990 đã là chữ, còn 76 bản ghi vẫn là số.
     */
    const tra = new Map([
      ['67', 'Điều 174. Tội lừa đảo chiếm đoạt tài sản'],
      ['68', 'Điều 175. Tội lạm dụng tín nhiệm chiếm đoạt tài sản'],
    ]);

    it('số ra tên tội danh', () => {
      expect(giaiMaToiDanhBanDau('67', tra)).toBe('Điều 174. Tội lừa đảo chiếm đoạt tài sản');
    });

    it('chữ sẵn có đi qua không đổi — 54.990 bản ghi thuộc diện này', () => {
      const chu = 'Điều 174. Tội lừa đảo chiếm đoạt tài sản';
      expect(giaiMaToiDanhBanDau(chu, tra)).toBe(chu);
    });

    it('số không tra được thì GIỮ NGUYÊN, không xoá', () => {
      expect(giaiMaToiDanhBanDau('99999', tra)).toBe('99999');
    });

    it('rỗng vẫn là rỗng', () => {
      expect(giaiMaToiDanhBanDau(null, tra)).toBe('');
    });
  });
});

import { decomposeLegacyRecord, parityColumns } from './legacy-mapper';

/** Hồ sơ tối thiểu để bộ dựng đi vào nhánh Vụ việc. */
const HO_SO_VU_VIEC = {
  id: 1,
  phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau',
  tom_tat_noi_dung: 'x',
};
import { PARITY } from './field-parity.def';

/**
 * CỔNG: bộ nạp phải giải mã NGAY LÚC NHẬP, không chỉ dọn dữ liệu cũ.
 *
 * Chỉ dọn một lần thì đợt đồng bộ sau (`cli/cap-nhat-tu-he-cu.ts` chạy định kỳ, đọc thẳng
 * Mongo hệ cũ) lại đổ `-1` vào đúng những cột vừa dọn. Vá ở `parityColumns` là vá ở CHỖ DUY
 * NHẤT mọi đường nhập đi qua — cả di trú mới lẫn bù cột (`cli/backfill-parity.ts`).
 *
 * Cùng lối đã dùng cho số điện thoại hệ cũ (`soDienThoaiSachHeCu`): làm sạch tại cửa vào.
 */
describe('GATE — bộ nạp giải mã ô chọn ngay lúc nhập', () => {
  it('vụ án: `-1` không được vào cột', () => {
    const ra = parityColumns({ tinh_trang: '-1' } as never, 'case');
    expect(ra['tinhTrang']).toBe('');
  });

  it('vụ án: mã thật vào cột dưới dạng CHỮ', () => {
    const ra = parityColumns({ tinh_trang: '5' } as never, 'case');
    expect(ra['tinhTrang']).toBe('Vụ án Tạm đình chỉ');
  });

  /**
   * Vụ việc đi đường KHÁC: `tinh_trang` không có trong spec parity của incident, mà do bộ dựng
   * thực thể ghi thẳng (`legacy-mapper.ts` — `tinhTrangHoSo`). Kiểm đúng đường ghi thật, không
   * kiểm đường mình tưởng — vá một trong hai đường là bug quay lại ngay đợt đồng bộ sau.
   */
  it('vụ việc: cùng mã `0` nhưng ra chữ của vụ việc, không phải vụ án', () => {
    const r = decomposeLegacyRecord({
      ...HO_SO_VU_VIEC,
      tinh_trang: '0',
    } as never);
    expect(r.incident?.['tinhTrangHoSo']).toBe('Vụ việc đang xác minh');
  });

  it('vụ việc: `-1` không được vào cột', () => {
    const r = decomposeLegacyRecord({ ...HO_SO_VU_VIEC, tinh_trang: '-1' } as never);
    expect(r.incident?.['tinhTrangHoSo']).toBe('');
  });

  it('đơn thư: phân loại hồ sơ nội bộ `-1` không được vào cột', () => {
    const ra = parityColumns({ phan_loai_ho_so_doi_1: '-1' } as never, 'petition');
    expect(ra['phanLoaiHoSoNoiBo']).toBe('');
  });

  /** Chữ thật đi qua nguyên vẹn — 54.990 bản ghi tội danh và 118 vụ việc thuộc diện này. */
  it('chữ thật đi qua bộ nạp không đổi', () => {
    const r = decomposeLegacyRecord({
      ...HO_SO_VU_VIEC,
      tinh_trang: 'Tạm đình chỉ theo Điều 134',
    } as never);
    expect(r.incident?.['tinhTrangHoSo']).toBe('Tạm đình chỉ theo Điều 134');
  });

  /**
   * Cổng chống lan: mỗi cột khai `oChon` phải là cột kiểu chữ có thật trong spec. Khai lệch
   * thì bộ giải mã im lặng không chạy — đúng lớp "cổng canh danh sách của chính nó" đã bắt hai
   * lần trong tuần.
   */
  it('mọi cột khai `oChon` đều là cột String có thật trong spec', () => {
    for (const [ent, cols] of Object.entries(PARITY)) {
      for (const c of cols) {
        if (!c.oChon) continue;
        expect({ ent, col: c.col, type: c.type }).toEqual({ ent, col: c.col, type: 'String' });
      }
    }
  });
});

import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG CHỐNG LỆCH: bảng mã ở giao diện phải khớp từng dòng với bảng ở máy chủ.
 *
 * Giao diện cần bảng ấy để dựng ô chọn, máy chủ cần nó để giải mã lúc nhập. Hai bản chép tay
 * sẽ lệch nhau ngay lần đầu ai đó sửa một bên, và lệch kiểu này không lộ ra: ô chọn vẫn hiện,
 * chỉ là hiện sai chữ cho đúng cái mã ấy.
 *
 * Cổng đặt ở phía máy chủ vì chỉ ở đây mới đọc được cả hai tệp — Vite chặn nhập ngoài thư mục
 * gốc của giao diện, và tsconfig giao diện không khai kiểu của Node.
 *
 * Đã kiểm ngược 28/08/2026: sửa lệch một nhãn ở giao diện thì cổng đỏ.
 */
describe('GATE — bảng mã giao diện khớp máy chủ', () => {
  const giaoDien = fs.readFileSync(
    path.resolve(__dirname, '../../../frontend/src/shared/legacy/tinhTrangOptions.ts'),
    'utf-8',
  );

  /**
   * Cắt chuỗi thay vì dò bằng biểu thức: mẫu dựng từ chuỗi ghép rất dễ mất dấu thoát khi đi
   * qua trình soạn/vỏ lệnh, và lúc ấy cổng ném lỗi cú pháp thay vì so bảng — đã bị đúng thế
   * lần đầu viết cổng này (28/08/2026).
   */
  function docBangGiaoDien(ten: string): Array<{ value: string; label: string }> {
    const moc = 'const ' + ten + ': TuyChon[] = [';
    const dau = giaoDien.indexOf(moc);
    expect({ ten, timThay: dau >= 0 }).toEqual({ ten, timThay: true });
    const than = giaoDien.slice(dau + moc.length, giaoDien.indexOf('];', dau));
    const ds: Array<{ value: string; label: string }> = [];
    for (const dong of than.split('\n')) {
      const v = dong.split("value: '")[1];
      const l = dong.split("label: '")[1];
      if (v === undefined || l === undefined) continue;
      ds.push({ value: v.slice(0, v.indexOf("'")), label: l.slice(0, l.indexOf("'")) });
    }
    return ds;
  }

  it.each([
    ['VU_AN', 'VU_AN'],
    ['VU_VIEC', 'VU_VIEC'],
  ] as const)('bảng tình trạng %s khớp hai bên', (tenFe, tenBe) => {
    // So theo CẶP mã→chữ, không theo thứ tự: `Object.entries` xếp khoá dạng số lên trước nên
    // `-2` rơi xuống cuối, trong khi thứ tự trên ô chọn là lựa chọn của giao diện và không
    // phải thứ cần canh. Thứ cần canh là: đủ mã, và mỗi mã đúng một chữ.
    const cuaMayChu = BANG_TINH_TRANG[tenBe];
    const cuaGiaoDien = Object.fromEntries(docBangGiaoDien(tenFe).map((o) => [o.value, o.label]));
    expect(cuaGiaoDien).toEqual({ ...cuaMayChu });
  });

  /** Danh sách ô chọn KHÔNG được chứa `-1`: nó là mã canh "chưa chọn", không phải lựa chọn. */
  it('giao diện không khai `-1` thành một lựa chọn bấm được', () => {
    for (const ten of ['VU_AN', 'VU_VIEC']) {
      expect(docBangGiaoDien(ten).some((o) => o.value === '-1')).toBe(false);
    }
  });
});

/**
 * CỔNG: kiểm CẢ LUỒNG dựng hồ sơ, không kiểm hàm con.
 *
 * Bản vá đầu chỉ kiểm `parityColumns` nên trượt một lỗi chặn: `buildCase` trải
 * `...parityColumns(rec,'case')` rồi NGAY SAU ĐÓ khai lại `tinhTrang: s(rec.tinh_trang)`
 * (legacy-mapper.ts:504). Khai sau thắng, nên giá trị đã giải mã bị đè bằng mã thô — đúng
 * màn hình Vụ án mà anh báo (2026-11139), tức bản vá vô hiệu hoàn toàn ở đó mà 19 ca kiểm
 * vẫn xanh.
 *
 * Bài học đã ghi: một trường có thể có nhiều đường ghi, và ca kiểm ở tầng hàm con không nhìn
 * thấy đường nào đè lên đường nào. Phải kiểm ở tầng bản ghi hoàn chỉnh.
 */
describe('GATE — kiểm cả luồng dựng hồ sơ, không kiểm hàm con', () => {
  const HO_SO_VU_AN = {
    id: 2,
    phan_loai_nguon_tin_ban_dau: 'vu-an-ban-dau',
    tom_tat_noi_dung: 'x',
  };

  it('vụ án: `-1` KHÔNG lọt vào cột qua cả luồng dựng', () => {
    const r = decomposeLegacyRecord({ ...HO_SO_VU_AN, tinh_trang: '-1' } as never);
    expect(r.case?.['tinhTrang']).toBe('');
  });

  it('vụ án: mã thật ra chữ qua cả luồng dựng', () => {
    const r = decomposeLegacyRecord({ ...HO_SO_VU_AN, tinh_trang: '5' } as never);
    expect(r.case?.['tinhTrang']).toBe('Vụ án Tạm đình chỉ');
  });

  it('vụ án: phân loại hồ sơ nội bộ `-1` không lọt vào cột', () => {
    const r = decomposeLegacyRecord({
      ...HO_SO_VU_AN,
      phan_loai_ho_so_doi_1: '-1',
    } as never);
    expect(r.case?.['phanLoaiHoSoNoiBo']).toBe('');
  });

  /**
   * Cổng cấu trúc: không cột nào khai `oChon` được phép bị khai LẠI trong bộ dựng bằng `s(...)`
   * sau khi đã trải `parityColumns`. Đây chính là hình dạng của lỗi trên, và nó sẽ tái diễn
   * với cột kế tiếp nếu chỉ vá bằng tay.
   */
  it('không bộ dựng nào khai lại cột `oChon` bằng `s(rec…)`', () => {
    const nguon = fs.readFileSync(path.resolve(__dirname, 'legacy-mapper.ts'), 'utf-8');
    const cotOChon = new Set(
      Object.values(PARITY)
        .flat()
        .filter((c) => c.oChon)
        .map((c) => c.col),
    );
    const pham: string[] = [];
    for (const dong of nguon.split('\n')) {
      const cat = dong.trim();
      for (const col of cotOChon) {
        if (cat.startsWith(col + ': s(')) pham.push(cat);
      }
    }
    expect(pham).toEqual([]);
  });
});
