import { useId, useState } from "react";
import { LABEL_BASE, FIELD_ERROR_TEXT } from "@/constants/styles";
import {
  hienThiEdtf,
  loiNgayTungPhan,
  sangEdtf,
  tuChuNhapTay,
} from "@/shared/ngay-thieu/edtf";

/**
 * Ô ngày cho phép THIẾU thành phần — `__/12/2026`, `__/__/2026`.
 *
 * MỘT Ô CHỮ, không phải ba ô phân đoạn.
 *
 * Bản đầu (19/09/2026) dùng ba ô, theo khuyến nghị của NN/g và UX Patterns for Developers cho
 * ô ngày gõ tay: với ba ô, "để trống ngày" là bỏ trống một ô chứ không phải rà con trỏ qua
 * đúng hai ký tự rồi xoá. Lý do ấy vẫn đúng — nhưng nó cân một thao tác HIẾM (bỏ trống) lên
 * trên thao tác THƯỜNG XUYÊN, và anh chỉ ra điều đó sau một ngày dùng thật: cán bộ chép ngày
 * từ đơn giấy hoặc từ Word và muốn DÁN MỘT LẦN. Ba ô buộc phải dán vào ô này rồi Tab sang ô
 * kia, hoặc trông chờ vào luật tách chuỗi lúc dán.
 *
 * Đổi sang một ô thì ba thứ phải giữ NGUYÊN, không được rơi cái nào:
 *   1. Nhập thiếu vẫn lưu được — `12/2026`, `2026`.
 *   2. Không bao giờ bịa ngày mồng 1 — thiếu ngày thì cột ngày thật để trống.
 *   3. `31/02/2026` bị chặn TẠI CHỖ, không để máy chủ trả 400.
 *
 * Phần "đọc chữ" nằm ở `tuChuNhapTay`, phần "kiểm" vẫn là `loiNgayTungPhan` cũ — component này
 * không tự khai một luật ngày nào.
 *
 * Giá trị đối ngoại vẫn là chuỗi EDTF (`2026-12-XX`) — xem `shared/ngay-thieu/edtf.ts`.
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

export function PartialDateInput({
  label,
  value,
  onChange,
  required,
  error,
  testId,
}: Props) {
  /**
   * Giữ CHỮ THÔ, không suy lại từ `value` mỗi lần dựng.
   *
   * EDTF không biểu diễn được trạng thái gõ dở — `15/12/20` chưa ra chuỗi nào cả. Ô mà đọc
   * thẳng từ `value` thì cán bộ gõ tới đâu chữ biến mất tới đó.
   */
  const [chu, setChu] = useState(() => hienThiEdtf(value));

  /**
   * Chỉ mắng SAU KHI rời ô — và mỗi lần gõ tiếp lại thôi mắng cho tới lần rời ô kế.
   *
   * Báo ngay lúc đang gõ thì `15/12/20` bị gạch đỏ giữa chừng, trong khi người ta mới gõ được
   * một nửa cái năm. Bấm Lưu cũng làm ô mất tiêu điểm nên lỗi hiện đúng lúc cần.
   *
   * Phần "gõ tiếp thì thôi mắng" là nửa còn lại, và là nửa dễ quên: giữ cờ này bật vĩnh viễn
   * thì lần gõ ĐẦU tránh được gạch đỏ giữa chừng, còn lần SỬA LẠI thì không — mà lần sửa lại
   * mới là lúc người ta đang bối rối nhất.
   */
  const [daRoiO, setDaRoiO] = useState(false);

  // Nhãn phải gắn được vào ô kể cả khi nơi gọi không truyền `testId`; nếu không thì `htmlFor`
  // và `id` cùng thành `undefined`, nhãn mồ côi, và không cổng nào bắt được.
  const idTuSinh = useId();
  const idO = testId ?? idTuSinh;
  const idLoi = `${idO}-loi-mo-ta`;

  /*
    Chỉnh trạng thái NGAY TRONG LƯỢT DỰNG khi `value` đổi từ bên ngoài (nạp hồ sơ, đặt lại
    form) — mẫu chính thức của React ("You Might Not Need an Effect — Adjusting some state when
    a prop changes"). So bằng chuỗi EDTF chứ không so chữ, nên không đè lên thứ đang gõ dở.
  */
  const [valueTruoc, setValueTruoc] = useState(value);
  if (value !== valueTruoc) {
    setValueTruoc(value);
    if (sangEdtf(tuChuNhapTay(chu)) !== (value ?? null)) {
      setChu(hienThiEdtf(value));
      setDaRoiO(false);
    }
  }

  const loiTaiCho = loiNgayTungPhan(tuChuNhapTay(chu));
  const loiHien = error ?? (daRoiO ? (loiTaiCho ?? undefined) : undefined);

  const doi = (moi: string) => {
    setChu(moi);
    setDaRoiO(false);
    // Đẩy lên NGAY mỗi lần gõ, không chờ rời ô: bấm Lưu bằng phím tắt không đi qua `blur`, và
    // chờ tới đó thì ký tự cuối cùng không kịp vào form.
    onChange(sangEdtf(tuChuNhapTay(moi)));
  };

  return (
    <div className="min-w-0">
      <label className={LABEL_BASE} htmlFor={idO}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={idO}
        type="text"
        /*
          KHÔNG `inputMode="numeric"`: bàn phím số trên điện thoại không có `/` `.` `-`, nên ô
          in ra `__/12/2026` mà cán bộ dùng điện thoại không gõ lại được chính nó. Hệ có bản
          điện thoại (v0.46) nên đây là đường thật, không phải ca giả định. Gõ dãy số liền
          (`15122026`) vẫn chạy, nên bàn phím đầy đủ chỉ thêm khả năng chứ không bớt gì.
        */
        autoComplete="off"
        aria-invalid={loiHien ? true : undefined}
        aria-describedby={loiHien ? idLoi : undefined}
        placeholder="15/12/2026 · 12/2026 · 2026"
        value={chu}
        onChange={(e) => doi(e.target.value)}
        onBlur={() => setDaRoiO(true)}
        /*
          `font-mono` + `tabular-nums`: chữ số cùng bề rộng nên ô không giật khi gõ — đúng thứ
          `DateCell` đã dùng cho mọi cột ngày (DESIGN.md §11.5).
        */
        className={`w-full px-4 py-2.5 text-sm font-mono tabular-nums border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          loiHien ? "border-red-300" : "border-slate-300"
        }`}
        data-testid={testId}
      />
      {loiHien && (
        <p
          id={idLoi}
          role="alert"
          className={FIELD_ERROR_TEXT}
          data-testid={testId ? `${testId}-loi` : undefined}
        >
          {loiHien}
        </p>
      )}
    </div>
  );
}
