import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import * as path from 'path';
import * as fs from 'fs';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/mp4',
  'audio/mpeg',
  'text/plain',
];

@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // GET /api/documents — Danh sách tài liệu (paginated + filtered)
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Document' })
  getList(@Query() query: QueryDocumentsDto) {
    return this.documentsService.getList(query);
  }

  // GET /api/documents/:id — Chi tiết tài liệu
  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Document' })
  getById(@Param('id') id: string) {
    return this.documentsService.getById(id);
  }

  // POST /api/documents — Upload tài liệu mới
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 10);
          const ext = path.extname(file.originalname);
          cb(null, `${timestamp}-${random}${ext}`);
        },
      }),
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
      fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Loại file không được hỗ trợ'), false);
        }
      },
    }),
  )
  @RequirePermissions({ action: 'write', subject: 'Document' })
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('File upload là bắt buộc');
    }

    // Populate file info from multer
    const documentDto: CreateDocumentDto = {
      ...dto,
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      filePath: file.path,
    };

    return this.documentsService.create(documentDto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // PUT /api/documents/:id — Cập nhật thông tin tài liệu
  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Document' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.documentsService.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // DELETE /api/documents/:id — Xóa tài liệu (soft delete)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Document' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.documentsService.delete(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // GET /api/documents/:id/download — Tải xuống tài liệu
  @Get(':id/download')
  @RequirePermissions({ action: 'read', subject: 'Document' })
  async download(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.documentsService.getDownloadInfo(id);
    const { filePath, originalName, mimeType } = result.data;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}
