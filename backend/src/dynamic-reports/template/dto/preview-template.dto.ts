import { IsArray, IsString, ArrayMinSize } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Multipart body field `selectedSheets` — the wizard sends it as a JSON
 * array string alongside the file part (same pattern as
 * document-templates' `variables` field). A parse failure is left as the
 * raw string on purpose, so `@IsArray()` fails it into a 400 instead of
 * silently falling back to an empty selection.
 */
function parseSelectedSheets(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class PreviewTemplateDto {
  @Transform(({ value }: { value: unknown }) => parseSelectedSheets(value))
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  selectedSheets!: string[];
}
