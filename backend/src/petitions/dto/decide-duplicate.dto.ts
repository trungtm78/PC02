import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PetitionDuplicateDecision } from '@prisma/client';

/**
 * Recording what an officer concluded about a suspected-duplicate group.
 *
 * `reason` is required and has a floor, not because forms like being filled in
 * but because marking one citizen's petition as a duplicate of another's is an
 * assertion about two people. Six months later the only thing left explaining
 * why is this field.
 */
export class DecideDuplicateDto {
  /** The petition kept as the leading file. */
  @IsString()
  @IsNotEmpty({ message: 'Thiếu đơn chính' })
  primaryPetitionId!: string;

  /** The petition being marked. It is NOT deleted, whatever the decision. */
  @IsString()
  @IsNotEmpty({ message: 'Thiếu đơn cần đánh dấu' })
  duplicatePetitionId!: string;

  @IsEnum(PetitionDuplicateDecision, {
    message: 'Quyết định phải là DA_HOP_NHAT hoặc KHONG_TRUNG',
  })
  decision!: PetitionDuplicateDecision;

  @IsString()
  @MinLength(10, {
    message:
      'Lý do phải có ít nhất 10 ký tự — đây là căn cứ trên hồ sơ pháp lý',
  })
  @MaxLength(1000, { message: 'Lý do tối đa 1000 ký tự' })
  reason!: string;
}

export class RevertDuplicateDto {
  @IsString()
  @MinLength(10, { message: 'Lý do hoàn tác phải có ít nhất 10 ký tự' })
  @MaxLength(1000, { message: 'Lý do tối đa 1000 ký tự' })
  revertReason!: string;
}
