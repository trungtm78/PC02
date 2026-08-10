import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateEvidenceDto } from './create-evidence.dto';

/**
 * `caseId` is omitted: moving a piece of evidence to another case is not an
 * edit, it is a re-filing, and it would let a PATCH carry a record out of the
 * scope that authorised the request.
 */
export class UpdateEvidenceDto extends PartialType(
  OmitType(CreateEvidenceDto, ['caseId'] as const),
) {}
