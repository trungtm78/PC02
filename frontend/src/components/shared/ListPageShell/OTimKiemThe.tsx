import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { A11Y_FOCUS_RING } from "@/constants/styles";
import { Fragment } from "react";
import { khopKhongDau } from "@/lib/bo-dau";
import {
  KHOA_TAT_CA,
  laGiaTriNgay,
  theHopLe,
  type The,
  type TruongTimKiem,
} from "@/shared/tim-kiem/the";

export interface GiaTriChon {
  value: string;
  label: string;
}

type BangGiaTriChon = Readonly<Record<string, readonly GiaTriChon[]>>;

export interface OTimKiemTheProps {
  the: readonly The[];
  /** Cột gợi ý — CỘT ĐANG HIỂN THỊ có tìm được, đúng thứ tự trên bảng. */
  truong: readonly TruongTimKiem[];
  /** Mọi trường của thực thể: đặt nhãn cho thẻ (kể cả cột đang ẩn) và nhận ra khoá lạ. */
  khai: readonly TruongTimKiem[];
  /** Giá trị của các cột kiểu `chon` (trạng thái…): thẻ gửi `value`, hiện `label`. */
  giaTriChon?: BangGiaTriChon;
  /** Trả `false` khi không nhận (trùng, quá giới hạn) — ô giữ nguyên chữ. */
  onThem(khoa: string, giaTri: string): boolean;
  onBoThe(khoa: string): void;
  onBoGiaTri(khoa: string, giaTri: string): void;
  placeholder?: string;
  /** Lý do thẻ đỏ — màn tự nói đúng lý do của mình (vd Tổng hợp: chưa chọn loại hồ sơ). */
  lyDoKhongHopLe?: string;
}

interface LuaChon {
  khoa: string;
  giaTri: string;
  nhan: string;
  tat?: boolean;
  /** Dòng đầu của nhóm "Cột khác" — chỗ chèn tiêu đề nhóm khi dựng. */
  moNhomKhac?: boolean;
}

const SO_GIA_TRI_CHON_TOI_DA = 8;
/**
 * Trần số dòng gợi ý.
 *
 * Đơn thư sắp có ~20 trường tìm được (6 thẻ ngày mới + các cột đang ẩn). Đổ hết ra là một danh
 * sách không đọc nổi và phải cuộn. Vượt trần thì cắt và chỉ đường sang cú pháp `tên cột:`.
 */
const TRAN_GOI_Y = 12;
const KHONG_CO_GIA_TRI_CHON: BangGiaTriChon = {};
const LY_DO_MAC_DINH = "Cột không còn tìm được";

function laOGo(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
  );
}

interface DanhSachTheProps {
  the: readonly The[];
  khai: readonly TruongTimKiem[];
  giaTriChon?: BangGiaTriChon;
  onBoThe(khoa: string): void;
  /** Có thì bấm vào thẻ để sửa; không có (vd ở trạng thái rỗng) thẻ chỉ bỏ được. */
  onSua?(t: The): void;
  lyDoKhongHopLe?: string;
}

/**
 * Các thẻ đang áp. Dùng chung cho ô tìm kiếm và trạng thái "không tìm thấy" — hai nơi hiện CÙNG
 * một bộ thẻ thì phải cùng nhãn, không để một nơi ghi "Người gửi" một nơi ghi `nguoiGui`.
 */
export function DanhSachThe({
  the,
  khai,
  giaTriChon = KHONG_CO_GIA_TRI_CHON,
  onBoThe,
  onSua,
  lyDoKhongHopLe = LY_DO_MAC_DINH,
}: DanhSachTheProps) {
  const nhanTruong = (khoa: string) =>
    khoa === KHOA_TAT_CA
      ? "Tất cả các cột"
      : (khai.find((t) => t.key === khoa)?.nhan ?? khoa);
  const nhanGiaTri = (khoa: string, v: string) =>
    giaTriChon[khoa]?.find((g) => g.value === v)?.label ?? v;

  return (
    <>
      {the.map((t) => {
        const hopLe = theHopLe(t, khai, giaTriChon);
        const nhan = nhanTruong(t.khoa);
        const giaTri = t.giaTri
          .map((v) => nhanGiaTri(t.khoa, v))
          .join(" hoặc ");
        const noiDung = (
          <>
            <span className="font-semibold">{nhan}:</span> {giaTri}
            {!hopLe && <span> — {lyDoKhongHopLe}</span>}
          </>
        );
        const lopNoiDung = "px-2 py-0.5 truncate max-w-[20rem] text-left";
        return (
          <span
            key={t.khoa}
            data-testid="the-tim-kiem"
            data-khoa={t.khoa}
            data-hop-le={String(hopLe)}
            title={`${nhan}: ${giaTri}`}
            className={`inline-flex items-center max-w-full rounded text-xs ${
              hopLe
                ? "bg-blue-50 text-blue-800 border border-blue-200"
                : "bg-red-50 text-red-700 border border-red-300"
            }`}
          >
            {onSua ? (
              <button
                type="button"
                aria-label={
                  hopLe
                    ? `Sửa thẻ ${nhan}`
                    : `Sửa thẻ ${nhan} (${lyDoKhongHopLe})`
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onSua(t);
                }}
                className={`${lopNoiDung} ${A11Y_FOCUS_RING}`}
              >
                {noiDung}
              </button>
            ) : (
              <span className={lopNoiDung}>{noiDung}</span>
            )}
            <button
              type="button"
              aria-label={`Bỏ thẻ ${nhan}`}
              onClick={(e) => {
                e.stopPropagation();
                onBoThe(t.khoa);
              }}
              className={`px-1 py-0.5 hover:bg-white/60 rounded-r ${A11Y_FOCUS_RING}`}
            >
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          </span>
        );
      })}
    </>
  );
}

/**
 * Ô tìm kiếm dạng thẻ (kiểu Odoo): gõ chữ, chọn cột trong danh sách gợi ý, thành thẻ. Cùng cột
 * gộp một thẻ "a hoặc b"; khác cột thu hẹp kết quả.
 *
 * Chữ đang gõ là state RIÊNG của ô, chỉ lên địa chỉ trang khi chọn xong — nên không vướng lỗi
 * "tiếng vọng" của ô gắn thẳng URL (`useOChuDongBo`). Enter lúc bộ gõ đang ghép chữ bị bỏ qua.
 */
export function OTimKiemThe({
  the,
  truong,
  khai,
  giaTriChon = KHONG_CO_GIA_TRI_CHON,
  onThem,
  onBoThe,
  onBoGiaTri,
  placeholder = "Tìm kiếm…",
  lyDoKhongHopLe,
}: OTimKiemTheProps) {
  const [chu, setChu] = useState("");
  const [mo, setMo] = useState(false);
  const [moRong, setMoRong] = useState(false);
  const [idx, setIdx] = useState<number | null>(null);
  const [uuTienKhoa, setUuTienKhoa] = useState<string | null>(null);
  const dangGhep = useRef(false);
  const oRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = chu.trim();

  /**
   * Đang sửa một thẻ mà cột của nó không nằm trong gợi ý (cột đang ẩn, hoặc thẻ đến từ đường dẫn cũ):
   * đưa trường ấy lên đầu, nếu không Enter rơi vào "tất cả các cột" và thẻ âm thầm đổi phạm vi.
   */
  const truongGoi = useMemo<readonly TruongTimKiem[]>(() => {
    if (!uuTienKhoa || truong.some((t) => t.key === uuTienKhoa)) return truong;
    const dangSua = khai.find((t) => t.key === uuTienKhoa);
    return dangSua ? [dangSua, ...truong] : truong;
  }, [uuTienKhoa, truong, khai]);

  /**
   * Cú pháp `tên cột:giá trị` — cách duy nhất với tới ~20 trường mà không phải cuộn.
   *
   * Chỉ bật khi phần trước dấu hai chấm KHỚP ít nhất một trường. Nhờ thế chuỗi có dấu hai chấm
   * vì lý do khác (`15/12/2026 10:30`) rơi về đường thường thay vì bị hiểu thành tên cột.
   */
  const locTheoTen = useMemo(() => {
    const vt = q.indexOf(":");
    if (vt <= 0) return null;
    const ten = q.slice(0, vt).trim();
    const giaTri = q.slice(vt + 1).trim();
    if (!ten || !giaTri) return null;
    const khop = khai.filter((t) => khopKhongDau(t.nhan, ten));
    return khop.length ? { khop, giaTri } : null;
  }, [q, khai]);

  const luaChon = useMemo<LuaChon[]>(() => {
    const ds: LuaChon[] = [];
    const themGiaTriChon = (t: TruongTimKiem, loc: string) => {
      const khop = (giaTriChon[t.key] ?? []).filter((g) =>
        khopKhongDau(g.label, loc),
      );
      for (const g of khop.slice(0, SO_GIA_TRI_CHON_TOI_DA)) {
        ds.push({
          khoa: t.key,
          giaTri: g.value,
          nhan: `${t.nhan}: ${g.label}`,
        });
      }
    };
    if (!q) {
      if (moRong)
        for (const t of truongGoi) if (t.kieu === "chon") themGiaTriChon(t, "");
      return ds;
    }

    const giaTri = locTheoTen?.giaTri ?? q;
    const laNgay = laGiaTriNgay(giaTri);

    /** Dựng dòng cho một nhóm trường; trả về số dòng CHỌN ĐƯỢC đã thêm. */
    const themNhom = (ds2: LuaChon[], truongs: readonly TruongTimKiem[]) => {
      for (const t of truongs) {
        if (t.kieu === "chon") themGiaTriChon(t, giaTri);
        // Cột ngày mà chữ không phải ngày: KHÔNG dựng dòng riêng — một dòng hướng dẫn chung ở
        // cuối là đủ. Chín cột ngày × một dòng giống hệt nhau là chín dòng rác.
        else if (t.kieu === "ngay" && !laNgay) continue;
        else
          ds2.push({ khoa: t.key, giaTri, nhan: `Tìm ${t.nhan}: "${giaTri}"` });
      }
    };

    const themTatCa = () =>
      ds.push({
        khoa: KHOA_TAT_CA,
        giaTri,
        nhan: `Tìm trong tất cả các cột: "${giaTri}"`,
      });

    if (locTheoTen) {
      /*
        Đã nói rõ tên cột thì cột ấy đứng TRƯỚC và "tất cả các cột" lùi xuống cuối: Enter phải
        rơi vào đúng thứ cán bộ vừa gõ tên, không rơi vào phạm vi rộng hơn.
        Không chia nhóm, không cắt trần.
      */
      themNhom(ds, locTheoTen.khop);
      themTatCa();
      return ds;
    }

    themTatCa();

    const hien = truongGoi;
    const khoaHien = new Set(hien.map((t) => t.key));
    const an = khai.filter((t) => !khoaHien.has(t.key));

    themNhom(ds, hien);
    const truocKhac = ds.length;
    themNhom(ds, an);
    if (ds.length > truocKhac) ds[truocKhac].moNhomKhac = true;

    // Một dòng hướng dẫn CHUNG cho mọi cột ngày, thay cho mỗi cột một dòng.
    if (!laNgay && [...hien, ...an].some((t) => t.kieu === "ngay")) {
      ds.push({
        khoa: "",
        giaTri,
        nhan: "Tìm theo ngày: gõ 12/09/2026 · 09/2026 · 2026",
        tat: true,
      });
    }

    if (ds.length <= TRAN_GOI_Y) return ds;
    const cat = ds.slice(0, TRAN_GOI_Y);
    cat.push({
      khoa: "",
      giaTri,
      nhan: `… còn ${ds.length - TRAN_GOI_Y} cột khác — gõ "tên cột:${giaTri}" để chọn`,
      tat: true,
    });
    return cat;
  }, [q, moRong, truongGoi, giaTriChon, khai, locTheoTen]);

  const macDinh = Math.max(
    0,
    luaChon.findIndex((l) => l.khoa === uuTienKhoa && !l.tat),
  );
  const dangChon = idx ?? macDinh;
  const hienDanhSach = mo && luaChon.length > 0;

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (
        e.key !== "/" ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        laOGo(e.target)
      )
        return;
      e.preventDefault();
      oRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const dong = () => {
    setMo(false);
    setMoRong(false);
    setIdx(null);
  };

  const chon = (l: LuaChon) => {
    if (l.tat || !onThem(l.khoa, l.giaTri)) return;
    setChu("");
    setUuTienKhoa(null);
    dong();
  };

  const buoc = (huong: 1 | -1) => {
    const n = luaChon.length;
    let i = dangChon;
    for (let lan = 0; lan < n; lan++) {
      i = (i + huong + n) % n;
      if (!luaChon[i].tat) break;
    }
    setIdx(i);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        if (!hienDanhSach) {
          setMo(true);
          if (!q) setMoRong(true);
          return;
        }
        buoc(e.key === "ArrowDown" ? 1 : -1);
        return;
      case "Enter": {
        if (e.nativeEvent.isComposing || e.keyCode === 229 || dangGhep.current)
          return;
        e.preventDefault();
        const l = hienDanhSach ? luaChon[dangChon] : undefined;
        if (l) chon(l);
        else if (q) chon({ khoa: KHOA_TAT_CA, giaTri: q, nhan: "" });
        return;
      }
      case "Escape":
        dong();
        return;
      case "Backspace": {
        const cuoi = the[the.length - 1];
        if (chu === "" && cuoi)
          onBoGiaTri(cuoi.khoa, cuoi.giaTri[cuoi.giaTri.length - 1]);
        return;
      }
    }
  };

  const sua = (t: The) => {
    const v = t.giaTri[t.giaTri.length - 1];
    onBoGiaTri(t.khoa, v);
    // Giá trị cột chọn là MÃ; đưa mã về ô chữ thì cán bộ không đọc được — để trống, mở danh sách.
    setChu(giaTriChon[t.khoa] ? "" : v);
    setMoRong(Boolean(giaTriChon[t.khoa]));
    setUuTienKhoa(t.khoa);
    setIdx(null);
    setMo(true);
    oRef.current?.focus();
  };

  const idLuaChon = (i: number) => `${listId}-${i}`;

  return (
    <div className="relative" data-testid="o-tim-kiem-the">
      <div
        className="flex flex-wrap items-center gap-1.5 w-full min-h-[2.5rem] pl-9 pr-2 py-1 border border-slate-300 rounded bg-white focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent"
        onClick={() => oRef.current?.focus()}
      >
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          aria-hidden="true"
        />
        <DanhSachThe
          the={the}
          khai={khai}
          giaTriChon={giaTriChon}
          onBoThe={onBoThe}
          onSua={sua}
          lyDoKhongHopLe={lyDoKhongHopLe}
        />
        <input
          ref={oRef}
          type="text"
          role="combobox"
          aria-label="Tìm kiếm trong danh sách"
          aria-expanded={hienDanhSach}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={hienDanhSach ? idLuaChon(dangChon) : undefined}
          autoComplete="off"
          value={chu}
          placeholder={the.length === 0 ? placeholder : ""}
          onChange={(e) => {
            setChu(e.target.value);
            setIdx(null);
            setMoRong(false);
            setMo(e.target.value.trim() !== "");
          }}
          onCompositionStart={() => {
            dangGhep.current = true;
          }}
          onCompositionEnd={() => {
            dangGhep.current = false;
          }}
          onKeyDown={onKeyDown}
          onBlur={dong}
          className="flex-1 min-w-[10rem] py-1 text-sm bg-transparent outline-none"
        />
      </div>
      {hienDanhSach && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <ul
            id={listId}
            role="listbox"
            aria-label="Gợi ý tìm kiếm"
            className="max-h-80 overflow-y-auto py-1"
            onMouseDown={(e) => e.preventDefault()}
          >
            {luaChon.map((l, i) => (
              <Fragment key={`${l.khoa}~${l.giaTri}~${i}`}>
                {/*
                  Tiêu đề nhóm là `role="presentation"`, KHÔNG phải `option`: bàn phím ↑/↓ và
                  trình đọc màn hình chỉ được đi qua thứ chọn được.
                */}
                {l.moNhomKhac && (
                  <li
                    role="presentation"
                    className="px-3 pt-2 pb-1 text-xs font-medium text-slate-500 border-t border-slate-100"
                  >
                    Cột khác (đang ẩn trên bảng)
                  </li>
                )}
                <li
                  id={idLuaChon(i)}
                  role="option"
                  aria-selected={i === dangChon}
                  aria-disabled={l.tat || undefined}
                  onMouseEnter={() => !l.tat && setIdx(i)}
                  onClick={() => chon(l)}
                  className={`px-3 py-1.5 text-sm truncate ${
                    l.tat
                      ? "text-slate-400 cursor-default"
                      : i === dangChon
                        ? "bg-blue-50 text-blue-900 cursor-pointer"
                        : "text-slate-700 cursor-pointer"
                  }`}
                >
                  {l.nhan}
                </li>
              </Fragment>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
