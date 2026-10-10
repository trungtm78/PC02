import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PreviewTemplateDto } from './preview-template.dto';

/**
 * Multipart body field `selectedSheets` arrives as a JSON-array string
 * (same convention as document-templates' `variables` field) — the
 * @Transform must parse it before @IsArray/@IsString validate it.
 */
describe('PreviewTemplateDto', () => {
  const valid = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(PreviewTemplateDto, data);
    return validate(dto);
  };

  it('accepts a JSON-array string (the real multipart wire format)', async () => {
    const errors = await valid({ selectedSheets: JSON.stringify(['Đội 3', 'Đội 4']) });
    expect(errors).toEqual([]);
  });

  it('accepts an already-array value (e.g. direct unit-test construction)', async () => {
    const errors = await valid({ selectedSheets: ['Đội 3'] });
    expect(errors).toEqual([]);
  });

  it('rejects an empty selection (ArrayMinSize)', async () => {
    const errors = await valid({ selectedSheets: JSON.stringify([]) });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('selectedSheets');
  });

  it('rejects malformed JSON — left as the raw string so @IsArray fails it into a 400, not silently empty', async () => {
    const errors = await valid({ selectedSheets: 'not-json[' });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isArray');
  });

  it('rejects a JSON array containing non-string elements', async () => {
    const errors = await valid({ selectedSheets: JSON.stringify(['Đội 3', 42]) });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('rejects a missing field entirely', async () => {
    const errors = await valid({});
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('selectedSheets');
  });
});
