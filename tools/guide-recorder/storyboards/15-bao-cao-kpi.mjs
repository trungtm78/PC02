/**
 * Clip 15 — Báo cáo & KPI.
 * Guided tour: dashboard chỉ tiêu KPI (4 chỉ tiêu TT28), drill-down, báo cáo tháng/quý.
 * Chỉ xem — không tạo dữ liệu.
 */
async function smoothScroll(page, y) {
  await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'smooth' }), y);
  await page.waitForTimeout(600);
}

export default {
  slug: '15-bao-cao-kpi',
  title: 'Báo cáo & KPI',
  role: 'admin',
  steps: [
    {
      narration:
        'Hệ thống cung cấp bảng chỉ tiêu K-P-I bám sát Thông tư 28 của Bộ Công an. Quý vị mở mục Chỉ tiêu KPI trong nhóm Báo cáo và thống kê.',
      async run(page) {
        await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1000);
      },
    },
    {
      narration:
        'Bốn chỉ tiêu cứng được theo dõi tự động: tỷ lệ thụ lý phải đạt một trăm phần trăm, tỷ lệ giải quyết trên chín mươi phần trăm, tỷ lệ khám phá trên tám mươi phần trăm, và án nghiêm trọng, đặc biệt nghiêm trọng trên chín mươi lăm phần trăm.',
      async run(page) {
        await smoothScroll(page, 0);
        await page.waitForTimeout(600);
      },
    },
    {
      narration:
        'Mỗi chỉ tiêu hiển thị mức đạt thực tế so với ngưỡng quy định, kèm màu cảnh báo khi chưa đạt để lãnh đạo kịp thời chỉ đạo.',
      async run(page) {
        await smoothScroll(page, 320);
      },
    },
    {
      narration:
        'Có thể xem chi tiết theo từng Tổ, đội và biểu đồ mười hai tháng gần nhất để đánh giá xu hướng.',
      async run(page) {
        await smoothScroll(page, 640);
        await page.waitForTimeout(400);
        await smoothScroll(page, 0);
      },
    },
    {
      narration:
        'Ngoài KPI, nhóm Báo cáo và thống kê còn có báo cáo tháng, báo cáo quý và thống kê theo phường, xã, phục vụ tổng hợp và báo cáo cấp trên.',
      async run(page) {
        await page.goto('/reports/monthly', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1000);
      },
    },
  ],
};
