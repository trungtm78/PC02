import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { DocumentTemplatesService } from './document-templates.service';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** FileInterceptor options: giới hạn 5MB + chỉ nhận .docx (pattern documents.controller.ts). */
const DOCX_UPLOAD = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: unknown,
    file: { mimetype: string; originalname: string },
    cb: (e: Error | null, ok: boolean) => void,
  ) => {
    const ok = file.mimetype === DOCX_MIME || file.originalname.toLowerCase().endsWith('.docx');
    cb(ok ? null : new BadRequestException('Chỉ chấp nhận file .docx'), ok);
  },
};

@Controller('document-templates')
@FeatureFlag('document-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentTemplatesController {
  constructor(private readonly svc: DocumentTemplatesService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Setting' })
  list(
    @Query('entityType') entityType?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.list({ entityType, category, status });
  }

  /** Danh mục trường khả dụng (whitelist) cho dropdown map placeholder→field. */
  @Get('field-catalog')
  @RequirePermissions({ action: 'read', subject: 'Setting' })
  fieldCatalog(@Query('entityType') entityType: string) {
    if (!entityType) throw new BadRequestException('Thiếu entityType');
    return this.svc.fieldCatalog(entityType);
  }

  /** Preview placeholder của file upload (chưa lưu) + gợi ý mapping. */
  @Post('detect')
  @RequirePermissions({ action: 'write', subject: 'Setting' })
  @UseInterceptors(FileInterceptor('file', DOCX_UPLOAD))
  detect(
    @Body() body: { entityType?: string; delimStart?: string; delimEnd?: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Thiếu file .docx');
    if (!body.entityType) throw new BadRequestException('Thiếu entityType');
    return this.svc.previewVariables(file, body.entityType, body.delimStart, body.delimEnd);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Setting' })
  @UseInterceptors(FileInterceptor('file', DOCX_UPLOAD))
  create(
    @Body() dto: CreateDocumentTemplateDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Thiếu file .docx');
    return this.svc.create(dto, file, user.id);
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Setting' })
  getById(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  /** Tải file .docx mẫu về để admin sửa rồi upload đè (POST :id/file). */
  @Get(':id/file')
  @RequirePermissions({ action: 'read', subject: 'Setting' })
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { fileName, bytes } = await this.svc.getFileForDownload(id);
    const ascii = fileName.replace(/[^\x20-\x7E]/g, '_');
    res.setHeader('Content-Type', DOCX_MIME);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    return new StreamableFile(bytes);
  }

  @Patch(':id')
  @RequirePermissions({ action: 'write', subject: 'Setting' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentTemplateDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/file')
  @RequirePermissions({ action: 'write', subject: 'Setting' })
  @UseInterceptors(FileInterceptor('file', DOCX_UPLOAD))
  replaceFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Thiếu file .docx');
    return this.svc.replaceFile(id, file, user.id);
  }

  @Delete(':id')
  @RequirePermissions({ action: 'write', subject: 'Setting' }) // soft-delete = write (combo có trong seed-permissions)
  remove(@Param('id') id: string) {
    return this.svc.softDelete(id);
  }
}
