import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { XlsxImportsService } from './xlsx-imports.service';
import { XLSX_LIMITS } from './hostile-xlsx-guard';

// Hard limit at the multer layer too — defense in depth alongside
// assertCompressedSize so the 50MB cap can't be bypassed by streaming.
const MAX_UPLOAD_BYTES = XLSX_LIMITS.MAX_COMPRESSED_BYTES;

@Controller('xlsx-imports')
@UseGuards(JwtAuthGuard)
export class XlsxImportsController {
  constructor(private readonly service: XlsxImportsService) {}

  /**
   * Upload an xlsx and parse it into staging.
   * Returns the XlsxImportLog id for follow-up dry-run / commit (PR6).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // 10 uploads / minute / admin
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('Thiếu file upload (field "file").');
    }
    return this.service.ingest(file.buffer, file.originalname, {
      id: user.id,
      role: user.role,
      unitCode: (user as unknown as { unitCode?: string | null }).unitCode ?? null,
    });
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.getLog(id, {
      id: user.id,
      role: user.role,
      unitCode: (user as unknown as { unitCode?: string | null }).unitCode ?? null,
    });
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Math.max(1, Math.min(200, parseInt(limit, 10) || 50)) : 50;
    return this.service.listLogs(
      {
        id: user.id,
        role: user.role,
        unitCode: (user as unknown as { unitCode?: string | null }).unitCode ?? null,
      },
      parsed,
    );
  }
}
