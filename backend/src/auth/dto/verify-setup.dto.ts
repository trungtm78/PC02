import { IsString, Length } from 'class-validator';

export class VerifySetupDto {
  @IsString()
  @Length(6, 6)
  token: string;
}
