import { IsIn, IsString, Length } from 'class-validator';
import { TWO_FA_METHODS } from '../../common/constants/two-fa-methods.constants';
import type { TwoFaMethod } from '../../common/constants/two-fa-methods.constants';

export class VerifyTwoFaDto {
  @IsString()
  @Length(1, 20)
  code: string;

  @IsIn([...TWO_FA_METHODS])
  method: TwoFaMethod;
}
