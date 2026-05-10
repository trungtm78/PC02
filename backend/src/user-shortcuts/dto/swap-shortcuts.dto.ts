import { IsString, Matches } from 'class-validator';
import { ACTION_REGEX } from '../binding-regex.const';

export class SwapShortcutsDto {
  @IsString()
  @Matches(ACTION_REGEX, { message: 'fromAction không hợp lệ' })
  fromAction: string;

  @IsString()
  @Matches(ACTION_REGEX, { message: 'toAction không hợp lệ' })
  toAction: string;
}
