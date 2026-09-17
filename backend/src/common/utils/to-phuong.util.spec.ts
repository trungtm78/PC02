import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { dieuKienToPhuong } from './to-phuong.util';
import { QueryCasesDto } from '../../cases/dto/query-cases.dto';
import { QueryCasesStatsDto } from '../../cases/dto/query-cases-stats.dto';
import { QueryIncidentsDto } from '../../incidents/dto/query-incidents.dto';
import { QueryIncidentsStatsDto } from '../../incidents/dto/query-incidents-stats.dto';
import { QueryPetitionsDto } from '../../petitions/dto/query-petitions.dto';
import { QueryPetitionsStatsDto } from '../../petitions/dto/query-petitions-stats.dto';

/**
 * Ba màn phường/xã (Đơn thư, Vụ việc, Vụ án) chưa chọn phường cụ thể thì trước 17/09/2026 hiện MỌI hồ sơ
 * trong phạm vi — với ADMIN là cả hồ sơ của các Đội, dù tiêu đề ghi "do tổ phường/xã thụ lý".
 */
describe('dieuKienToPhuong — màn phường/xã chỉ lấy hồ sơ của tổ gắn phường', () => {
  it('chọn phường cụ thể thắng', () => {
    expect(dieuKienToPhuong('w1', true)).toEqual({ is: { wardId: 'w1' } });
    expect(dieuKienToPhuong('w1', undefined)).toEqual({ is: { wardId: 'w1' } });
  });

  it('chưa chọn phường + chiToPhuong → mọi tổ CÓ phường', () => {
    expect(dieuKienToPhuong(undefined, true)).toEqual({
      is: { wardId: { not: null } },
    });
  });

  it('không yêu cầu → không lọc (màn danh sách chính giữ nguyên)', () => {
    expect(dieuKienToPhuong(undefined, false)).toBeUndefined();
    expect(dieuKienToPhuong('', undefined)).toBeUndefined();
  });

  it.each([
    QueryCasesDto,
    QueryCasesStatsDto,
    QueryIncidentsDto,
    QueryIncidentsStatsDto,
    QueryPetitionsDto,
    QueryPetitionsStatsDto,
  ])('%p nhận chiToPhuong=true từ chuỗi URL', async (Dto) => {
    const o: { chiToPhuong?: boolean } = plainToInstance(Dto as never, {
      chiToPhuong: 'true',
    });
    expect(o.chiToPhuong).toBe(true);
    const loi = await validate(o, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(loi.map((e) => e.property)).not.toContain('chiToPhuong');
  });
});
