import { describe, it, expect } from 'vitest';
import {
  DUNG_SAI_GIO_PHUT,
  LOI_GIO_SAI,
  LOI_PHUT_SAI,
  buocGioPhut,
  chuanHoaKhiRoiO,
  dinhDangKhiGo,
  gioHienTaiVN,
  laGioPhutHopLe,
  laGioTuongLai,
} from '../gioPhut';

describe('dinhDangKhiGo — gõ liền chữ số', () => {
  const BANG: [string, string][] = [
    ['', ''],
    ['0', '0'],
    ['8', '8'],
    ['08', '08'],
    ['083', '08:3'],
    ['0830', '08:30'],
    ['08305', '08:30'], // chữ số thừa bị mặt nạ chặn (không thêm được)
    ['9', '9'],
    ['83', '8:3'], // chữ số đầu 3–9 → giờ 1 chữ số
    ['830', '8:30'],
    ['8301', '8:30'],
    ['14', '14'],
    ['143', '14:3'],
    ['1430', '14:30'],
    ['24', '24'], // KHÔNG đổi cách hiểu tiền tố: giờ 24 giữ nguyên để báo lỗi khi rời ô
    ['245', '24:5'],
    ['2450', '24:50'],
    [' 0830 ', '08:30'],
    ['0a8b3c0', '08:30'], // rác chen giữa bị bỏ
    ['abc', ''],
  ];
  it.each(BANG)('"%s" → "%s"', (vao, ra) => {
    expect(dinhDangKhiGo(vao)).toBe(ra);
  });

  it('dấu tách tự gõ giữ nguyên: "8:" "08:" "8:3" "08:30"', () => {
    expect(dinhDangKhiGo('8:')).toBe('8:');
    expect(dinhDangKhiGo('08:')).toBe('08:');
    expect(dinhDangKhiGo('8:3')).toBe('8:3');
    expect(dinhDangKhiGo('08:30')).toBe('08:30');
    expect(dinhDangKhiGo('08:305')).toBe('08:30');
  });

  it.each([
    ['8h30', '8:30'],
    ['8g30', '8:30'],
    ['8H30', '8:30'],
    ['8 giờ 30', '8:30'],
    ['08 giờ 30 phút', '08:30'],
    ['08.30', '08:30'],
    ['08,30', '08:30'],
    ['08 30', '08:30'],
    ['8 giờ', '8:'],
    ['8h', '8:'],
  ])('dán "%s" → "%s"', (vao, ra) => {
    expect(dinhDangKhiGo(vao)).toBe(ra);
  });

  it('chỉ dấu tách, không có giờ → rỗng (không hiện ":" lẻ loi)', () => {
    for (const v of [':', ':30', '::', 'giờ', ' ']) expect(dinhDangKhiGo(v)).toBe('');
  });

  it('BACKSPACE qua dấu ":" không bị kẹt: xoá dần từ "08:3" về rỗng', () => {
    // Mô phỏng từng lần xoá một ký tự rồi định dạng lại.
    let v = dinhDangKhiGo('0830'); // 08:30
    const chuoi: string[] = [v];
    while (v !== '') {
      v = dinhDangKhiGo(v.slice(0, -1));
      chuoi.push(v);
      if (chuoi.length > 10) throw new Error('kẹt: không xoá hết được');
    }
    expect(chuoi).toEqual(['08:30', '08:3', '08:', '08', '0', '']);
  });

  it('chuỗi gõ từng chữ số ra đúng dãy hiển thị (gõ "830" và "1430")', () => {
    const go = (s: string) => {
      let buf = '';
      const ra: string[] = [];
      for (const c of s) {
        buf = dinhDangKhiGo(buf + c);
        ra.push(buf);
      }
      return ra;
    };
    expect(go('830')).toEqual(['8', '8:3', '8:30']);
    expect(go('1430')).toEqual(['1', '14', '14:3', '14:30']);
    expect(go('0830')).toEqual(['0', '08', '08:3', '08:30']);
  });
});

describe('chuanHoaKhiRoiO — chuẩn hoá khi rời ô', () => {
  it('rỗng hợp lệ (ô không bắt buộc: NULL = không biết giờ)', () => {
    expect(chuanHoaKhiRoiO('')).toEqual({ giaTri: '', loi: null });
    expect(chuanHoaKhiRoiO(':')).toEqual({ giaTri: '', loi: null });
    expect(chuanHoaKhiRoiO('abc')).toEqual({ giaTri: '', loi: null });
  });

  it.each([
    ['0830', '08:30'],
    ['830', '08:30'],
    ['8:30', '08:30'],
    ['08:30', '08:30'],
    ['9', '09:00'], // 1–2 chữ số = giờ tròn
    ['14', '14:00'],
    ['0', '00:00'],
    ['00', '00:00'],
    ['08:', '08:00'],
    ['8:3', '08:03'], // phút 1 chữ số = 0x
    ['2359', '23:59'],
    ['0000', '00:00'],
    ['8h30', '08:30'],
    ['8 giờ 30', '08:30'],
    ['8 giờ', '08:00'],
  ])('"%s" → "%s", không lỗi', (vao, ra) => {
    expect(chuanHoaKhiRoiO(vao)).toEqual({ giaTri: ra, loi: null });
  });

  it('GIỜ > 23 báo lỗi, KHÔNG cắt/đoán lại, giữ nguyên chuỗi để người dùng thấy', () => {
    expect(chuanHoaKhiRoiO('24')).toEqual({ giaTri: '24', loi: LOI_GIO_SAI });
    expect(chuanHoaKhiRoiO('2450')).toEqual({ giaTri: '24:50', loi: LOI_GIO_SAI });
    expect(chuanHoaKhiRoiO('25:30')).toEqual({ giaTri: '25:30', loi: LOI_GIO_SAI });
    // "99": chữ số đầu 9 → giờ 1 chữ số, nên lúc gõ ô đã hiện "9:9" và rời ô thành 09:09 (không phải sửa ngầm: người dùng
    // thấy "9:9" ngay khi gõ). Giờ 2 chữ số vượt 23 chỉ xảy ra khi chữ số đầu là 0–2 ("24"–"29") hoặc gõ tường minh "25:30".
    expect(chuanHoaKhiRoiO('99')).toEqual({ giaTri: '09:09', loi: null });
    expect(chuanHoaKhiRoiO('29')).toEqual({ giaTri: '29', loi: LOI_GIO_SAI });
  });

  it('PHÚT > 59 báo lỗi', () => {
    expect(chuanHoaKhiRoiO('0860')).toEqual({ giaTri: '08:60', loi: LOI_PHUT_SAI });
    expect(chuanHoaKhiRoiO('08:75')).toEqual({ giaTri: '08:75', loi: LOI_PHUT_SAI });
    expect(chuanHoaKhiRoiO('1999')).toEqual({ giaTri: '19:99', loi: LOI_PHUT_SAI });
  });

  it('kết quả hợp lệ LUÔN khớp dạng HH:mm chặt (cùng luật DTO/CHECK ở máy chủ)', () => {
    for (let h = 0; h < 24; h += 1) {
      for (const p of [0, 1, 9, 30, 59]) {
        const vao = `${String(h).padStart(2, '0')}${String(p).padStart(2, '0')}`;
        const r = chuanHoaKhiRoiO(vao);
        expect(r.loi).toBeNull();
        expect(laGioPhutHopLe(r.giaTri)).toBe(true);
      }
    }
  });
});

describe('laGioPhutHopLe', () => {
  it.each(['00:00', '09:30', '23:59'])('%s hợp lệ', (v) => expect(laGioPhutHopLe(v)).toBe(true));
  it.each(['24:00', '9:30', '09:60', '0930', '09:30:00', '', ' 09:30', '08:'])('"%s" không hợp lệ', (v) =>
    expect(laGioPhutHopLe(v)).toBe(false),
  );
  it('không phải chuỗi', () => {
    for (const v of [null, undefined, 930, {}]) expect(laGioPhutHopLe(v)).toBe(false);
  });
});

describe('buocGioPhut — mũi tên', () => {
  it.each([
    ['09:30', 1, '09:31'],
    ['09:59', 1, '10:00'],
    ['23:59', 1, '00:00'],
    ['00:00', -1, '23:59'],
    ['09:30', 60, '10:30'],
    ['09:30', -60, '08:30'],
    ['00:30', -60, '23:30'],
    ['23:30', 60, '00:30'],
  ])('%s %i phút → %s', (v, d, ra) => expect(buocGioPhut(v, d)).toBe(ra));

  it('giá trị không hợp lệ → giữ nguyên', () => {
    expect(buocGioPhut('', 1)).toBe('');
    expect(buocGioPhut('08:', 1)).toBe('08:');
  });
});

describe('gioHienTaiVN — giờ Việt Nam, độc lập múi giờ máy khách, không "24:xx"', () => {
  it.each([
    ['2026-10-07T17:05:00Z', '00:05'], // nửa đêm VN: KHÔNG phải "24:05"
    ['2026-10-08T05:30:00Z', '12:30'],
    ['2026-10-08T16:59:00Z', '23:59'],
    ['2026-10-08T00:00:00Z', '07:00'],
  ])('%s → %s', (iso, ra) => expect(gioHienTaiVN(new Date(iso))).toBe(ra));
});

describe('laGioTuongLai — khớp luật của máy chủ', () => {
  const BAY_GIO = new Date('2026-10-08T07:00:00Z'); // 14:00 giờ VN
  it('dung sai 5 phút', () => expect(DUNG_SAI_GIO_PHUT).toBe(5));
  it('hôm nay: đã qua / +4 / +5 phút → không; +6 → có', () => {
    expect(laGioTuongLai('2026-10-08', '09:30', BAY_GIO)).toBe(false);
    expect(laGioTuongLai('2026-10-08', '14:04', BAY_GIO)).toBe(false);
    expect(laGioTuongLai('2026-10-08', '14:05', BAY_GIO)).toBe(false);
    expect(laGioTuongLai('2026-10-08', '14:06', BAY_GIO)).toBe(true);
    expect(laGioTuongLai('2026-10-08', '23:59', BAY_GIO)).toBe(true);
  });
  it('ngày quá khứ: giờ nào cũng nhận', () => {
    expect(laGioTuongLai('2026-10-07', '23:59', BAY_GIO)).toBe(false);
  });
  it('giờ rỗng/hỏng → không có gì để kiểm', () => {
    for (const g of ['', '24:00', '9:30', 'abc']) expect(laGioTuongLai('2026-10-08', g, BAY_GIO)).toBe(false);
  });
  it('sau nửa đêm VN: ngày khai hôm qua (VN) không bị coi là hôm nay', () => {
    const sauNuaDem = new Date('2026-10-08T17:30:00Z'); // 09/10 00:30 VN
    expect(laGioTuongLai('2026-10-08', '23:59', sauNuaDem)).toBe(false);
    expect(laGioTuongLai('2026-10-09', '00:50', sauNuaDem)).toBe(true);
  });
});
