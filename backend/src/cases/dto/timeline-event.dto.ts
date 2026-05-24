export type TimelineEntityType = 'CASE' | 'INCIDENT' | 'PETITION';
export type TimelineEventType =
  | 'STATUS_CHANGE'
  | 'FIELD_UPDATE'
  | 'DOCUMENT_UPLOAD'
  | 'CREATED'
  | 'LINKED';

export interface TimelineActorDto {
  id: string;
  name: string;
}

export interface TimelineEventMetadata {
  hasDiff: boolean;
  fromStatus?: string;
  toStatus?: string;
  changedFields?: string[];
  documentId?: string;
  fileName?: string;
  linkedEntityId?: string;
  linkedEntityType?: string;
}

export class TimelineEventDto {
  id!: string;
  entityType!: TimelineEntityType;
  entityId!: string;
  entityLabel!: string;
  eventType!: TimelineEventType;
  title!: string;
  detail!: string | null;
  actor!: TimelineActorDto | null;
  actedAt!: Date;
  metadata!: TimelineEventMetadata;
}

export interface JourneyResultDto {
  events: TimelineEventDto[];
  total: number;
  hasNextPage: boolean;
  page: number;
  limit: number;
}
