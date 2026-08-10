import { IsString, IsIn, MinLength, MaxLength } from 'class-validator';

export class CreateResetRequestDto {
  @IsString()
  @IsIn(['Case', 'Incident', 'Petition'], {
    message: 'subjectType phải là Case | Incident | Petition',
  })
  subjectType: 'Case' | 'Incident' | 'Petition';

  @IsString()
  subjectId: string;

  @IsString()
  @MinLength(10, { message: 'Lý do phải có ít nhất 10 ký tự' })
  @MaxLength(500, { message: 'Lý do không được vượt quá 500 ký tự' })
  reason: string;
}
