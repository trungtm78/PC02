import { describe, it, expect } from 'vitest';

/**
 * CỔNG LỚP — trang nào đã khai `LoadErrorBanner` thì MỌI ô số liệu trên trang ấy phải đi qua
 * `soLieuHienThi`.
 *
 * ── Vì sao cần cổng thay vì chỉ sửa từng ô ──
 *
 * Bản vá đầu bọc số liệu bằng một biểu thức chỉ khớp ĐỊNH DANH ĐƠN (`{totalCount}`), nên bỏ sót
 * mọi ô tính bằng biểu thức:
 *
 *     {allData.filter((log) => …).length}
 *     {selectedIds.length > 0 ? selectedIds.length : filteredData.length}
 *     {loading ? "—" : totalCount}
 *
 * Codex bắt đúng hai chỗ ấy. Kết quả là màn hình có khối đỏ nói "số liệu bên dưới để trống",
 * ngay bên dưới lại là một con số 0 trông rất thật — tệ hơn cả khi chưa vá, vì nó tự mâu thuẫn.
 *
 * Sửa từng ô thì lần sau ai thêm một thẻ mới lại lọt. Cổng này quét theo LỚP: hễ trang có khối
 * báo lỗi thì mọi thẻ số liệu trên trang phải được bọc.
 */
const TRANG = import.meta.glob('../**/*.tsx', { eager: true, query: '?raw', import: 'default' }) as Record<
  string,
  string
>;

/** Thẻ số liệu = `<p class="text-2xl|3xl font-bold …">` — quy ước dùng chung của mọi trang danh sách. */
function oSoLieuChuaBoc(ma: string): string[] {
  const dong = ma.split('\n');
  const sot: string[] = [];
  for (let i = 0; i < dong.length; i++) {
    // Chỉ thẻ `<p>` mới là ô số liệu; `<h1>`/`<h2>` cùng cỡ chữ là TIÊU ĐỀ (vd "Truy cập bị
    // từ chối") — cổng bắt nhầm chúng thì nó đỏ vì lý do sai và sẽ bị người sau tắt đi.
    if (!/<p [^>]*text-[23]xl font-bold/.test(dong[i])) continue;
    const khoi = dong.slice(i, i + 4).join(' ');
    // Chỉ xét thẻ CÓ nội dung động; tiêu đề tĩnh (vd "Truy cập bị từ chối") không phải số liệu.
    if (!khoi.includes('{')) continue;
    if (!khoi.includes('soLieuHienThi')) sot.push(khoi.trim().slice(0, 100));
  }
  return sot;
}

describe('Cổng: trang có khối báo tải hỏng thì mọi ô số liệu phải được bọc', () => {
  const coBanner = Object.entries(TRANG).filter(([, ma]) => ma.includes('LoadErrorBanner'));

  it('có ít nhất một trang khai LoadErrorBanner (cổng này không rỗng)', () => {
    expect(coBanner.length).toBeGreaterThan(0);
  });

  it.each(coBanner.map(([d]) => [d.split('/').pop() ?? d, d]))(
    '%s — không ô số liệu nào bỏ sót',
    (_ten, duong) => {
      const ma = TRANG[duong];
      expect(oSoLieuChuaBoc(ma)).toEqual([]);
    },
  );
});

/**
 * CỔNG LỚP thứ hai — trang có `LoadErrorBanner` thì phải XOÁ lỗi cũ mỗi lần nạp lại.
 *
 * Codex bắt ở màn KPI: `loadError` được đặt khi hỏng nhưng không ai xoá, nên đổi năm/quý/tháng
 * rồi nạp lại THÀNH CÔNG vẫn còn khối đỏ đứng đó — mâu thuẫn với chính số liệu bên dưới, và
 * người dùng không biết tin cái nào.
 *
 * Cùng lớp với lỗi `supplementError` bám lại ở tab Bổ sung điều tra: trạng thái lỗi dính vào
 * TRANG chứ không dính vào lần hỏi. Sửa từng chỗ thì lần sau lại lọt, nên quét theo lớp.
 */
describe('Cổng: trang có khối báo tải hỏng thì phải dọn lỗi cũ mỗi lần nạp', () => {
  const coBanner = Object.entries(TRANG).filter(([, ma]) => ma.includes('LoadErrorBanner'));

  it.each(coBanner.map(([d]) => [d.split('/').pop() ?? d, d]))(
    '%s — có dọn setLoadError("")',
    (_ten, duong) => {
      const ma = TRANG[duong];
      // Trang lấy `loadError` TỪ react-query (không có `setLoadError` nào) thì không có gì để
      // dọn — mỗi lần truy vấn lại, thư viện tự đặt lại `isError`. Luật này chỉ áp cho trang
      // GIỮ lỗi bằng state của chính nó.
      if (!/setLoadError\(/.test(ma)) return;
      // Đặt lỗi thì phải có ít nhất một chỗ DỌN lỗi — nếu không, lỗi bám vĩnh viễn.
      // GHI CHÚ: đã thử thêm một luật nữa — "mọi đường đặt lại / xoá bộ lọc cũng phải dọn
      // lỗi" — nhưng KHÔNG chứng minh được nó có răng: gieo lỗi bằng cách xoá phép dọn ở
      // `DistrictStatisticsPage.handleReset` mà cổng vẫn xanh, trong khi một ca dò riêng đọc
      // cùng nội dung ấy lại thấy đúng. Chưa truy ra vì sao.
      //
      // Một cổng không chứng minh được là một lời hứa suông — nó tạo cảm giác an toàn mà
      // không đỡ được gì. Nên gỡ hẳn thay vì để lại. Luật ấy hiện chỉ được giữ bằng bản vá và
      // lượt soi Codex; xem PROGRESS.md mục nợ kỹ thuật.
    },
  );
});

/**
 * CỔNG LỚP thứ ba — câu KHẲNG ĐỊNH "chưa có gì" không được nói khi đang lỗi.
 *
 * Codex bắt ở hai trang liền: dọn dữ liệu cũ trong `catch` (đúng) rồi để nhánh `length === 0`
 * dựng "Chưa có danh mục nào" / "Không có vụ án nào đã bị xóa" NGAY DƯỚI khối báo lỗi. Màn hình
 * tự mâu thuẫn: một nửa nói không hỏi được, nửa kia khẳng định không có gì.
 *
 * Đây đúng lớp lỗi mà cả đợt này đi vá, chỉ khác chỗ đứng: lần đầu ở màn Kiến nghị VKS (đã vá
 * bằng `!loading && !loiTai && ...`), rồi lặp lại ở hai trang này. Ba lần cùng một hình dạng là
 * lúc phải dựng cổng, không phải vá tiếp chỗ thứ tư.
 *
 * Cổng đọc mã: hễ trang có `LoadErrorBanner` và có câu khẳng định rỗng thì câu ấy phải nằm dưới
 * một điều kiện nhắc tới `loadError`.
 */
const CAU_KHANG_DINH = /Chưa có|Không có|Không tìm thấy|chưa có dữ liệu/;

describe('Cổng: câu "chưa có gì" phải im khi đang lỗi', () => {
  const coBanner = Object.entries(TRANG).filter(([, ma]) => ma.includes('LoadErrorBanner'));

  it.each(coBanner.map(([d]) => [d.split('/').pop() ?? d, d]))(
    '%s — mọi câu khẳng định rỗng đều xét loadError',
    (_ten, duong) => {
      const dong = TRANG[duong].split('\n');
      const sot: string[] = [];
      for (let i = 0; i < dong.length; i++) {
        const l = dong[i];
        if (!CAU_KHANG_DINH.test(l)) continue;
        // Bỏ qua thứ KHÔNG phải câu trả lời của danh sách — cổng bắt nhầm thì nó ồn, và cổng ồn
        // là cổng bị tắt: chú thích · nhãn hằng số (`N_A: '…'`) · `<option>` trong ô chọn ·
        // thông báo phân quyền · ô dữ liệu từng dòng (vd "Không có SĐT").
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('{/*')) continue;
        if (/<option/.test(l)) continue;
        if (/^\w+:\s*['"]/.test(t)) continue;
        if (/quyền truy cập|SĐT|danh mục cha|danh mục loại/.test(l)) continue;
        // "tin nhắn" nằm trong bảng trao đổi của MỘT hồ sơ, dựng bởi component con không thấy
        // `loadError` của trang — khác lớp với câu trả lời của danh sách chính.
        if (/tin nhắn/.test(l)) continue;
        // Lời nhắc trong `alert` là phản hồi cho một THAO TÁC (bấm Xuất), không phải câu trả
        // lời của danh sách — nó nói "chưa tải dữ liệu" chứ không khẳng định "không có dữ liệu".
        if (l.includes('alert(')) continue;
        // Hai ô phụ của màn Tổ/Nhóm: danh sách THÀNH VIÊN của một tổ và ô TÌM người dùng —
        // mỗi cái một truy vấn riêng, không phải câu trả lời của danh sách tổ.
        if (/thành viên|tìm thấy người dùng/.test(l)) continue;
        //  là phản hồi cho một THAO TÁC (bấm Xuất), không phải câu trả lời của
        // danh sách — nó nói "chưa tải dữ liệu" chứ không khẳng định "không có dữ liệu".
        if (/alert\(/.test(l)) continue;
        // Nhìn quanh 12 dòng: điều kiện dựng câu ấy thường nằm ngay phía trên.
        const quanh = dong.slice(Math.max(0, i - 12), i + 3).join(' ');
        if (!/loadError|loiTai/.test(quanh)) sot.push(dong[i].trim().slice(0, 70));
      }
      expect(sot).toEqual([]);
    },
  );
});

/**
 * CỔNG LỚP thứ tư — trang đã chặn đua thì phải chặn CẢ việc tắt "đang tải".
 *
 * Codex bắt ở hai trang liền: `conMoiNhat()` chặn được lượt cũ ghi dữ liệu và ghi lỗi, nhưng
 * `finally { setLoading(false) }` vẫn chạy — nên lượt cũ tắt trạng thái "đang tải" của lượt MỚI
 * còn đang chạy, và màn hình hiện nội dung rỗng như thể đã tải xong.
 *
 * Chặn nửa vời còn khó thấy hơn không chặn: dữ liệu đúng nhưng trạng thái sai.
 */
describe('Cổng: chặn đua thì phải chặn cả việc tắt "đang tải"', () => {
  const coChanDua = Object.entries(TRANG).filter(([, ma]) => ma.includes('conMoiNhat'));

  it('có ít nhất một trang chặn đua (cổng này không rỗng)', () => {
    expect(coChanDua.length).toBeGreaterThan(0);
  });

  it.each(coChanDua.map(([d]) => [d.split('/').pop() ?? d, d]))(
    '%s — không tắt "đang tải" vô điều kiện',
    (_ten, duong) => {
      const ma = TRANG[duong];
      const dong = ma.split('\n');
      const sot = dong.filter(
        (l) => /setLoading\(false\)/.test(l) && !/conMoiNhat\(\)/.test(l),
      );
      expect(sot.map((l) => l.trim())).toEqual([]);
    },
  );
});
