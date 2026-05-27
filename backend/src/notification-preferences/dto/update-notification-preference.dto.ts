import { IsBoolean } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsBoolean()
  inApp: boolean;

  @IsBoolean()
  push: boolean;
}
