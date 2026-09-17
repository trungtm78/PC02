import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { QueryProposalsDto } from './dto/query-proposals.dto';
import { ProposalStatus, Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import {
  assertParentInScope,
  assertCreatorInScope,
  buildScopeFilter,
} from '../common/utils/scope-filter.util';
import { BcaExcelHelper } from '../common/bca-excel.helper';
import { PROPOSAL_STATUS_LABEL } from '../common/constants/status-labels.constants';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { BoTimKiem } from '../common/tim-kiem/bo-tim-kiem';
import { KHOA_TAT_CA, docKhoangNgay } from '../common/tim-kiem/dieu-kien';
import { KHAI_TIM_KIEM_KIEN_NGHI } from '../common/tim-kiem/khai/kien-nghi.khai';

/** Tham số cũ → khoá thẻ: `search` → mọi cột; `unit` (xuất Excel cũ) → Đơn vị VKS. */
const THAM_SO_CU_KIEN_NGHI = {
  // Ô tìm cũ khớp cả TÊN vụ án liên quan đang hiện trên cột — thẻ `*` chỉ gồm cột trên bảng.
  search: [KHOA_TAT_CA, 'hoSoLienQuan'],
  unit: 'donViVks',
} as const;

/** Khoá thẻ Trạng thái — thống kê bỏ thẻ này như bỏ tham số `status`. */
const KHOA_TRANG_THAI = 'trangThai';

@Injectable()
export class ProposalsService {
  private boTimKiem?: BoTimKiem;

  /** Tạo LƯỜI: khởi tạo ở khai báo field thì `this.prisma` có thể chưa gán. */
  private get timKiem(): BoTimKiem {
    return (this.boTimKiem ??= new BoTimKiem(
      this.prisma,
      KHAI_TIM_KIEM_KIEN_NGHI,
      THAM_SO_CU_KIEN_NGHI,
    ));
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly docNums: DocumentNumbersService,
  ) {}

  async getList(query: QueryProposalsDto, dataScope?: DataScope | null) {
    const { status, limit = 20, offset = 0 } = query;
    const where = await this.dungWhere(query, dataScope);
    if (status) where.status = this.trangThai(status);

    const [data, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          relatedCase: { select: { id: true, name: true } },
        },
        // Khoá sắp phụ `id`: cùng createdAt (nạp hàng loạt) thì thứ tự ổn định giữa các trang.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.proposal.count({ where }),
    ]);

    return {
      success: true,
      data,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    };
  }

  /**
   * Thẻ thống kê của màn — đếm ở MÁY CHỦ trên cùng thẻ, khoảng ngày và phạm vi với danh sách. Bỏ lọc
   * trạng thái (tham số lẫn thẻ): thẻ "Đã gửi" không được về 0 khi đang xem "Chờ gửi". Trước đây màn đếm
   * trên phần đã tải.
   */
  async getStats(query: QueryProposalsDto, dataScope?: DataScope | null) {
    const tk = (
      Array.isArray(query.tk) ? query.tk : query.tk ? [query.tk] : []
    ).filter((t) => !t.startsWith(`${KHOA_TRANG_THAI}~`));
    const where = await this.dungWhere({ ...query, tk }, dataScope);
    const nhom = await this.prisma.proposal.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(
      Object.values(ProposalStatus).map((t) => [t, 0]),
    ) as Record<ProposalStatus, number>;
    for (const n of nhom) byStatus[n.status] = n._count._all;
    const total = Object.values(byStatus).reduce((x, y) => x + y, 0);
    return { total, byStatus };
  }

  /**
   * Where chung của danh sách, thống kê và xuất Excel: thẻ tìm, khoảng ngày, phạm vi dữ liệu.
   *
   * Tìm kiếm và phạm vi là HAI phần tử riêng trong AND. Trước 17/09/2026 cả hai cùng gán `where.OR`,
   * khối phạm vi chạy sau đè mất khối tìm — cán bộ có phạm vi gõ gì cũng ra mọi kiến nghị trong phạm vi.
   */
  private async dungWhere(
    query: QueryProposalsDto,
    dataScope?: DataScope | null,
  ): Promise<Prisma.ProposalWhereInput> {
    const dieuKien = (await this.timKiem.dieuKien(
      query,
    )) as Prisma.ProposalWhereInput[];
    const where: Prisma.ProposalWhereInput = { deletedAt: null };

    // Theo ngày Việt Nam, gồm trọn ngày cuối (trước đây `toDate + 'T23:59:59.999Z'` là 06:59 hôm sau
    // giờ Việt Nam, còn `fromDate` là 07:00 — lệch 7 tiếng ở cả hai đầu).
    const tu = this.khoangNgay(query.fromDate);
    const den = this.khoangNgay(query.toDate);
    if (tu || den)
      where.createdAt = {
        ...(tu && { gte: tu.gte }),
        ...(den && { lt: den.lt }),
      };

    // Phạm vi danh sách KHỚP quyền xem chi tiết (`getById`): gắn vụ án → theo phạm vi vụ án
    // (`assertParentInScope`); không gắn → theo người tạo (`assertCreatorInScope`). Người điều phối đọc
    // toàn bộ (`buildScopeFilter` trả null); tổ trưởng (userIds rỗng, có tổ) thấy mọi kiến nghị không gắn
    // hồ sơ. Trước 17/09/2026 danh sách ẩn hai nhóm này dù màn chi tiết vẫn cho xem.
    if (dataScope && !dataScope.canDispatch) {
      const { userIds, teamIds } = dataScope;
      if (userIds.length === 0 && teamIds.length === 0) {
        dieuKien.push({ id: '__no_access__' });
      } else {
        const caseScope = buildScopeFilter(dataScope);
        const phamVi: Prisma.ProposalWhereInput[] = [];
        if (caseScope)
          phamVi.push({ relatedCase: caseScope as Prisma.CaseWhereInput });
        phamVi.push(
          userIds.length > 0
            ? { relatedCase: null, createdById: { in: userIds } }
            : // Chỉ bản CÓ người tạo: getById (assertCreatorInScope) từ chối bản createdById rỗng — hiện
              // trong danh sách mà mở ra 403 (người tạo bị xoá → SetNull).
              { relatedCase: null, createdById: { not: null } },
        );
        dieuKien.push({ OR: phamVi });
      }
    }
    if (dieuKien.length) where.AND = dieuKien;
    return where;
  }

  private khoangNgay(giaTri?: string) {
    if (!giaTri) return undefined;
    const khoang = docKhoangNgay(giaTri);
    if (!khoang || !/^\d{4}-\d{2}-\d{2}$/.test(giaTri.trim())) {
      throw new BadRequestException(
        `Ngày không hợp lệ: ${giaTri} (dạng yyyy-mm-dd)`,
      );
    }
    return khoang;
  }

  private trangThai(giaTri: string): ProposalStatus {
    if (!(Object.values(ProposalStatus) as string[]).includes(giaTri)) {
      throw new BadRequestException(`Trạng thái không hợp lệ: ${giaTri}`);
    }
    return giaTri as ProposalStatus;
  }

  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.proposal.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
        relatedCase: {
          select: {
            id: true,
            name: true,
            assignedTeamId: true,
            investigatorId: true,
          },
        },
      },
    });
    if (!record)
      throw new NotFoundException(`Đề xuất không tồn tại (id: ${id})`);
    if (record.relatedCase) {
      assertParentInScope(record.relatedCase, dataScope);
    } else {
      assertCreatorInScope(record.createdById, dataScope);
    }
    return { success: true, data: record };
  }

  async create(
    dto: CreateProposalDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    let resolvedProposalNumber: string | undefined = dto.proposalNumber;

    const record = await this.prisma.$transaction(async (tx: any) => {
      if (!resolvedProposalNumber) {
        const { number, logId } = await this.docNums.commitWithTx(
          'PROPOSAL',
          { userId: actorId },
          tx,
        );
        resolvedProposalNumber = number;
        const rec = await tx.proposal.create({
          data: {
            proposalNumber: resolvedProposalNumber,
            relatedCaseId: dto.relatedCaseId,
            caseType: dto.caseType,
            content: dto.content,
            unit: dto.unit,
            createdById: actorId,
            status: dto.status ?? ProposalStatus.CHO_GUI,
            sentDate: dto.sentDate ? new Date(dto.sentDate) : undefined,
            response: dto.response,
            responseDate: dto.responseDate
              ? new Date(dto.responseDate)
              : undefined,
            notes: dto.notes,
          },
          include: {
            createdBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });
        await tx.documentNumberLog.update({
          where: { id: logId },
          data: { documentId: rec.id },
        });
        return rec;
      }
      return tx.proposal.create({
        data: {
          proposalNumber: resolvedProposalNumber,
          relatedCaseId: dto.relatedCaseId,
          caseType: dto.caseType,
          content: dto.content,
          unit: dto.unit,
          createdById: actorId,
          status: dto.status ?? ProposalStatus.CHO_GUI,
          sentDate: dto.sentDate ? new Date(dto.sentDate) : undefined,
          response: dto.response,
          responseDate: dto.responseDate
            ? new Date(dto.responseDate)
            : undefined,
          notes: dto.notes,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });

    await this.audit.log({
      userId: actorId,
      action: 'PROPOSAL_CREATED',
      subject: 'Proposal',
      subjectId: record.id,
      metadata: { proposalNumber: record.proposalNumber },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Tạo đề xuất thành công' };
  }

  async update(
    id: string,
    dto: Partial<CreateProposalDto>,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    if (existing.relatedCase) {
      assertParentInScope(existing.relatedCase, dataScope, 'write');
    } else {
      assertCreatorInScope(existing.createdById, dataScope, 'write');
    }

    const record = await this.prisma.proposal.update({
      where: { id },
      data: {
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.status !== undefined && {
          status: dto.status,
        }),
        ...(dto.sentDate !== undefined && {
          sentDate: dto.sentDate ? new Date(dto.sentDate) : null,
        }),
        ...(dto.response !== undefined && { response: dto.response }),
        ...(dto.responseDate !== undefined && {
          responseDate: dto.responseDate ? new Date(dto.responseDate) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.caseType !== undefined && { caseType: dto.caseType }),
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'PROPOSAL_UPDATED',
      subject: 'Proposal',
      subjectId: id,
      metadata: {
        before: { status: existing.status, content: existing.content },
        after: dto,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Cập nhật đề xuất thành công',
    };
  }

  async delete(
    id: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    if (existing.relatedCase) {
      assertParentInScope(existing.relatedCase, dataScope, 'write');
    } else {
      assertCreatorInScope(existing.createdById, dataScope, 'write');
    }

    await this.prisma.proposal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'PROPOSAL_DELETED',
      subject: 'Proposal',
      subjectId: id,
      metadata: { proposalNumber: existing.proposalNumber },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa đề xuất thành công' };
  }

  // ─────────────────────────────────────────────
  // EXPORT TO EXCEL (Danh sách kiến nghị VKS)
  // ─────────────────────────────────────────────
  async exportToExcel(
    query: QueryProposalsDto,
    dataScope: DataScope | null | undefined,
    res: Response,
  ): Promise<void> {
    // CÙNG điều kiện với danh sách (thẻ, ngày, phạm vi) — tệp xuất ra đúng những dòng cán bộ đang thấy.
    const where = await this.dungWhere(query, dataScope);
    if (query.status) where.status = this.trangThai(query.status);

    const records = await this.prisma.proposal.findMany({
      where,
      take: 500,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        relatedCase: { select: { name: true } },
      },
    });

    const COL_COUNT = 9;
    const HEADERS = [
      'STT',
      'Mã kiến nghị',
      'Hồ sơ liên quan',
      'Nội dung',
      'Đơn vị VKS',
      'Người soạn',
      'Ngày gửi',
      'Trạng thái',
      'Phản hồi',
    ];
    const WIDTHS = [6, 18, 25, 40, 20, 20, 14, 18, 35];

    const fromStr = query.fromDate
      ? new Date(query.fromDate).toLocaleDateString('vi-VN')
      : '';
    const toStr = query.toDate
      ? new Date(query.toDate).toLocaleDateString('vi-VN')
      : '';
    const period =
      fromStr && toStr
        ? `Từ ngày ${fromStr} đến ngày ${toStr}`
        : 'Tất cả thời gian';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh sách kiến nghị VKS');

    BcaExcelHelper.addHeader(
      sheet,
      COL_COUNT,
      'DANH SÁCH KIẾN NGHỊ VKS',
      period,
    );

    const headerRow = sheet.getRow(7);
    BcaExcelHelper.addColumnHeaders(headerRow, HEADERS, WIDTHS);

    records.forEach((rec, idx) => {
      const creatorName = rec.createdBy
        ? `${rec.createdBy.lastName ?? ''} ${rec.createdBy.firstName ?? ''}`.trim()
        : '';
      const dataRow = sheet.addRow([
        idx + 1,
        rec.proposalNumber ?? '',
        rec.relatedCase?.name ?? '',
        rec.content ?? '',
        rec.unit ?? '',
        creatorName,
        rec.sentDate ? rec.sentDate.toLocaleDateString('vi-VN') : '',
        PROPOSAL_STATUS_LABEL[rec.status as ProposalStatus] ?? rec.status ?? '',
        rec.response ?? '',
      ]);
      BcaExcelHelper.styleDataRow(dataRow, idx % 2 === 1, COL_COUNT);
    });

    const lastDataRow = sheet.lastRow?.number ?? 7;
    BcaExcelHelper.addFooter(sheet, lastDataRow + 2, COL_COUNT);
    BcaExcelHelper.setPrintSetup(sheet);

    const filename = `KienNghiVKS_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    try {
      await workbook.xlsx.write(res);
    } catch (err) {
      if (!res.headersSent) res.status(500).json({ error: 'Export failed' });
      else res.destroy();
    }
  }
}
