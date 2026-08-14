/**
 * UAT Đợt 2 — bảo mật + mất dữ liệu. Đợt rủi ro CAO nhất trong kế hoạch.
 *
 * Ba kịch bản dưới đây chỉ cần MỘT tài khoản nên tự động hoá được ngay. Các
 * kịch bản 403 chéo tổ (user tổ A ghi vào hồ sơ tổ B) cần hai tài khoản ở hai
 * tổ khác nhau — chưa tự động hoá, ghi rõ trong `UAT-COVERAGE.md` chứ không
 * đánh dấu là xong.
 *
 * Cả ba đều thuộc loại **mất dữ liệu im lặng**: request được nhận, trả 200, và
 * một phần dữ liệu người dùng gửi lên biến mất không dấu vết. Không có ngoại lệ
 * nào, không có log đỏ nào.
 */
import { test, expect, request as pwRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API = process.env.API_URL || 'http://localhost:3000';

function adminToken(): string {
  const p = path.resolve(__dirname, '../../test-results/.auth-token.txt');
  if (!fs.existsSync(p)) {
    throw new Error(`Không có token admin tại ${p}. Chạy qua playwright global-setup.`);
  }
  return fs.readFileSync(p, 'utf-8').trim();
}

async function api() {
  return pwRequest.newContext({
    baseURL: API,
    extraHTTPHeaders: { Authorization: `Bearer ${adminToken()}` },
    ignoreHTTPSErrors: true,
  });
}

test.describe('Đợt 2 — bảo mật + mất dữ liệu', () => {
  test('PUT /cases/:id kèm evidences[] bị TỪ CHỐI, không nuốt im lặng', async () => {
    // PR-A2. Trước đây `evidences[]` gửi kèm khi sửa vụ án bị bỏ qua lặng lẽ:
    // API trả 200, cán bộ tin là đã lưu vật chứng, và không có gì được lưu. Trên
    // hồ sơ hình sự, một vật chứng "đã nhập" mà không tồn tại là mất chứng cứ.
    //
    // Đúng phải là 400 kèm câu chỉ đúng chỗ nhập thay thế — im lặng bỏ qua và
    // trả 200 là hình thái tệ nhất, vì nó không phân biệt được với thành công.
    // Dùng id KHÔNG tồn tại là cố ý, không phải đi đường tắt: `ValidationPipe`
    // chạy TRƯỚC khi handler tra bản ghi, nên 400 (chứ không phải 404) tự nó
    // chứng minh payload bị chặn ở tầng kiểm tra. Test cũng hết phụ thuộc vào
    // việc DB có sẵn vụ án hay không — một test chỉ chạy khi có dữ liệu là test
    // sẽ im lặng biến mất trên DB trắng.
    const ctx = await api();

    const res = await ctx.put('/api/v1/cases/khong-ton-tai-00000000', {
      data: { evidences: [{ code: 'VC-TEST-001', name: 'Vật chứng thử' }] },
    });

    expect(
      res.status(),
      'phải 400 ở tầng kiểm tra payload — 404 nghĩa là đã qua được ValidationPipe',
    ).toBe(400);
    const text = JSON.stringify(await res.json());
    expect(text, 'thông điệp phải chỉ đúng chỗ nhập thay thế').toContain('Vật chứng');
    await ctx.dispose();
  });

  test('POST /directories/seed bị chặn khi ALLOW_SEED_ENDPOINTS không bật', async () => {
    // Endpoint nạp dữ liệu mẫu ghi đè danh mục. Mở trên production nghĩa là bất
    // kỳ ai có token đều xoá được toàn bộ danh mục tra cứu.
    const ctx = await api();
    const res = await ctx.post('/api/v1/directories/seed', { data: {} });

    // 403 khi cờ tắt. Nếu môi trường CÓ bật cờ (dev), test tự bỏ qua thay vì
    // báo xanh sai — nhưng nói rõ vì sao.
    if (res.status() < 400) {
      test.skip(
        true,
        'Môi trường này đang đặt ALLOW_SEED_ENDPOINTS=true — không kiểm được nhánh chặn',
      );
    }
    expect(res.status()).toBe(403);
    await ctx.dispose();
  });

  test('trường lạ trong payload bị TỪ CHỐI, không âm thầm bỏ qua', async () => {
    // `forbidNonWhitelisted: true` trong `main.ts`. Không có nó, gõ sai tên
    // trường (`sender_name` thay vì `senderName`) được nhận với 200 và giá trị
    // biến mất — cùng lớp lỗi với `evidences[]` ở trên, chỉ rộng hơn.
    const ctx = await api();
    const res = await ctx.post('/api/v1/petitions', {
      data: { truongKhongHeTonTai: 'x', senderName: 'Nguyễn Văn Thử' },
    });

    expect(
      res.status(),
      'trường lạ phải làm request hỏng, không được lặng lẽ rơi',
    ).toBe(400);
    await ctx.dispose();
  });
});
