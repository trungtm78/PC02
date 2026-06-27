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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { DocumentTemplatesService } from './document-templates.service';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';

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
