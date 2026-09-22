import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { PetitionsService } from './petitions.service';
import { QueryDaXoaDto } from '../common/dto/query-da-xoa.dto';
import { PetitionsJourneyService } from './petitions-journey.service';
import { DynamicExportService } from '../document-templates/dynamic-export.service';
import { ExportEntityDocumentsDto } from '../document-templates/dto/export-entity-documents.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { DispatchGuard } from '../auth/guards/dispatch.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePetitionDto } from './dto/create-petition.dto';
import { UpdatePetitionDto } from './dto/update-petition.dto';
import { QueryPetitionsDto } from './dto/query-petitions.dto';
import { QueryPetitionsStatsDto } from './dto/query-petitions-stats.dto';
import { QueryDuplicatesDto } from './dto/query-duplicates.dto';
import { ExportPetitionsQueryDto } from './dto/export-petitions-query.dto';
import { ConvertToIncidentDto } from './dto/convert-incident.dto';
import { ConvertToCaseDto } from './dto/convert-case.dto';
import { AssignPetitionDto } from './dto/assign-petition.dto';
import { RestorePetitionDto } from './dto/restore-petition.dto'; // v0.32.0.0
import { ListLinkableDto } from './dto/list-linkable.dto'; // v0.37.1
import { XuatDanhSachDonThuDto } from './dto/xuat-danh-sach-don-thu.dto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
@Controller('petitions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PetitionsController {
  constructor(
    private readonly petitionsService: PetitionsService,
    private readonly petitionsJourneyService: PetitionsJourneyService,
    private readonly dynamicExport: DynamicExportService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // In chứng từ ĐỘNG cho Đơn thư (engine ĐỘNG duy nhất — mẫu .docx trong DB DON_THU).
  // PR4 đã gỡ TOÀN BỘ engine tĩnh; các route này là chính thức. Quyền read Petition.
  // ─────────────────────────────────────────────────────────────────────────

  // GET /api/v1/petitions/export-templates — danh sách mẫu chứng từ động (DON_THU) cho picker.
  @Get('export-templates')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  listDynamicExportTemplates() {
    return this.dynamicExport.listExportableTemplates('DON_THU');
  }

  // GET /api/v1/petitions/:id/export-readiness — trường còn thiếu per mẫu (engine động).
  @Get(':id/export-readiness')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  async dynamicExportReadiness(@Param('id') id: string, @Req() req: ScopedRequest) {
    const petition = await this.petitionsService.loadPetitionForExport(id, req.dataScope);
    return this.dynamicExport.getExportReadiness('DON_THU', petition);
  }

  // POST /api/v1/petitions/:id/export-documents — xuất chứng từ (engine động, gộp/zip).
  @Post(':id/export-documents')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  async dynamicExportDocuments(
    @Param('id') id: string,
    @Body() dto: ExportEntityDocumentsDto,
    @Req() req: ScopedRequest,
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    const petition = await this.petitionsService.loadPetitionForExport(id, req.dataScope);
    await this.dynamicExport.exportEntityDocuments(
      'DON_THU',
      id,
      petition,
      dto.templateIds,
      dto.mode ?? 'merged',
      user.id,
      dto.manualValues ?? {},
      res,
    );
  }

  // POST /api/v1/petitions/export-document-batch — xuất ĐỒNG LOẠT 1 mẫu (theo code) cho
  // NHIỀU đơn → ZIP (mỗi đơn 1 file + manifest.json). Engine ĐỘNG (mẫu .docx trong DB);
  // mỗi đơn render trong tx riêng → 1 đơn lỗi không abort cả lô.
  @Post('export-document-batch')
  @Throttle({ default: { ttl: 60000, limit: 2 } })
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  async exportDocumentBatch(
    @Body() body: { docType?: string; docTypes?: string[]; petitionIds: string[] },
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const ids = body?.petitionIds;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
      throw new BadRequestException('petitionIds phải là mảng 1..100 phần tử');
    }
    // `docTypes` (nhiều mẫu) là dạng mới; `docType` (1 mẫu) giữ nguyên cho client cũ
    // (ExportReportsPage + bộ UAT đang gửi dạng này) — KHÔNG phá contract.
    const codes = Array.isArray(body?.docTypes)
      ? body.docTypes
      : body?.docType
        ? [body.docType]
        : [];
    if (!codes.length || codes.some((c) => !c || typeof c !== 'string')) {
      throw new BadRequestException('docType hoặc docTypes bắt buộc');
    }
    await this.dynamicExport.exportBatchByCodes(
      'DON_THU',
      codes,
      ids,
      (id) => this.petitionsService.loadPetitionForExport(id, req.dataScope),
      user.id,
      res,
    );
  }

  // GET /api/v1/petitions — Danh sách đơn thư
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  getList(@Query() query: QueryPetitionsDto, @Req() req: ScopedRequest) {
    return this.petitionsService.getList(query, req.dataScope);
  }

  // v0.37.1 PR-PICK — GET /api/v1/petitions/linkable
  // Returns unlinked Petitions in user's scope for Case form Petition picker.
  // Used by CaseFormPage CaseProvenancePicker when caseProvenance=FROM_PETITION.
  @Get('linkable')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  listLinkable(@Query() query: ListLinkableDto, @Req() req: ScopedRequest) {
    return this.petitionsService.listLinkable(query, req.dataScope);
  }

  // GET /api/v1/petitions/stats — PR2/T2 — counts by PetitionStatus,
  // scoped to active non-status filters. Pattern mirrors PR1 Cases.
  @Get('stats')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  getStats(@Query() query: QueryPetitionsStatsDto, @Req() req: ScopedRequest) {
    return this.petitionsService.getStats(query, req.dataScope);
  }

  // GET /api/v1/petitions/export — Xuất danh sách đơn thư ra Excel
  @Get('export')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportExcel(
    @Query() query: ExportPetitionsQueryDto,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const user = (req as any).user as AuthUser | undefined;
    await this.petitionsService.exportToExcel(query, req.dataScope, res, user?.id);
  }

  /*
    GET /api/v1/petitions/export/day-du — xuất MỌI trường đang đăng ký trên màn tạo/sửa.

    ĐƯỜNG RIÊNG + QUYỀN RIÊNG, không phải một cờ truy vấn trên đường cũ.

    Bảng này mang 3.335 số CCCD và 2.933 số điện thoại (đo bản sao prod 22/09/2026). Gắn
    `?dayDu=1` vào đường cũ nghĩa là bất kỳ ai đọc được đơn thư đều rút được toàn bộ khối định
    danh ấy về máy, qua một tham số không ai nhìn và không cổng nào canh. Nhật ký là PHÁP CHỨNG,
    không phải phép phân quyền: nó nói ai đã lấy, sau khi họ đã lấy xong.

    Trần thấp hơn nút thường và throttle chặt hơn — mỗi dòng nặng gấp nhiều lần.
  */
  @Get('export/day-du')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'export_full', subject: 'Petition' })
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async xuatDayDu(
    @Query() query: XuatDanhSachDonThuDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.petitionsService.xuatDayDu(query, req.dataScope, res, {
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // GET /api/v1/petitions/export/danh-sach — Xuất Excel đúng bộ lọc + thứ tự của màn Danh sách đơn thư.
  @Get('export/danh-sach')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async xuatDanhSach(
    @Query() query: XuatDanhSachDonThuDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.petitionsService.xuatDanhSach(query, req.dataScope, res, {
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // GET /api/v1/petitions/export/ward — Xuất danh sách đơn thư theo phường/xã ra Excel
  // Mirror /cases/export/ward + /incidents/export/ward pattern
  @Get('export/ward')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportWardPetitions(
    @Query() query: QueryPetitionsDto,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const user = (req as any).user as AuthUser | undefined;
    await this.petitionsService.exportWardPetitions(query, req.dataScope, res, user ? {
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    } : undefined);
  }

  // GET /api/v1/petitions/duplicates — Nhóm đơn TRÙNG theo một tiêu chí (màn Đơn trùng).
  // Phân trang theo NHÓM; mỗi nhóm kèm mọi đơn và đơn tiếp nhận sớm nhất (hồ sơ gốc).
  @Get('duplicates')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  listDuplicates(
    @Query() query: QueryDuplicatesDto,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.listDuplicates(query, req.dataScope);
  }

  // GET /api/v1/petitions/export/duplicates — Xuất danh sách đơn trùng lặp ra Excel
  @Get('export/duplicates')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportDuplicates(
    @Query() query: QueryDuplicatesDto,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.petitionsService.exportDuplicates(query, req.dataScope, res);
  }

  // GET /api/v1/petitions/suspect-search?q= — Nhóm V: search nghi phạm theo tên/CCCD
  @Get('suspect-search')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  suspectSearch(
    @Query() query: { q?: string },
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.suspectSearch(query.q ?? '', req.dataScope);
  }

  // GET /api/v1/petitions/duplicate-search?q=&excludeId= — Nhóm V: search trùng đơn
  @Get('duplicate-search')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  duplicateSearch(
    @Query() query: { q?: string; excludeId?: string },
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.duplicateSearch(query.q ?? '', query.excludeId, req.dataScope);
  }

  /*
    GET /api/v1/petitions/goi-y-ten-nguoi-gui?q= — gợi ý tên người gửi theo dữ liệu đã có.

    Cùng khuôn `duplicate-search` ngay trên: quyền ĐỌC Đơn thư, throttle 5 lượt/60 giây, và
    `req.dataScope` đi thẳng xuống service. Phạm vi dữ liệu ở đây không phải chi tiết kỹ thuật —
    thiếu nó thì cán bộ tổ B gõ vài chữ cái là đọc được tên người tố giác của tổ A.

    ĐẶT TRƯỚC `@Get(':id/journey')` và mọi route `:id`: Nest khớp route theo thứ tự khai, nên
    một route tham số đứng trước sẽ nuốt đường dẫn tĩnh này và trả 404 "không tìm thấy đơn thư".
  */
  @Get('goi-y-ten-nguoi-gui')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  /*
    Trần CAO hơn hẳn `duplicate-search` ngay trên — có chủ ý, không phải chép nhầm.

    `duplicate-search` là thao tác cán bộ chủ động làm vài lần mỗi hồ sơ; ô gợi ý thì chạy theo
    NHỊP GÕ. Một cái tên 20 ký tự gõ ngắt quãng đã bắn 5–10 lượt sau phép hoãn 300 ms, nên trần
    5 lượt/60 giây làm gợi ý tắt ngóm ngay giữa lúc gõ — và tắt IM LẶNG, vì component nuốt lỗi
    để không chặn nhập liệu.

    Nặng hơn: `ThrottlerGuard` đếm theo ĐỊA CHỈ IP, mà cả đội ngồi sau một đường truyền. Năm
    lượt ấy là năm lượt CHUNG cho toàn đơn vị.

    Lượt gọi này đọc nhiều nhất 10 cái tên, đã lọc theo phạm vi dữ liệu và đòi ít nhất 2 ký tự.
  */
  @Throttle({ default: { ttl: 60000, limit: 120 } })
  goiYTenNguoiGui(@Query() query: { q?: string }, @Req() req: ScopedRequest) {
    return this.petitionsService.goiYTenNguoiGui(query.q ?? '', req.dataScope);
  }

  // GET /api/v1/petitions/:id/journey — Hành trình đơn thư
  @Get(':id/journey')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  getJourney(
    @Param('id') id: string,
    @Req() req: ScopedRequest,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    return this.petitionsJourneyService.getJourney(id, req.dataScope ?? null, safePage, safeLimit);
  }

  // GET /api/v1/petitions/:id — Chi tiết đơn thư
  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  getById(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.petitionsService.getById(id, req.dataScope);
  }

  // GET /api/v1/petitions/:id/export-word — Xuất đơn thư ra Word (legacy v0.46)
  @Get(':id/export-word')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  async exportWord(
    @Param('id') id: string,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.petitionsService.exportToWord(id, req.dataScope, res);
  }

  // POST /api/v1/petitions — Tạo đơn thư mới
  @Post()
  @RequirePermissions({ action: 'write', subject: 'Petition' })
  create(
    @Body() dto: CreatePetitionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.create(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope); // v0.33: ward officer auto-set
  }

  // PUT /api/v1/petitions/:id — Cập nhật đơn thư
  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Petition' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePetitionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // DELETE /api/v1/petitions/:id — Xóa đơn thư (soft delete)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Petition' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.delete(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // GET /api/v1/petitions/admin/deleted — v0.32.0.0 list đơn thư đã xóa mềm (ADMIN)
  @Get('admin/deleted')
  @RequirePermissions({ action: 'restore', subject: 'Petition' })
  listDeleted(@Query() query: QueryDaXoaDto) {
    return this.petitionsService.listDeleted({
      limit: query.limit,
      offset: query.offset,
      search: query.search,
      tk: query.tk,
    });
  }

  // POST /api/v1/petitions/:id/restore — v0.32.0.0 khôi phục (ADMIN)
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'restore', subject: 'Petition' })
  restore(
    @Param('id') id: string,
    @Body() dto: RestorePetitionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.restore(id, dto.reason, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // POST /api/v1/petitions/:id/convert-incident — Chuyển thành Vụ việc
  @Post(':id/convert-incident')
  @RequirePermissions({ action: 'edit', subject: 'Petition' })
  convertToIncident(
    @Param('id') id: string,
    @Body() dto: ConvertToIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.convertToIncident(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // POST /api/v1/petitions/:id/convert-case — Chuyển thành Vụ án
  @Post(':id/convert-case')
  @RequirePermissions({ action: 'edit', subject: 'Petition' })
  convertToCase(
    @Param('id') id: string,
    @Body() dto: ConvertToCaseDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.convertToCase(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // PATCH /api/v1/petitions/:id/assign — Phân công / tái phân công đơn thư (dispatcher only)
  @Patch(':id/assign')
  @UseGuards(DispatchGuard)
  assignPetition(
    @Param('id') id: string,
    @Body() dto: AssignPetitionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.assignPetition(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Nhóm I: PetitionAssignment CRUD ──────────────────────────────────────

  // GET /api/v1/petitions/:id/assignments — Danh sách cán bộ phân công
  @Get(':id/assignments')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  listAssignments(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.petitionsService.listAssignments(id, req.dataScope);
  }

  // POST /api/v1/petitions/:id/assignments — Thêm cán bộ phân công
  @Post(':id/assignments')
  @RequirePermissions({ action: 'edit', subject: 'Petition' })
  addAssignment(
    @Param('id') id: string,
    @Body() body: { userId: string; role?: 'LEAD' | 'SUPPORT' },
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.addAssignment(
      id,
      body.userId,
      body.role ?? 'SUPPORT',
      user.id,
      req.dataScope,
    );
  }

  // DELETE /api/v1/petitions/:id/assignments/:userId — Xóa cán bộ phân công
  @Delete(':id/assignments/:userId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'edit', subject: 'Petition' })
  removeAssignment(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.removeAssignment(
      id,
      userId,
      user.id,
      req.dataScope,
    );
  }
}
