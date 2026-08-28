import * as fs from 'fs';
import * as path from 'path';

/**
 * Số hiệu bản đang chạy trên máy chủ.
 *
 * ── Vì sao cần ──
 *
 * Giao diện KHÔNG tự biết mình đã cũ: nó chỉ mang một bản số nướng sẵn lúc dựng. Ngày
 * 28/08/2026 cán bộ dùng app của bản 23/08 suốt 5 ngày — CDN giữ `sw.js` cũ ở biên, service
 * worker cũ tiếp tục phục vụ gói cũ từ kho nội bộ, và mọi tệp cũ vẫn còn trên máy chủ nên app
 * cũ chạy trơn tru. Deploy xanh, health ok, hỏng hoàn toàn im lặng.
 *
 * Muốn giao diện tự phát hiện thì nó phải hỏi được một nguồn KHÔNG BAO GIỜ bị cache. Đường
 * `/api/` là nguồn ấy: nginx chuyển tiếp thẳng xuống máy chủ, và CDN không cache đường động.
 *
 * ── Vì sao đọc MỘT LẦN ──
 *
 * Đọc đĩa mỗi lượt gọi thì một lần đọc lỗi sẽ trả giá trị khác, giao diện tưởng máy chủ vừa
 * đổi bản và tự tải lại — vòng lặp tải lại giữa giờ làm việc, đúng thứ tệ hơn cả lỗi ban đầu.
 */
let daDoc: string | undefined;

/**
 * Dò tệp `VERSION` ở gốc kho.
 *
 * Chạy từ mã nguồn thì nó ở `../VERSION`; chạy từ bản biên dịch (`dist/src/`) thì lùi thêm
 * hai bậc. Dò lần lượt thay vì trỏ cứng — trỏ cứng là thứ đã làm bộ nạp mẫu chứng từ tìm
 * không ra file `.docx` trên máy thật (28/08/2026).
 */
function docTuDia(): string {
  const ungVien = [
    path.resolve(__dirname, '..', '..', 'VERSION'),
    path.resolve(__dirname, '..', '..', '..', 'VERSION'),
    path.resolve(process.cwd(), '..', 'VERSION'),
    path.resolve(process.cwd(), 'VERSION'),
  ];
  for (const d of ungVien) {
    try {
      const v = fs.readFileSync(d, 'utf-8').trim();
      if (/^\d+\.\d+\.\d+(\.\d+)?$/.test(v)) return v;
    } catch {
      // Thử đường kế tiếp.
    }
  }
  // Không đọc được thì trả một số hợp lệ nhưng vô hại: giao diện so thấy KHÁC bản của nó và
  // sẽ nhắc cập nhật một lần, chứ không rơi vào trạng thái không xác định.
  return '0.0.0.0';
}

export function phienBanDangChay(): string {
  if (daDoc === undefined) daDoc = docTuDia();
  return daDoc;
}

let daDocMa: string | undefined;

/**
 * Mã bản dựng — ĐỔI MỖI LẦN DEPLOY.
 *
 * `VERSION` chỉ tăng khi PHÁT HÀNH: lần cuối v0.72.0.0, còn từ đó tới 28/08/2026 đã ship hơn
 * 40 PR mà số không đổi. Giao diện so số ấy để biết mình có cũ không là so một thứ đứng yên —
 * cơ chế tự báo thành ra vô dụng, đúng lỗi em vừa suýt để lọt.
 *
 * `deploy.sh` ghi mã commit vào tệp `BUILD_ID` ở gốc bản phát hành. Không có tệp ấy (chạy ở
 * máy lập trình viên, hoặc bản deploy cũ) thì rơi về số phát hành — lúc ấy hai bên trùng nhau
 * nên không báo nhầm.
 */
export function maBanDung(): string {
  if (daDocMa === undefined) {
    const ungVien = [
      path.resolve(__dirname, '..', '..', 'BUILD_ID'),
      path.resolve(__dirname, '..', '..', '..', 'BUILD_ID'),
      path.resolve(process.cwd(), '..', 'BUILD_ID'),
      path.resolve(process.cwd(), 'BUILD_ID'),
    ];
    let ra = '';
    for (const d of ungVien) {
      try {
        const v = fs.readFileSync(d, 'utf-8').trim();
        if (v) {
          ra = v;
          break;
        }
      } catch {
        // Thử đường kế tiếp.
      }
    }
    daDocMa = ra || phienBanDangChay();
  }
  return daDocMa;
}
