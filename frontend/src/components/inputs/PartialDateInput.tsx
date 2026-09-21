import { useId, useState } from "react";
import { LABEL_BASE, FIELD_ERROR_TEXT } from "@/constants/styles";
import {
  hienThiEdtf,
  loiNgayTungPhan,
  sangEdtf,
  tuChuNhapTay,
} from "@/shared/ngay-thieu/edtf";
import {
  docNgayVietDon,
  type NgayVietDonDaDoc,
} from "@/shared/ngay-thieu/ngay-viet-don";

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
  /**
   * Cho gõ CHỮ TỰ DO — ô thôi chặn, giữ nguyên văn, và nói ra hệ hiểu được gì.
   *
   * Bật cho ô "Ngày viết đơn": đo prod 21/09/2026 có 4.454/46.129 hồ sơ mang giá trị không đọc
   * ra được một ngày, vì đây là hồ sơ GỘP nhiều đơn ("19/4/2021 (03 đơn), 20/4/2021 (9 đơn),
   * …") hoặc ghi chú ("Không ghi ngày"). Cán bộ gõ đúng dạng ấy thì bị mắng "Năm phải đủ 4 chữ
   * số" trong khi năm đã đủ bốn chữ số.
   *
   * TẮT là mặc định: mọi ô ngày khác vẫn chặn như cũ. Mở rộng ô sẵn có chứ không dựng ô thứ
   * hai — hai ô ngày song song cho cùng một việc là lỗi đã phải gỡ ở PR #233.
   */
  chuTuDo?: boolean;
  /** Chế độ `chuTuDo`: chữ nguyên văn đã lưu, để mở hồ sơ cũ ra thấy ĐÚNG chữ ấy. */
  valueChu?: string | null;
  /** Chế độ `chuTuDo`: kết quả đọc đầy đủ (ngày thật + EDTF + nguyên văn + câu giải thích). */
  onDoc?: (ra: NgayVietDonDaDoc) => void;
}

export function PartialDateInput({
  label,
  value,
  onChange,
  required,
  error,
  testId,
  chuTuDo,
  valueChu,
  onDoc,
}: Props) {
  /**
   * Giữ CHỮ THÔ, không suy lại từ `value` mỗi lần dựng.
   *
   * EDTF không biểu diễn được trạng thái gõ dở — `15/12/20` chưa ra chuỗi nào cả. Ô mà đọc
   * thẳng từ `value` thì cán bộ gõ tới đâu chữ biến mất tới đó.
   */
  const [chu, setChu] = useState(() =>
    chuTuDo && valueChu ? valueChu : hienThiEdtf(value),
  );

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
    if (chuTuDo) {
      // Chế độ chữ tự do: bản nguyên văn mới là nguồn, EDTF chỉ là thứ suy ra từ nó.
      const moi = valueChu || hienThiEdtf(value);
      if (moi !== chu) {
        setChu(moi);
        setDaRoiO(false);
      }
    } else if (sangEdtf(tuChuNhapTay(chu)) !== (value ?? null)) {
      setChu(hienThiEdtf(value));
      setDaRoiO(false);
    }
  }

  /*
    Chế độ chữ tự do KHÔNG mắng: chữ không đọc ra ngày vẫn là dữ liệu hợp lệ, và chặn nó chính
    là con lỗi phải vá. Thay vào đó `hieuLa` nói ra hệ hiểu được gì — đọc thầm rồi giữ một phần
    là lớp mất-im-lặng đã phải vá HAI lần ở chính ô này.
  */
  const daDoc = chuTuDo ? docNgayVietDon(chu) : null;
  const loiTaiCho = chuTuDo ? null : loiNgayTungPhan(tuChuNhapTay(chu));
  const loiHien = error ?? (daRoiO ? (loiTaiCho ?? undefined) : undefined);
  const hieuLa = daDoc?.hieuLa || '';

  const doi = (moi: string) => {
    setChu(moi);
    setDaRoiO(false);
    // Đẩy lên NGAY mỗi lần gõ, không chờ rời ô: bấm Lưu bằng phím tắt không đi qua `blur`, và
    // chờ tới đó thì ký tự cuối cùng không kịp vào form.
    if (chuTuDo) {
      const ra = docNgayVietDon(moi);
      onDoc?.(ra);
      onChange(ra.edtf);
      return;
    }
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
      {/*
        Câu "hệ hiểu được gì" — KHÔNG phải lỗi, nên không `role="alert"`, không màu đỏ.

        Nó tồn tại vì chế độ chữ tự do giữ nguyên văn NHƯNG vẫn cố đọc ra một ngày để hồ sơ còn
        lọc được. Đọc thầm là đúng lớp mất-im-lặng đã phải vá hai lần ở chính ô này, nên phần
        hệ hiểu được phải hiện ra cho cán bộ đối chiếu.
      */}
      {!loiHien && hieuLa && (
        <p
          className="mt-1 text-xs text-slate-500"
          data-testid={testId ? `${testId}-hieu-la` : undefined}
        >
          {hieuLa}
        </p>
      )}
    </div>
  );
}
