import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CreatePetitionDto } from './dto/create-petition.dto';

/** Lấy tên từ BỘ TÊN CHUẨN dùng chung với trình duyệt — không bên nào tự chọn mẫu dễ. */
const boTen = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '..',
      '..',
      '..',
      'frontend',
      'src',
      'shared',
      'nguon-don',
      'truc-tiep.corpus.json',
    ),
    'utf8',
  ),
) as { truc_tiep: string[]; khong_truc_tiep: string[] };
const KHONG_TRUC_TIEP = boTen.khong_truc_tiep.filter(Boolean);
const TRUC_TIEP = boTen.truc_tiep;

/**
 * Số điện thoại nguyên đơn: bắt buộc CÓ ĐIỀU KIỆN theo Nguồn đơn.
 *
 * Anh nêu (20/09): thông tin liên hệ của nguyên đơn "rất ít được nhập, chỉ được nhập khi
 * Nguồn đơn là Trực tiếp". Đúng thực tế: người nộp đứng trước mặt thì lấy được số; đơn đến
 * bằng bưu điện thì không, nên ép nhập là ép cán bộ BỊA một số.
 *
 * Vì sao phải làm TRƯỚC khi gom nhóm thu gọn: ô này đang BẮT BUỘC. Gom một ô bắt buộc vào
 * nhóm đóng mà không nới luật thì cán bộ bấm Lưu và bị chặn bởi một ô KHÔNG NHÌN THẤY —
 * đúng lỗi PR #248, và là lý do cơ chế `pinnedTop` ra đời.
 *
 * Luật suy từ HÀM THUẦN `laNguonTrucTiep`, nên trình duyệt và máy chủ dùng chung một bản
 * cài đặt — không thể lệch nhau.
 */
async function loiCuaSdt(dto: Partial<CreatePetitionDto>) {
  const o = plainToInstance(CreatePetitionDto, dto);
  const loi = await validate(o, { skipMissingProperties: false });
  return loi.filter((l) => l.property === 'senderPhone');
}

const TOI_THIEU = {
  senderName: 'Nguyễn Văn A',
  detailContent: 'Nội dung',
  receivedDate: '2026-09-20',
};

describe('senderPhone — bắt buộc theo Nguồn đơn', () => {
  it('Nguồn đơn TRỰC TIẾP + để trống SĐT → CHẶN', async () => {
    expect(
      await loiCuaSdt({ ...TOI_THIEU, nguonDon: 'Trực tiếp' }),
    ).toHaveLength(1);
  });

  it.each(TRUC_TIEP)(
    'biến thể "%s" cũng chặn — cờ suy từ tên đã chuẩn hoá',
    async (nguonDon) => {
      expect(await loiCuaSdt({ ...TOI_THIEU, nguonDon })).toHaveLength(1);
    },
  );

  it.each(KHONG_TRUC_TIEP)(
    'Nguồn đơn "%s" + để trống SĐT → LƯU ĐƯỢC',
    async (nguonDon) => {
      expect(await loiCuaSdt({ ...TOI_THIEU, nguonDon })).toHaveLength(0);
    },
  );

  it('CHƯA chọn nguồn đơn thì KHÔNG ép nhập — không đoán thay cán bộ', async () => {
    // Đoán "chắc là trực tiếp" rồi chặn Lưu là chặn bằng một luật người ta không thấy.
    expect(await loiCuaSdt({ ...TOI_THIEU })).toHaveLength(0);
  });

  it('đơn NẶC DANH thì không bắt buộc, kể cả Trực tiếp', async () => {
    expect(
      await loiCuaSdt({
        ...TOI_THIEU,
        nguonDon: 'Trực tiếp',
        senderIsAnonymous: true,
      }),
    ).toHaveLength(0);
  });

  it('SĐT sai định dạng VẪN bị chặn ở MỌI nguồn — nới "bắt buộc" không phải nới "hợp lệ"', async () => {
    const loi = await loiCuaSdt({
      ...TOI_THIEU,
      nguonDon: 'Bưu điện',
      senderPhone: 'abc',
    });
    expect(loi).toHaveLength(1);
    expect(JSON.stringify(loi)).toContain('không hợp lệ');
  });

  it('Trực tiếp + có SĐT hợp lệ → qua', async () => {
    expect(
      await loiCuaSdt({
        ...TOI_THIEU,
        nguonDon: 'Trực tiếp',
        senderPhone: '0901234567',
      }),
    ).toHaveLength(0);
  });
});
