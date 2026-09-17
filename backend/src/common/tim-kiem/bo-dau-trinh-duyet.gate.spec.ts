import * as ts from 'typescript';
import * as vm from 'vm';
import {
  BANG_MOT_KY_TU,
  BANG_NHIEU_KY_TU,
  boDauTimKiem,
  sinhFrontendBoDau,
} from './bo-dau';

/**
 * CỔNG HÀNH VI: hàm bỏ dấu SINH RA cho trình duyệt phải cho CÙNG KẾT QUẢ với `boDauTimKiem` của máy chủ.
 *
 * So văn bản tệp (cổng `tim-kiem-sinh-khop`) chỉ nói tệp đã commit khớp bộ sinh — không nói hàm trong
 * tệp ấy chạy ra giống máy chủ. Chính khe hở ấy để hai phía lệch nhau: trước 17/09/2026 trình duyệt
 * không quy gạch ngang ngắn về `-`, nên cùng một chữ gõ, màn lọc tại chỗ ra rỗng còn màn lọc ở máy
 * chủ vẫn ra. Ở đây BIÊN DỊCH tệp sinh ra rồi CHẠY THẬT trên từng ký tự của bảng.
 */
function napHamSinhRa(
  nguon: string = sinhFrontendBoDau(),
): (v: string | null | undefined) => string {
  const js = ts.transpileModule(nguon, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  // Chạy trong ngữ cảnh CÔ LẬP (không `new Function`/`eval`): tệp sinh chỉ cần `module`/`exports`.
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  vm.runInNewContext(js, { module: mod, exports: mod.exports });
  return mod.exports.boDauTimKiem as (v: string | null | undefined) => string;
}

describe('GATE — bỏ dấu phía trình duyệt ≡ máy chủ', () => {
  const trinhDuyet = napHamSinhRa();

  it('từng ký tự của bảng một-ký-tự', () => {
    const lech = [...BANG_MOT_KY_TU.keys()].filter(
      (c) => trinhDuyet(`a${c}b`) !== boDauTimKiem(`a${c}b`),
    );
    expect(lech).toEqual([]);
  });

  it('từng mục của bảng nhiều-ký-tự', () => {
    for (const [nguon] of BANG_NHIEU_KY_TU) {
      expect(trinhDuyet(`x${nguon}y`)).toBe(boDauTimKiem(`x${nguon}y`));
    }
  });

  it('chuỗi thật: tiếng Việt, khoảng trắng thừa/NBSP, dấu câu dán từ Word, rỗng', () => {
    const nbsp = String.fromCharCode(0x00a0);
    const gachNgan = String.fromCharCode(0x2013);
    for (const s of [
      'Nguyễn Văn An',
      'ĐẶNG  THỊ   Hoà',
      `Tranh chấp${nbsp}đất đai`,
      `Số 12${gachNgan}2026`,
      '  26-11171  ',
      '',
      null,
      undefined,
    ]) {
      expect(trinhDuyet(s)).toBe(boDauTimKiem(s));
    }
  });

  /**
   * Gieo lỗi vào CHÍNH đầu ra bộ sinh: sửa hỏng đúng một mục (gạch ngang ngắn quy về `~` thay vì `-`),
   * biên dịch, chạy. Phép so trên bảng phải thấy lệch — không thì cổng xanh mãi mà không canh gì.
   */
  it('gieo lỗi: tệp sinh ra hỏng một mục bảng thì phép so thấy lệch', () => {
    const goc = sinhFrontendBoDau();
    const hong = goc.replace("[0x2013, '-'],", "[0x2013, '~'],");
    expect(hong).not.toBe(goc); // bảo đảm đã gieo được lỗi, không phải thay hụt
    const hamHong = napHamSinhRa(hong);
    const lech = [...BANG_MOT_KY_TU.keys()].filter(
      (c) => hamHong(`a${c}b`) !== boDauTimKiem(`a${c}b`),
    );
    expect(lech).toEqual([String.fromCharCode(0x2013)]);
  });
});
