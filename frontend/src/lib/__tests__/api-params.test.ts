import { describe, it, expect } from 'vitest';
import { api } from '../api';

/**
 * Máy chủ chạy Express 5 (`@nestjs/platform-express` 11): bộ đọc query mặc định là "simple",
 * không hiểu `tk[]=a`. Axios mặc định gửi mảng đúng dạng ấy, nên khoá thành `tk[]` — một khoá
 * lạ, và `forbidNonWhitelisted` trả 400 cho CẢ danh sách. Mảng phải đi dạng lặp khoá `tk=a&tk=b`.
 */
describe('api — tham số mảng', () => {
  it('gửi mảng bằng khoá lặp lại, không có ngoặc vuông', () => {
    const uri = api.getUri({ url: '/petitions', params: { tk: ['nguoiGui~An', '*~abc'] } });
    expect(uri).toContain('tk=nguoiGui~An&tk=*~abc');
    expect(uri).not.toContain('%5B');
    expect(uri).not.toContain('[');
  });
});
