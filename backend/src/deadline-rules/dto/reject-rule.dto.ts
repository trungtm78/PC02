import { IsString, MinLength, MaxLength } from 'class-validator';

export class RejectRuleDto {
  @IsString()
  @MinLength(10, { message: 'Lý do từ chối phải có ít nhất 10 ký tự' })
  @MaxLength(2000)
  notes!: string;
}
