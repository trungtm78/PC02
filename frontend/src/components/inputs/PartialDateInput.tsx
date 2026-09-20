import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { LABEL_BASE, FIELD_ERROR_TEXT } from "@/constants/styles";
import {
  loiNgayTungPhan,
  sangEdtf,
  tuEdtf,
  type NgayTungPhan,
} from "@/shared/ngay-thieu/edtf";

/**
 * Ô ngày cho phép THIẾU thành phần — `__/12/2026`, `__/__/2026`.
 *
 * BA Ô PHÂN ĐOẠN trong một `fieldset`, không phải một ô chữ có mặt nạ.
 *
 * Đây là điểm quyết định, không phải chuyện hình thức: với ô mặt nạ, "để trống ngày" là một
 * ca biên — cán bộ phải rà con trỏ qua đúng hai ký tự rồi xoá, và mọi thao tác Backspace/dán
 * đều phải tự quản lý vị trí. Với ba ô, bỏ trống ô ấy LÀ xong. Đó cũng là khuyến nghị của
 * NN/g và UX Patterns for Developers cho ô ngày gõ tay.
 *
 * Giá trị đối ngoại là chuỗi EDTF (`2026-12-XX`) — xem `shared/ngay-thieu/edtf.ts`.
 */
interface Props {
  label: string;
  /** Chuỗi EDTF, hoặc null khi trống. */
  value: string | null;
  onChange: (edtf: string | null) => void;
  required?: boolean;
  error?: string;
  testId?: string;
}

const DAI: Record<keyof NgayTungPhan, number> = { ngay: 2, thang: 2, nam: 4 };
const NHAN: Record<keyof NgayTungPhan, string> = {
  ngay: "Ngày",
  thang: "Tháng",
  nam: "Năm",
};
const THU_TU: (keyof NgayTungPhan)[] = ["ngay", "thang", "nam"];

export function PartialDateInput({
  label,
  value,
  onChange,
  required,
  error,
  testId,
}: Props) {
  /**
   * BA Ô giữ trạng thái RIÊNG, không suy lại từ `value` mỗi lần dựng.
   *
   * EDTF không biểu diễn được trạng thái gõ dở "ngày 15, chưa có năm" (năm là phần bắt buộc
   * của chuỗi). Nếu ô đọc thẳng từ `value` thì cán bộ gõ ngày → tháng → năm sẽ thấy ngày và
   * tháng BIẾN MẤT, vì hai bước đầu báo lên `null` rồi `value` xoá sạch.
   */
  const [phan, setPhan] = useState<NgayTungPhan>(() => tuEdtf(value));
  const oRef = useRef<Record<string, HTMLInputElement | null>>({});

  // Đồng bộ khi `value` đổi từ BÊN NGOÀI (nạp hồ sơ, đặt lại form) — so bằng chuỗi EDTF nên
  // không đè lên thứ đang gõ dở.
  /*
    Chỉnh trạng thái NGAY TRONG LƯỢT DỰNG khi `value` đổi từ bên ngoài — mẫu chính thức của
    React ("You Might Not Need an Effect — Adjusting some state when a prop changes"). Không
    dùng effect vì effect buộc phải khai `phan` là phụ thuộc, mà khai vào thì mỗi chữ số gõ
    ra lại kéo ô về `value` cũ, xoá sạch thứ đang gõ dở.
  */
  const [valueTruoc, setValueTruoc] = useState(value);
  if (value !== valueTruoc) {
    setValueTruoc(value);
    if (sangEdtf(phan) !== (value ?? null)) setPhan(tuEdtf(value));
  }

  const loiRapLai = loiNgayTungPhan(phan);

  const nhay = (tu: keyof NgayTungPhan, buoc: 1 | -1) => {
    const i = THU_TU.indexOf(tu) + buoc;
    if (i >= 0 && i < THU_TU.length) oRef.current[THU_TU[i]]?.focus();
  };

  const bao = (moi: NgayTungPhan) => {
    setPhan(moi);
    onChange(sangEdtf(moi));
  };

  const doi = (tu: keyof NgayTungPhan, chu: string) => {
    // Chỉ nhận chữ số: ô ngày mà gõ được chữ cái thì mọi luật bên dưới phải tự đỡ chuỗi rác.
    const so = chu.replace(/\D/g, "").slice(0, DAI[tu]);
    bao({ ...phan, [tu]: so });
    if (so.length === DAI[tu]) nhay(tu, 1);
  };

  const phim = (tu: keyof NgayTungPhan, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !phan[tu]) {
      e.preventDefault();
      nhay(tu, -1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      nhay(tu, -1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nhay(tu, 1);
    }
  };

  /** Dán "15/12/2026" (hoặc "15-12-2026") vào bất kỳ ô nào → tách ra ba ô. */
  const dan = (e: ClipboardEvent<HTMLInputElement>) => {
    const chu = e.clipboardData?.getData("text") ?? "";
    const m = /(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})/.exec(chu);
    if (!m) return;
    e.preventDefault();
    bao({ ngay: m[1], thang: m[2], nam: m[3] });
  };

  const loiHien = error ?? loiRapLai ?? undefined;

  return (
    <fieldset className="min-w-0" data-testid={testId}>
      <legend className={LABEL_BASE}>
        {label} {required && <span className="text-red-500">*</span>}
      </legend>
      <div className="flex items-center gap-1">
        {THU_TU.map((tu, i) => (
          <span key={tu} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-400">/</span>}
            <input
              ref={(el) => {
                oRef.current[tu] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label={`${NHAN[tu]} (${label})`}
              aria-invalid={loiHien ? true : undefined}
              placeholder={"_".repeat(DAI[tu])}
              value={phan[tu]}
              onChange={(e) => doi(tu, e.target.value)}
              onKeyDown={(e) => phim(tu, e)}
              onPaste={dan}
              /*
                `font-mono` + `tabular-nums`: chữ số cùng bề rộng nên ba ô không giật khi gõ —
                đúng thứ `DateCell` đã dùng cho mọi cột ngày (DESIGN.md §11.5).
              */
              className={`px-2 py-2.5 text-sm text-center font-mono tabular-nums border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                loiHien ? "border-red-300" : "border-slate-300"
              } ${tu === "nam" ? "w-16" : "w-12"}`}
              data-testid={testId ? `${testId}-${tu}` : undefined}
            />
          </span>
        ))}
      </div>
      {loiHien && (
        <p className={FIELD_ERROR_TEXT} data-testid={testId ? `${testId}-loi` : undefined}>
          {loiHien}
        </p>
      )}
    </fieldset>
  );
}
