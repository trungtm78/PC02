/**
 * UAT Đợt 5 — luồng "Xin mở lại quyền sửa" (D3 / ND-23), mức API.
 *
 * Hồ sơ quá hạn sửa thì mọi nút Lưu ngừng ăn. Trước D3 không có đường nào xin
 * mở lại: cán bộ phát hiện sai sót sau hạn chỉ còn cách nhờ ai đó sửa thẳng
 * trong DB. Trên hồ sơ hình sự đó không phải một quy trình ai muốn viết ra.
 *
 * Hai điểm đáng chặn nhất, và cả hai đều là loại rò rỉ chứ không phải loại crash:
 *  - `GET /edit-window/status` phải kiểm người gọi có thuộc tổ quản lý hồ sơ
 *    không. Không kiểm thì nó trở thành công cụ dò **thời điểm tạo hồ sơ của tổ
 *    khác** — một endpoint đọc trạng thái vô hại nhìn từ bên ngoài.
 *  - `POST /edit-window/requests` phải từ chối payload thiếu/lạ, không nhận rồi
 *    tạo một yêu cầu rỗng nằm im trong hàng chờ duyệt.
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

test.describe('Đợt 5 — xin mở lại quyền sửa', () => {
  test('GET /edit-window/status KHÔNG trả dữ liệu cho hồ sơ không tồn tại', async () => {
    // Trả 200 kèm một trạng thái bịa cho id bất kỳ là cách endpoint này biến
    // thành công cụ dò: gọi thử hàng loạt id, cái nào trả khác nhau thì cái đó
    // có thật. Phải 4xx.
    const ctx = await api();
    const res = await ctx.get(
      '/api/v1/edit-window/status?subjectType=Case&subjectId=khong-ton-tai-00000000',
    );

    expect(
      res.status(),
      'id không tồn tại mà trả 2xx ⇒ endpoint dò được hồ sơ của tổ khác',
    ).toBeGreaterThanOrEqual(400);
    await ctx.dispose();
  });

  test('GET /edit-window/status từ chối subjectType lạ', async () => {
    // `subjectType` chỉ nhận Case | Incident | Petition. Nhận bừa một chuỗi khác
    // rồi tra nhầm bảng là cách một endpoint đọc biến thành đường đi vòng.
    const ctx = await api();
    const res = await ctx.get(
      '/api/v1/edit-window/status?subjectType=NguoiDung&subjectId=x',
    );

    expect(res.status()).toBeGreaterThanOrEqual(400);
    await ctx.dispose();
  });

  test('POST /edit-window/requests từ chối payload rỗng', async () => {
    // Nhận payload rỗng và tạo một yêu cầu trống nằm trong hàng chờ duyệt là
    // hình thái tệ: người duyệt thấy một dòng không nói lên điều gì, và không có
    // cách nào biết nó đến từ đâu.
    const ctx = await api();
    const res = await ctx.post('/api/v1/edit-window/requests', { data: {} });

    expect(
      res.status(),
      'payload rỗng phải 400, không được tạo yêu cầu trống',
    ).toBe(400);
    await ctx.dispose();
  });

  test('POST /edit-window/requests từ chối trường lạ', async () => {
    const ctx = await api();
    const res = await ctx.post('/api/v1/edit-window/requests', {
      data: { truongLa: 'x', subjectType: 'Case', subjectId: 'y', reason: 'z' },
    });

    expect(res.status()).toBe(400);
    await ctx.dispose();
  });
});
