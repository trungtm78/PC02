import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsCatalogValue } from '../is-catalog-value.validator';

class MultiDto {
  @IsCatalogValue('LY_DO_KHONG_KHOI_TO', { each: true })
  x?: string[];
}

class DynamicDto {
  @IsCatalogValue('DOCUMENT_TYPE')
  y?: string;
}

describe('IsCatalogValue', () => {
  it('legal each: chấp nhận code hợp lệ', async () => {
    const d = plainToInstance(MultiDto, { x: ['HET_THOI_HIEU', 'NGUOI_PHAM_TOI_CHET'] });
    expect(await validate(d)).toHaveLength(0);
  });

  it('legal each: từ chối code ngoài danh mục', async () => {
    const d = plainToInstance(MultiDto, { x: ['BAY'] });
    expect((await validate(d)).length).toBeGreaterThan(0);
  });

  it('legal: undefined → pass (optional)', async () => {
    const d = plainToInstance(MultiDto, {});
    expect(await validate(d)).toHaveLength(0);
  });

  it('dynamic: PASS ở DTO (validate ở service)', async () => {
    const d = plainToInstance(DynamicDto, { y: 'BAT_KY_GIA_TRI_NAO' });
    expect(await validate(d)).toHaveLength(0);
  });
});
