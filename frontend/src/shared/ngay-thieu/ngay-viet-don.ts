import {
  hienThiEdtf,
  loiNgayTungPhan,
  sangEdtf,
  sangNgayDayDu,
  tuChuNhapTay,
} from './edtf';

/**
 * Đọc ô "Ngày viết đơn" — MỘT bộ đọc dùng chung cho Đơn thư, Vụ việc, Vụ án.
 *
 * VÌ SAO CÓ TỆP NÀY (21/09/2026). Ô này từng CHẶN mọi chữ không đọc ra một ngày. Cán bộ gõ
 * `../../2026, 31/01/2026 (đơn không có chữ ký người đứng đơn)` và bị từ chối với "Năm phải đủ
 * 4 chữ số" — trong khi năm đã đủ bốn chữ số.
 *
 * Đo dữ liệu thật (bản sao prod, 47.169 đơn thư): 46.129 hồ sơ mang chữ "ngày viết đơn" từ hệ
 * cũ, 41.675 đọc ra được một ngày, **4.454 thì không**. Mẫu điển hình:
 *
 *     11/02/2022, 25/10/2022, 26/10/2022 (02 đơn), 27/10/2022 (03 đơn), …
 *     19/4/2021 (03 đơn), 20/4/2021 (9 đơn), 21/4/2021, 22/4/2021 (04 đơn), …
 *     Không ghi ngày
 *
 * Đây là HỒ SƠ GỘP: một hồ sơ ôm hàng chục lá đơn viết rải nhiều ngày, kèm số lượng mỗi ngày.
 * Ô này trong hệ cũ là GHI NGUYÊN VĂN NHƯ TRÊN GIẤY, không phải một ngày. Hệ mới đọc được thứ
 * nó không cho phép tạo ra.
 *
 * HỢP ĐỒNG: chữ cán bộ gõ LUÔN được giữ nguyên văn và in nguyên văn ra Word. Song song, ta cố
 * đọc ra một ngày để hồ sơ còn lọc/sắp được — nhưng việc đọc ấy KHÔNG BAO GIỜ được phép chặn,
 * và phải NÓI RA hệ hiểu được gì (`hieuLa`). Đọc thầm rồi giữ một phần là đúng lớp mất-im-lặng
 * đã phải vá hai lần ở chính ô này.
 */
export interface NgayVietDonDaDoc {
  /** Ngày đầy đủ (ISO) khi đọc ra đủ ngày-tháng-năm. Dùng cho cột ngày thật. */
  ngayThat: string | null;
  /** EDTF khi biết ít nhất năm: `2026-01-31` · `2026-05-XX` · `2026-XX-XX`. */
  edtf: string | null;
  /** NGUYÊN VĂN chữ đã gõ. Giữ khi chữ ấy khác bản dựng lại chuẩn — tức mọi lúc trừ ngày gõ sạch. */
  chu: string | null;
  /** Câu nói cho cán bộ biết hệ hiểu được gì. Rỗng khi chữ gõ đúng là một ngày. */
  hieuLa: string;
}

const RONG: NgayVietDonDaDoc = {
  ngayThat: null,
  edtf: null,
  chu: null,
  hieuLa: '',
};

/**
 * Mảnh ĐẦU đáng thử đọc thành ngày: cắt tại dấu phẩy hoặc ngoặc mở đầu tiên.
 *
 * Chọn hai dấu ấy vì ĐO dữ liệu thật chứ không vì đẹp: danh sách ngày trong hồ sơ gộp ngăn nhau
 * bằng dấu phẩy, còn ghi chú số lượng hay tình trạng đơn nằm trong ngoặc. Cắt ở đó thì
 * `28/12/2023, 19/12/2023 (03 đơn)` cho ra `28/12/2023`, và `../../2026, 31/01/2026 (…)` cho ra
 * `../../2026` — đúng cái đầu tiên cán bộ ghi.
 */
function manhDau(chu: string): string {
  const cat = [chu.indexOf(','), chu.indexOf('(')].filter((i) => i >= 0);
  return (cat.length ? chu.slice(0, Math.min(...cat)) : chu).trim();
}

const noiNgay = (edtf: string) => {
  const hien = hienThiEdtf(edtf);
  return hien.includes('__')
    ? `Hiểu là ${hien.replace(/__/g, '?')} (phần ? chưa rõ)`
    : `Hiểu là ngày ${hien}`;
};

export function docNgayVietDon(chuGo: string | null | undefined): NgayVietDonDaDoc {
  const chu = (chuGo ?? '').trim();
  if (!chu) return RONG;

  // 1. Chữ gõ ĐÚNG là một ngày (đủ hoặc thiếu thành phần) — đường đi thường gặp nhất.
  const phanDay = tuChuNhapTay(chu);
  if (!loiNgayTungPhan(phanDay)) {
    const edtf = sangEdtf(phanDay);
    if (edtf) {
      /*
        Giữ nguyên văn khi chữ gõ KHÁC bản dựng lại chuẩn. `tháng 5/2026` đọc ra `2026-05-XX`,
        dựng lại thành `__/05/2026` — in ra như thế là sửa lời cán bộ. Anh chốt: để nguyên chữ
        đã nhập và cho vào Word.
      */
      const chuan = hienThiEdtf(edtf);
      return {
        ngayThat: sangNgayDayDu(phanDay),
        edtf,
        chu: chu === chuan ? null : chu,
        hieuLa: '',
      };
    }
  }

  // 2. Không đọc ra ngày từ CẢ chuỗi — giữ nguyên văn, rồi thử đọc mảnh đầu để còn lọc được.
  const dau = manhDau(chu);
  const phanDau = dau && dau !== chu ? tuChuNhapTay(dau) : null;
  const edtfDau =
    phanDau && !loiNgayTungPhan(phanDau) ? sangEdtf(phanDau) : null;

  if (!edtfDau) {
    return {
      ngayThat: null,
      edtf: null,
      chu,
      hieuLa: 'Giữ nguyên văn để in. Hồ sơ này sẽ không lọc được theo ngày.',
    };
  }

  return {
    ngayThat: sangNgayDayDu(phanDau as ReturnType<typeof tuChuNhapTay>),
    edtf: edtfDau,
    chu,
    hieuLa: `${noiNgay(edtfDau)}. Toàn bộ chữ vẫn được in nguyên văn.`,
  };
}
