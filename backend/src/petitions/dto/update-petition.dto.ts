import { PartialType } from '@nestjs/mapped-types';
import { CreatePetitionDto } from './create-petition.dto';

export class UpdatePetitionDto extends PartialType(CreatePetitionDto) {}
