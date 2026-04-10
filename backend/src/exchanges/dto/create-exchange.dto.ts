import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ExchangeStatus } from '@prisma/client';

export class CreateExchangeDto {
  @IsOptional()
  @IsString()
  recordCode?: string;

  @IsOptional()
  @IsString()
  recordType?: string;

  @IsOptional()
  @IsString()
  senderUnit?: string;

  @IsOptional()
  @IsString()
  receiverUnit?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsEnum(ExchangeStatus)
  status?: ExchangeStatus;
}

export class CreateExchangeMessageDto {
  @IsString()
  exchangeId: string;

  @IsString()
  content: string;

  @IsOptional()
  attachments?: any[];
}
