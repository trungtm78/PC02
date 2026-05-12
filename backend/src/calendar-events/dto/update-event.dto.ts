import { PartialType } from '@nestjs/mapped-types';
import { CreateEventDto } from './create-event.dto';

/**
 * Update accepts any subset of CreateEventDto fields.
 * Service enforces: scope cannot change (creates a new event if user wants different scope).
 */
export class UpdateEventDto extends PartialType(CreateEventDto) {}
