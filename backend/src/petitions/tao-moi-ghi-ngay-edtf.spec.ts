import {
  buildPetitionCreateData,
  type PetitionCreateCtx,
} from './petition-data.builder';
import type { CreatePetitionDto } from './dto/create-petition.dto';

const CTX: PetitionCreateCtx = { stt: 'DT-2026-00001', actorId: 'u1' };

/**
 * Đường TẠO MỚI phải ghi `ngayVietDonEdtf`, không chỉ đường SỬA.
 *
 * Lỗi đã gặp: chỉ vá `petitions.service.ts` (đường sửa) mà bỏ quên bộ dựng dữ liệu tạo mới.
 * Cán bộ mở đơn mới, gõ `__/12/2026`, bấm Lưu — payload gửi lên ĐÚNG, nhưng Prisma ghi
 * `petitionDate = NULL` và để cột EDTF trống. **Cả hai cột rỗng, ngày biến mất.** Chỉ "chạy"
 * nếu cán bộ bấm Lưu lần thứ hai, vì đường sửa thì có ghi.
 *
 * Ca kiểm phía trình duyệt dừng ở thân yêu cầu nên không bắt được — phải kiểm ở đây.
 */
const toiThieu = (them: Partial<CreatePetitionDto>) =>
  ({
    receivedDate: '2026-09-20',
    senderName: 'A',
    detailContent: 'N',
    ...them,
  }) as CreatePetitionDto;

describe('buildPetitionCreateData — ngày viết đơn', () => {
  it('ghi `ngayVietDonEdtf` khi nhập ĐỦ', () => {
    const d = buildPetitionCreateData(
      toiThieu({ petitionDate: '2026-12-15', ngayVietDonEdtf: '2026-12-15' }),
      CTX,
    );
    expect(d.ngayVietDonEdtf).toBe('2026-12-15');
  });

  it('ghi `ngayVietDonEdtf` khi nhập THIẾU — và `petitionDate` để trống, không bịa ngày 01', () => {
    const d = buildPetitionCreateData(
      toiThieu({ ngayVietDonEdtf: '2026-12-XX' }),
      CTX,
    );
    expect(d.ngayVietDonEdtf).toBe('2026-12-XX');
    expect(d.petitionDate ?? null).toBeNull();
  });

  it('không gửi thì để null, không dựng chuỗi rác', () => {
    const d = buildPetitionCreateData(toiThieu({}), CTX) as Record<
      string,
      unknown
    >;
    expect(d.ngayVietDonEdtf ?? null).toBeNull();
  });
});
