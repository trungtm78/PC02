/**
 * Clip 17 — Quản trị người dùng & tổ/đội.
 * Tour: quản lý người dùng, vai trò/phân quyền, tổ đội công tác.
 */
import { scrollTo } from '../lib/ui.mjs';
const wait = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1100); };

export default {
  slug: '17-quan-tri-nguoi-dung',
  title: 'Quản trị người dùng & tổ/đội',
  role: 'admin',
  steps: [
    {
      narration:
        'Nhóm Quản trị dành cho người có thẩm quyền. Mục Người dùng quản lý tài khoản cán bộ trong đơn vị.',
      async run(page) { await page.goto('/nguoi-dung', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
    {
      narration:
        'Tại đây, quản trị viên tạo tài khoản, gán vai trò, cấp quyền, đặt lại mật khẩu và quản lý xác thực hai lớp cho từng người.',
      async run(page) { await scrollTo(page, 0); await page.waitForTimeout(700); },
    },
    {
      narration:
        'Mục Tổ, đội công tác cho phép lập các tổ điều tra, gán thành viên và chỉ định tổ trưởng.',
      async run(page) { await page.goto('/to-nhom', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
    {
      narration:
        'Việc phân tổ gắn liền với phân quyền phạm vi dữ liệu: mỗi cán bộ chỉ thấy và xử lý hồ sơ trong phạm vi tổ, đội, đơn vị của mình, bảo đảm bảo mật thông tin.',
      async run(page) { await scrollTo(page, 200); await page.waitForTimeout(700); },
    },
  ],
};
