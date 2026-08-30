import { useId } from 'react';

/**
 * Hai ô chọn của báo cáo kỳ — KỲ ĐANG XEM và NỀN SO SÁNH.
 *
 * ── Vì sao là hai ô, không phải một ──
 *
 * Chúng là hai trục khác nhau và cắt nhau: "lũy kế 8 tháng" là một KỲ, còn "cùng kỳ năm trước"
 * là một NỀN — và người ta muốn xem lũy kế 8 tháng so với cùng kỳ năm trước. Gộp vào một ô là
 * bắt người dùng chọn một trong hai thứ họ cần cả hai.
 *
 * ── Vì sao nền mặc định là "cùng kỳ năm trước" ──
 *
 * Quy ước báo cáo ngành: văn bản Bộ Công an luôn viết "so với cùng kỳ năm trước", không phải
 * "so với tháng trước".
 */

export type LoaiKyChon = 'NAM' | 'THANG' | 'QUY' | 'LUY_KE' | 'TUY_CHON';
export type KieuSoSanhChon = 'CUNG_KY_NAM_TRUOC' | 'KY_LIEN_TRUOC' | 'TUY_CHON' | 'KHONG';

export interface KyDangChon {
  loai: LoaiKyChon;
  /** Tháng 1-12 hoặc quý 1-4, tuỳ `loai`. */
  so?: number;
  tu?: string;
  den?: string;
}

export interface NenDangChon {
  kieu: KieuSoSanhChon;
  nenTu?: string;
  nenDen?: string;
}

const SO_LA_MA = ['I', 'II', 'III', 'IV'];

interface Props {
  nam: number;
  /** `'thang'` cho báo cáo tháng, `'quy'` cho báo cáo quý — quyết định ô chọn kỳ con. */
  don: 'thang' | 'quy';
  ky: KyDangChon;
  nen: NenDangChon;
  onDoiKy(ky: KyDangChon): void;
  onDoiNen(nen: NenDangChon): void;
}

export function ChonKyBaoCao({ nam, don, ky, nen, onDoiKy, onDoiNen }: Props) {
  const idKy = useId();
  const idNen = useId();

  /** Một giá trị chuỗi cho ô chọn kỳ, để `<select>` không phải giữ hai mẩu trạng thái. */
  const giaTriKy =
    ky.loai === 'NAM'
      ? 'NAM'
      : ky.loai === 'TUY_CHON'
        ? 'TUY_CHON'
        : `${ky.loai}:${ky.so ?? 1}`;

  function doiKy(v: string) {
    if (v === 'NAM') return onDoiKy({ loai: 'NAM' });
    if (v === 'TUY_CHON') return onDoiKy({ loai: 'TUY_CHON', tu: ky.tu, den: ky.den });
    const [loai, so] = v.split(':');
    onDoiKy({ loai: loai as LoaiKyChon, so: Number(so) });
  }

  const oNgay =
    'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973]';

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="chon-ky-bao-cao">
      <div className="flex items-center gap-2">
        <label htmlFor={idKy} className="text-sm text-slate-600">
          Kỳ
        </label>
        <select
          id={idKy}
          data-testid="chon-ky"
          value={giaTriKy}
          onChange={(e) => doiKy(e.target.value)}
          className={oNgay}
        >
          <option value="NAM">Cả năm {nam}</option>
          {don === 'thang'
            ? Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={`t${m}`} value={`THANG:${m}`}>
                  Tháng {m}/{nam}
                </option>
              ))
            : SO_LA_MA.map((la, i) => (
                <option key={`q${la}`} value={`QUY:${i + 1}`}>
                  Quý {la}/{nam}
                </option>
              ))}
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={`lk${m}`} value={`LUY_KE:${m}`}>
              Lũy kế {m} tháng đầu năm {nam}
            </option>
          ))}
          <option value="TUY_CHON">Khoảng tự chọn…</option>
        </select>
      </div>

      {ky.loai === 'TUY_CHON' && (
        <div className="flex items-center gap-2" data-testid="khoang-ky">
          <input
            type="date"
            aria-label="Kỳ — từ ngày"
            data-testid="ky-tu"
            value={ky.tu ?? ''}
            onChange={(e) => onDoiKy({ ...ky, tu: e.target.value })}
            className={oNgay}
          />
          <span className="text-slate-400">–</span>
          <input
            type="date"
            aria-label="Kỳ — đến ngày"
            data-testid="ky-den"
            value={ky.den ?? ''}
            onChange={(e) => onDoiKy({ ...ky, den: e.target.value })}
            className={oNgay}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <label htmlFor={idNen} className="text-sm text-slate-600">
          So với
        </label>
        <select
          id={idNen}
          data-testid="chon-nen"
          value={nen.kieu}
          onChange={(e) => onDoiNen({ ...nen, kieu: e.target.value as KieuSoSanhChon })}
          className={oNgay}
        >
          <option value="CUNG_KY_NAM_TRUOC">Cùng kỳ năm trước</option>
          <option value="KY_LIEN_TRUOC">Kỳ liền trước</option>
          <option value="TUY_CHON">Khoảng tự chọn…</option>
          <option value="KHONG">Không so sánh</option>
        </select>
      </div>

      {nen.kieu === 'TUY_CHON' && (
        <div className="flex items-center gap-2" data-testid="khoang-nen">
          <input
            type="date"
            aria-label="Nền so sánh — từ ngày"
            data-testid="nen-tu"
            value={nen.nenTu ?? ''}
            onChange={(e) => onDoiNen({ ...nen, nenTu: e.target.value })}
            className={oNgay}
          />
          <span className="text-slate-400">–</span>
          <input
            type="date"
            aria-label="Nền so sánh — đến ngày"
            data-testid="nen-den"
            value={nen.nenDen ?? ''}
            onChange={(e) => onDoiNen({ ...nen, nenDen: e.target.value })}
            className={oNgay}
          />
        </div>
      )}
    </div>
  );
}
