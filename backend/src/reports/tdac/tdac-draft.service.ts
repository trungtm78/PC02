import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ReportTdcDraft, ReportTdcStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDraftDto, AdjustDraftDto } from './dto/create-draft.dto';

@Injectable()
export class TdacDraftService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDraftDto, userId: string): Promise<ReportTdcDraft> {
    const computedData = {}; // Caller should pre-compute or leave empty; service keeps computedData as passed
    return this.prisma.reportTdcDraft.create({
      data: {
        loaiBaoCao: dto.loaiBaoCao as any,
        fromDate: new Date(dto.fromDate),
        toDate: new Date(dto.toDate),
        teamIds: dto.teamIds,
        computedData,
        status: ReportTdcStatus.DRAFT,
        createdById: userId,
      },
    });
  }

  async findAll(filters: { loaiBaoCao?: string; status?: string }): Promise<ReportTdcDraft[]> {
    return this.prisma.reportTdcDraft.findMany({
      where: {
        ...(filters.loaiBaoCao ? { loaiBaoCao: filters.loaiBaoCao as any } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<ReportTdcDraft> {
    const draft = await this.prisma.reportTdcDraft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException(`ReportTdcDraft #${id} not found`);
    return draft;
  }

  async update(id: string, dto: AdjustDraftDto, _userId: string): Promise<ReportTdcDraft> {
    const draft = await this.findOne(id);
    if (draft.status === ReportTdcStatus.FINALIZED) {
      throw new BadRequestException('Cannot update a FINALIZED draft');
    }
    return this.prisma.reportTdcDraft.update({
      where: { id },
      data: {
        ...(dto.adjustedData !== undefined ? { adjustedData: dto.adjustedData } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async submitReview(id: string, userId: string): Promise<ReportTdcDraft> {
    const draft = await this.findOne(id);
    if (draft.status !== ReportTdcStatus.DRAFT) {
      throw new BadRequestException(`Cannot submit review: draft is in status ${draft.status}`);
    }
    return this.prisma.reportTdcDraft.update({
      where: { id },
      data: {
        status: ReportTdcStatus.REVIEWING,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
    });
  }

  async approve(id: string, userId: string): Promise<ReportTdcDraft> {
    const draft = await this.findOne(id);
    if (draft.status !== ReportTdcStatus.REVIEWING) {
      throw new BadRequestException(`Cannot approve: draft is in status ${draft.status}`);
    }
    return this.prisma.reportTdcDraft.update({
      where: { id },
      data: {
        status: ReportTdcStatus.APPROVED,
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  }

  async reject(id: string, userId: string, reason: string): Promise<ReportTdcDraft> {
    const draft = await this.findOne(id);
    if (draft.status !== ReportTdcStatus.REVIEWING) {
      throw new BadRequestException(`Cannot reject: draft is in status ${draft.status}`);
    }
    return this.prisma.reportTdcDraft.update({
      where: { id },
      data: {
        status: ReportTdcStatus.REJECTED,
        rejectedById: userId,
        rejectedAt: new Date(),
        rejectedReason: reason,
        reviewedById: null,
        reviewedAt: null,
      },
    });
  }

  async reopen(id: string, _userId: string): Promise<ReportTdcDraft> {
    const draft = await this.findOne(id);
    if (draft.status !== ReportTdcStatus.REJECTED) {
      throw new BadRequestException(`Cannot reopen: draft is in status ${draft.status}`);
    }
    return this.prisma.reportTdcDraft.update({
      where: { id },
      data: {
        status: ReportTdcStatus.DRAFT,
        rejectedById: null,
        rejectedAt: null,
        rejectedReason: null,
      },
    });
  }

  async finalize(id: string, _userId: string): Promise<ReportTdcDraft> {
    // Optimistic lock: only update if still APPROVED
    const result = await this.prisma.reportTdcDraft.updateMany({
      where: { id, status: ReportTdcStatus.APPROVED },
      data: {
        status: ReportTdcStatus.FINALIZED,
        finalizedAt: new Date(),
      },
    });

    if (result.count === 0) {
      // Either not found or not in APPROVED state
      const draft = await this.prisma.reportTdcDraft.findUnique({ where: { id } });
      if (!draft) throw new NotFoundException(`ReportTdcDraft #${id} not found`);
      throw new ConflictException(
        `Cannot finalize: draft is in status ${draft.status} (expected APPROVED). Concurrent modification detected.`,
      );
    }

    return this.prisma.reportTdcDraft.findUnique({ where: { id } }) as Promise<ReportTdcDraft>;
  }
}
