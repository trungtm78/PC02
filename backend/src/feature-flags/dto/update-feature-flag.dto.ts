import { IsBoolean } from 'class-validator';

export class UpdateFeatureFlagDto {
  @IsBoolean({ message: 'enabled phải là true hoặc false' })
  enabled: boolean;
}
