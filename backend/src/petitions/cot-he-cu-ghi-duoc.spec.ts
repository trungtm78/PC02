import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePetitionDto } from './dto/update-petition.dto';
import { CreatePetitionDto } from './dto/create-petition.dto';
import { buildPetitionCreateData } from './petition-data.builder';
import { PARITY } from '../legacy-migration/field-parity.def';

/**
 * Cột có trong lược đồ mà API không nhận thì vô dụng — tệ hơn là hỏng ngầm.
 *
 * `ValidationPipe` bật `forbidNonWhitelisted`, nên một trường KHÔNG khai trong DTO không bị bỏ
 * qua lặng lẽ mà làm hỏng CẢ lời gọi bằng 400. Cán bộ điền form, bấm Lưu, và không lưu được
 * gì — kể cả những ô chẳng liên quan.
 *
 * Ca kiểm đi từ đặc tả di trú: mọi cột khai trong `PARITY.petition` đều phải qua được ba cửa —
 * DTO nhận, đường TẠO ghi, đường SỬA ghi. Đọc từ đặc tả nên thêm cột mới là tự được phủ.
 */

/** Cột do `buildPetition` (lớp di trú) đổ thẳng, không đi qua DTO của form. */
const KHONG_QUA_FORM = new Set(['dieuTraVien', 'ngayDeXuat', 'deXuat']);

const COT_PARITY = PARITY.petition
  .map((c) => c.col)
  .filter((col) => !KHONG_QUA_FORM.has(col));

/** Giá trị mẫu đúng kiểu để `class-validator` không loại vì sai kiểu. */
function mau(col: string): unknown {
  const kieu = PARITY.petition.find((c) => c.col === col)?.type;
  if (kieu === 'DateTime') return '2026-08-26T00:00:00.000Z';
  if (kieu === 'Int' || kieu === 'Float') return 7;
  if (kieu === 'Boolean') return true;
  return 'giá trị thử';
}

/**
 * `metadata` phải đi được qua đường TẠO, không chỉ đường SỬA.
 *
 * Ô hệ cũ chưa có cột riêng nằm trong `metadata`. `forbidNonWhitelisted` đang bật, nên một
 * trường không khai trong DTO không bị bỏ qua lặng lẽ mà đá CẢ lời gọi bằng 400 — tức không
 * tạo được đơn thư nào, kể cả đơn không đụng gì tới ô hệ cũ.
 */
describe('metadata đi được qua đường tạo mới', () => {
  it('DTO nhận metadata, không bị forbidNonWhitelisted đá', async () => {
    const dto = plainToInstance(CreatePetitionDto, {
      receivedDate: '2026-08-26',
      senderName: 'A',
      senderPhone: '0901234567',
      crimeChinhId: 'crime-1',
      petitionType: 'TO_CAO',
      metadata: { soQuyetDinhKhoiTo: '12/QĐ' },
    });
    const loi = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(loi.map((e) => e.property)).toEqual([]);
  });

  it('đường TẠO ghi metadata vào cơ sở dữ liệu', () => {
    const data = buildPetitionCreateData(
      {
        receivedDate: '2026-08-26',
        senderName: 'A',
        metadata: { soQuyetDinhKhoiTo: '12/QĐ' },
      } as never,
      { stt: '2026-1', actorId: 'user-001' },
    ) as Record<string, unknown>;
    expect(data.metadata).toEqual({ soQuyetDinhKhoiTo: '12/QĐ' });
  });
});

describe('Cột hệ cũ của Đơn thư phải ghi được qua API', () => {
  it.each(COT_PARITY)('cột "%s": DTO nhận, không bị forbidNonWhitelisted đá', async (col) => {
    const dto = plainToInstance(UpdatePetitionDto, { [col]: mau(col) });
    const loi = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(loi.map((e) => e.property)).toEqual([]);
    expect((dto as unknown as Record<string, unknown>)[col]).toBeDefined();
  });

  it.each(COT_PARITY)('cột "%s": đường TẠO ghi vào cơ sở dữ liệu', (col) => {
    const data = buildPetitionCreateData(
      { receivedDate: '2026-08-26', senderName: 'A', [col]: mau(col) } as never,
      { stt: '2026-1', actorId: 'user-001' },
    ) as Record<string, unknown>;
    expect(col in data).toBe(true);
  });
});
