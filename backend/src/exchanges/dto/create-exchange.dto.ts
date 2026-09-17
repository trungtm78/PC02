import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
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

  /**
   * Nội dung tin nhắn đầu tiên — form tạo gửi trường này. Trước 17/09/2026 DTO không có nên
   * `forbidNonWhitelisted` trả 400: tạo trao đổi mới luôn hỏng.
   */
  @IsOptional()
  @IsString()
  content?: string;
}

export class CreateExchangeMessageDto {
  @IsString()
  exchangeId: string;

  @IsString()
  content: string;

  @IsOptional()
  attachments?: any[];
}

/** Body của `POST /exchanges/:id/messages` — trước là kiểu literal nên ValidationPipe không kiểm gì. */
export class AddExchangeMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsArray()
  attachments?: unknown[];
}
