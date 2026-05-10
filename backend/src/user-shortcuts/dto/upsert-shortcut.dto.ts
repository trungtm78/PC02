import { IsString, MaxLength, Matches } from 'class-validator';
import { BINDING_REGEX } from '../binding-regex.const';

export class UpsertShortcutDto {
  @IsString()
  @MaxLength(40)
  @Matches(BINDING_REGEX, {
    message:
      'Phím tắt không hợp lệ. Định dạng: [Ctrl+][Alt+][Shift+][Meta+]Key — ví dụ: Ctrl+Shift+S, Alt+N, F9, Escape',
  })
  binding: string;
}
