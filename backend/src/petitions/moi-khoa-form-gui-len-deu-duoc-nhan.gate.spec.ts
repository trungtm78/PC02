import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: mọi khoá form Đơn thư gửi lên đều phải được `CreatePetitionDto` khai.
 *
 * `ValidationPipe` bật `forbidNonWhitelisted`. Một khoá KHÔNG khai trong DTO không bị bỏ qua
 * lặng lẽ mà đá CẢ lời gọi bằng 400 — tức không tạo được đơn thư nào, kể cả đơn không đụng gì
 * tới khoá ấy.
 *
 * Lớp lỗi này xảy ra HAI LẦN trong một ngày: `metadata` (codex bắt) và `sttCu` (chỉ lộ khi bấm
 * thử trên máy thật — CI xanh hoàn toàn). Không ca kiểm nào bắt được vì không ca nào đối chiếu
 * thân lời gọi của giao diện với DTO của máy chủ.
 *
 * Đọc cả hai tệp dưới dạng văn bản: giao diện và máy chủ là hai dự án TypeScript riêng, nhập
 * khẩu chéo sẽ kéo theo cả React lẫn Vite vào bộ ca kiểm máy chủ.
 */
const GOC = path.resolve(__dirname, '../..', '..');
const DTO = path.join(GOC, 'backend/src/petitions/dto/create-petition.dto.ts');
const PAYLOAD = path.join(
  GOC,
  'frontend/src/pages/petitions/PetitionFormPage/buildPetitionPayload.ts',
);

/** Khoá KHÔNG thuộc `CreatePetitionDto` mà vẫn hợp lệ, khai tường minh kèm chỗ ở. */
const NGOAI_LE: Readonly<Record<string, string>> = {
  expectedUpdatedAt: 'UpdatePetitionDto — khoá chống ghi đè đồng thời',
};

describe('GATE Đơn thư — mọi khoá form gửi lên đều được DTO nhận', () => {
  const coDu = fs.existsSync(DTO) && fs.existsSync(PAYLOAD);

  it('đọc được cả hai tệp', () => {
    expect(coDu).toBe(true);
  });

  it('không khoá nào bị forbidNonWhitelisted đá', () => {
    if (!coDu) return;
    const dto = fs.readFileSync(DTO, 'utf8');
    const payload = fs.readFileSync(PAYLOAD, 'utf8');

    const khoaDto = new Set(
      Array.from(dto.matchAll(/^\s*(?:@[\w.]+\([^\n]*\)\s*)*(\w+)\??[?]?:/gm)).map((m) => m[1]),
    );
    expect(khoaDto.size).toBeGreaterThan(50);
    expect(khoaDto.has('senderName')).toBe(true);

    // Khoá gán trong đối tượng trả về của `buildPetitionPayload`.
    const than = payload.slice(payload.indexOf('return {'));
    const khoaGui = Array.from(than.matchAll(/^\s{4}(\w+):/gm)).map((m) => m[1]);
    expect(khoaGui.length).toBeGreaterThan(30);

    const thieu = khoaGui.filter((k) => !khoaDto.has(k) && !(k in NGOAI_LE));
    expect(thieu).toEqual([]);
  });
});
