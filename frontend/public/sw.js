/*
 * BIA MỘ — service worker này không phục vụ gì, nó chỉ tự dọn rồi tự chết.
 *
 * Ngày 23/08/2026 bản `sw.js` thật được phục vụ kèm `Cache-Control: immutable, max-age=30d`.
 * Cloudflare ghim đúng bản ấy ở biên suốt 30 ngày, và bản ấy chặn mọi lần điều hướng để trả
 * `index.html` từ kho riêng của nó — nên cán bộ ngồi trước mã của sáu ngày trước mà không có
 * cách nào tự thoát: trình duyệt CÓ dò bản mới, nhưng nó dò đúng địa chỉ đang bị ghim.
 *
 * Bản đang chạy đã đổi tên sang `sw-v2.js` để thoát khỏi mục đệm ấy. Nhưng đổi tên chỉ cứu
 * được máy mới và máy tải lại cứng — máy đang bị bản cũ điều khiển chẳng có lý do gì đi hỏi
 * một địa chỉ chưa từng nghe tên. Đường duy nhất còn dẫn tới họ vẫn là `/sw.js`.
 *
 * Nên `/sw.js` giữ nguyên địa chỉ, đổi nội dung: không bộ bắt `fetch` (có nó là lại chặn điều
 * hướng, tức tái tạo đúng thứ đang gỡ), xoá sạch kho, tự gỡ đăng ký, rồi nạp lại tab đang mở.
 * Lần kế tiếp trang tải, `index.html` mới sẽ đăng ký `sw-v2.js`.
 *
 * Tệp này nằm ở `public/` nên đi thẳng vào `dist/` nguyên văn, và bị loại khỏi kho nạp trước
 * của `sw-v2.js` — nó phải luôn đi ra mạng, không bao giờ được ghim lần nữa.
 */
self.addEventListener('install', () => {
  // Không chờ tab cũ đóng hết — người đang dùng dở cần được cứu ngay trong phiên này.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();

      // Xoá mọi kho, kể cả kho do bản 23/08 tạo dưới tên khác.
      const ten = await caches.keys();
      await Promise.all(ten.map((k) => caches.delete(k)));

      await self.registration.unregister();

      // Nạp lại các tab đang bị bản cũ điều khiển; không làm bước này thì họ vẫn ngồi trước
      // mã cũ cho tới khi tự bấm F5.
      const tabs = await self.clients.matchAll({ type: 'window' });
      for (const tab of tabs) {
        try {
          await tab.navigate(tab.url);
        } catch {
          // Vài trình duyệt chặn `navigate()`; lần điều hướng kế tiếp vẫn sạch vì kho đã xoá
          // và đăng ký đã gỡ. Nuốt ở đây là đúng: không có hành động nào khác để làm.
        }
      }
    })(),
  );
});
