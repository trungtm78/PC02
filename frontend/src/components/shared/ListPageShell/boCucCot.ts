import type { ColumnDef } from './Table';

/**
 * Áp bố cục cột người dùng tự chỉnh lên bộ cột khai trong mã.
 *
 * Bố cục lưu trên máy chủ theo tài khoản (`user_table_layouts`) và CHỈ chứa cột người dùng đã
 * đụng tới. Ba luật dưới đây kế thừa nguyên từ `useColumnVisibility.ts:82-89` — chúng là thứ
 * giữ cho tính năng không hỏng khi mã nguồn thêm hoặc bớt cột:
 *
 *   1. Lọc TỪ danh sách cột trong mã, không dựng danh sách từ khoá lưu. Khoá lưu có thể còn
 *      tên cột đã bị xoá khỏi mã sau một lần cập nhật.
 *   2. Cột vắng mặt trong bố cục = lấy theo `optional` khai trong mã, KHÔNG phải "đã tắt".
 *   3. Cột mới thêm vào mã sau này nằm đúng chỗ khai, không nhảy xuống cuối bảng.
 */

export interface GhiDeCot {
  width?: number;
  hidden?: boolean;
  position?: number;
}

export type BoCucCot = Record<string, GhiDeCot>;

/**
 * Cột nào người dùng được phép đụng vào.
 *
 * Cột không khai `optional` là cột định danh (Thao tác, STT) — luôn hiện. Cột `sticky` neo
 * cứng ở mép trái (`Table.tsx` — `sticky left-10`) nên phải đứng đầu; cho nó rời chỗ là hỏng
 * cả cơ chế ghim khi cuộn ngang.
 */
function anDuoc<TRow>(c: ColumnDef<TRow>): boolean {
  return c.optional != null;
}

function doiChoDuoc<TRow>(c: ColumnDef<TRow>): boolean {
  return c.optional != null && !c.sticky;
}

/**
 * Sắp xếp cột theo thứ tự người dùng đặt, GIỮ NGUYÊN cả cột đang ẩn.
 *
 * Menu chọn cột cần danh sách này: nó phải hiện cả cột đang ẩn (để bật lại) VÀ phải theo đúng
 * thứ tự hiện hành. Lấy thứ tự khai trong mã thì sau một lần dời, menu vẫn hiện thứ tự cũ và
 * nút dời kế tiếp trỏ sai chỗ — Codex bắt được 28/08/2026.
 */
export function sapXepCot<TRow>(
  columns: ColumnDef<TRow>[],
  boCuc: BoCucCot,
): ColumnDef<TRow>[] {
  const khe: number[] = [];
  const nhomDoiCho: ColumnDef<TRow>[] = [];
  columns.forEach((c, i) => {
    if (doiChoDuoc(c)) {
      khe.push(i);
      nhomDoiCho.push(c);
    }
  });

  // Đặt chỗ TƯỜNG MINH thay vì dùng bộ so sánh: cột có `position` chiếm đúng khe ấy, cột
  // không có lấp vào những khe còn trống theo THỨ TỰ KHAI TRONG MÃ.
  //
  // Bộ so sánh trộn hai loại (có vị trí / không có vị trí) không có thứ tự toàn phần, nên kết
  // quả phụ thuộc cặp nào được so trước — đúng chỗ bản đầu sai. Đặt chỗ thì luật đọc thẳng ra
  // được, và cột MỚI thêm vào mã lấp vào khe trống theo chỗ khai chứ không nhảy xuống cuối.
  const n = nhomDoiCho.length;
  const daSap: Array<ColumnDef<TRow> | undefined> = new Array(n);
  const coViTri = nhomDoiCho
    .map((c, i) => ({ c, i, p: boCuc[c.key]?.position }))
    .filter((x) => x.p !== undefined)
    .sort((x, y) => (x.p as number) - (y.p as number));
  const khongViTri = nhomDoiCho.filter((c) => boCuc[c.key]?.position === undefined);

  for (const x of coViTri) {
    let k = Math.min(Math.max(x.p as number, 0), n - 1);
    // Hai cột cùng một vị trí (bố cục cũ, hoặc sửa tay) — đẩy xuống khe trống kế tiếp thay vì
    // ghi đè và làm mất một cột.
    while (k < n && daSap[k] !== undefined) k++;
    if (k >= n) {
      k = daSap.findIndex((v) => v === undefined);
      if (k < 0) continue;
    }
    daSap[k] = x.c;
  }
  let j = 0;
  for (const c of khongViTri) {
    while (j < n && daSap[j] !== undefined) j++;
    if (j >= n) break;
    daSap[j] = c;
  }

  const ra = [...columns];
  khe.forEach((viTri, k) => {
    const c = daSap[k];
    if (c) ra[viTri] = c;
  });
  return ra;
}

/** Cột có đang hiện không — cột vắng mặt trong bố cục lấy theo `optional` khai trong mã. */
export function cotDangHien<TRow>(c: ColumnDef<TRow>, boCuc: BoCucCot): boolean {
  if (!anDuoc(c)) return true;
  const g = boCuc[c.key]?.hidden;
  return g !== undefined ? !g : c.optional === 'show';
}

export function apDungBoCuc<TRow>(
  columns: ColumnDef<TRow>[],
  boCuc: BoCucCot,
): ColumnDef<TRow>[] {
  return sapXepCot(columns, boCuc)
    .filter((c) => cotDangHien(c, boCuc))
    .map((c) => {
      const w = boCuc[c.key]?.width;
      return w === undefined ? c : { ...c, width: `${w}px` };
    });
}

/**
 * Vị trí mới cho MỌI cột sau một lần kéo thả.
 *
 * Tính ở đây thay vì trong bộ xử lý kéo: giao diện chỉ việc gửi kết quả lên máy chủ, và luật
 * sắp xếp kiểm được mà không cần dựng chuột giả trong ca kiểm.
 */
export function ganViTri(
  thuTuHienTai: string[],
  keo: string,
  toiViTri: number,
): Record<string, { position: number }> {
  const con = thuTuHienTai.filter((k) => k !== keo);
  const dich = Math.min(Math.max(toiViTri, 0), con.length);
  con.splice(dich, 0, keo);
  const ra: Record<string, { position: number }> = {};
  con.forEach((k, i) => {
    ra[k] = { position: i };
  });
  return ra;
}

/**
 * Cờ đánh dấu đã chuyển lựa chọn cũ lên máy chủ.
 *
 * Không có cờ thì mỗi lần mở trang lại đọc khoá cũ và đè lên bố cục người dùng vừa chỉnh —
 * họ sẽ thấy thay đổi của mình bị nuốt mất sau mỗi lần tải lại.
 */
export function khoaDaChuyen(prefix: string): string {
  // THEO TỪNG BẢNG, không dùng một khoá chung: dữ liệu cũ nằm ở `cases_columns`,
  // `petitions_columns`… nên một khoá chung nghĩa là mở màn Đơn thư xong thì Vụ việc và Vụ án
  // KHÔNG BAO GIỜ được chuyển, và lựa chọn cũ của hai màn ấy mất hẳn. Codex bắt 28/08/2026.
  return `pc02-bo-cuc-cot-da-chuyen:${prefix}`;
}

/**
 * Đọc lựa chọn ẩn/hiện cũ trong trình duyệt, để chuyển lên máy chủ MỘT LẦN.
 *
 * Hôm nay lựa chọn của cán bộ nằm ở `localStorage` khoá `<trang>_columns`, dạng
 * `{ tenCot: boolean }`. Không đọc lên thì lần đầu mở bản mới, mọi cột họ đã tắt hiện lại
 * hết, và họ phải tắt lại từ đầu trên từng máy.
 *
 * Trả `null` khi không có gì để chuyển — phân biệt với "có nhưng rỗng", vì một khối rỗng vẫn
 * là thứ đáng ghi (người dùng đã bấm "Về mặc định").
 *
 * `localStorage` KHÔNG chỉ trả rỗng — nó NÉM LỖI ở chế độ riêng tư và khi trình duyệt chặn
 * dữ liệu trang. Không bọc thì cả trang danh sách trắng xoá vì một bước chạy đúng một lần.
 */
export function boCucTuLocalStorage(prefix: string): BoCucCot | null {
  try {
    if (localStorage.getItem(khoaDaChuyen(prefix))) return null;
    const tho = localStorage.getItem(`${prefix}_columns`);
    if (!tho) return null;
    const parsed: unknown = JSON.parse(tho);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const ra: BoCucCot = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean') ra[k] = { hidden: !v };
    }
    return ra;
  } catch {
    return null;
  }
}
