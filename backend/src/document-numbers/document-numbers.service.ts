import { randomUUID } from 'crypto';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveSource } from './source-resolver';
import { formatValue } from './formula-engine';
import { computePeriodKey } from './period-key.util';
import type { ResolutionContext, Segment, CounterConfig, CommitResult, DraftResult } from './types';
import type { CreateTemplateDto } from './dto/create-template.dto';
import type { UpdateTemplateDto } from './dto/update-template.dto';

interface GetLogsFilter {
  templateId?: string;
  userId?: string;
  fromDate?: Date;
  toDate?: Date;
  page: number;
  pageSize: number;
}

interface CommitOptions {
  draftPreview?: string;
  documentId?: string;
}

@Injectable()
export class DocumentNumbersService {
  constructor(private readonly prisma: PrismaService) {}

  async draft(documentType: string, ctx: ResolutionContext): Promise<DraftResult> {
    const template = await this.findActiveTemplate(documentType);
    const config = template.counterConfig as unknown as CounterConfig;
    const periodKey = computePeriodKey(config.resetPeriod, new Date());

    const counter = await this.prisma.documentNumberCounter.findUnique({
      where: { templateId_periodKey: { templateId: template.id, periodKey } },
      select: { currentValue: true },
    });

    const nextValue = (counter?.currentValue ?? 0) + 1;
    const resolvedSegments = await this.resolveSegments(
      template.segments as unknown as Segment[],
      ctx,
      nextValue,
      config.padding,
    );
    const previewNumber = resolvedSegments.join(template.separator);

    await this.prisma.documentNumberLog.create({
      data: {
        id: randomUUID(),
        templateId: template.id,
        generatedNumber: previewNumber,
        documentType: template.documentType,
        userId: ctx.userId,
        isDraft: true,
      },
    });

    return { previewNumber, isDraft: true, templateId: template.id };
  }

  async commit(
    documentType: string,
    ctx: ResolutionContext,
    options: CommitOptions = {},
  ): Promise<CommitResult> {
    const template = await this.findActiveTemplate(documentType);
    const config = template.counterConfig as unknown as CounterConfig;
    const periodKey = computePeriodKey(config.resetPeriod, new Date());

    // Pre-resolve FORMULA segments outside transaction (reduces lock hold time)
    const formulaValues = await this.preResolveFormulas(
      template.segments as unknown as Segment[],
      ctx,
    );

    let logId = '';

    const number = await this.prisma.$transaction(async (tx: any) => {
      // Cold-start upsert — insert counter row if not exists
      await tx.$executeRaw`
        INSERT INTO "document_number_counters" (id, "templateId", "periodKey", "currentValue", "updatedAt")
        VALUES (gen_random_uuid(), ${template.id}, ${periodKey}, 0, NOW())
        ON CONFLICT ("templateId", "periodKey") DO NOTHING`;

      // Acquire row-level lock
      await tx.$queryRaw`
        SELECT id FROM "document_number_counters"
        WHERE "templateId" = ${template.id} AND "periodKey" = ${periodKey}
        FOR UPDATE`;

      const counter = await tx.documentNumberCounter.findUnique({
        where: { templateId_periodKey: { templateId: template.id, periodKey } },
        select: { currentValue: true },
      });

      let nextValue = (counter?.currentValue ?? 0) + 1;

      if (nextValue > config.maxValue) {
        if (config.resetPeriod === 'MAX_NUMBER') {
          nextValue = config.minValue;
        } else {
          throw new BadRequestException(
            `Đã hết số trong kỳ này (${periodKey}). Liên hệ admin để reset counter.`,
          );
        }
      }

      // Render number with locked counter value
      const renderedSegments = this.renderSegments(
        template.segments as unknown as Segment[],
        formulaValues,
        nextValue,
        config.padding,
      );
      const generatedNumber = renderedSegments.join(template.separator);

      await tx.documentNumberCounter.update({
        where: { templateId_periodKey: { templateId: template.id, periodKey } },
        data: { currentValue: nextValue, updatedAt: new Date() },
      });

      const log = await tx.documentNumberLog.create({
        data: {
          templateId: template.id,
          generatedNumber,
          documentType: template.documentType,
          documentId: options.documentId ?? null,
          userId: ctx.userId,
          isDraft: false,
        },
      });
      logId = log.id;

      return generatedNumber;
    });

    return {
      number,
      logId,
      changed: options.draftPreview !== undefined && options.draftPreview !== number,
    };
  }

  async commitWithTx(
    documentType: string,
    ctx: ResolutionContext,
    tx: any,
    options: CommitOptions = {},
  ): Promise<CommitResult> {
    const template = await this.findActiveTemplate(documentType);
    const config = template.counterConfig as unknown as CounterConfig;
    const periodKey = computePeriodKey(config.resetPeriod, new Date());

    const formulaValues = await this.preResolveFormulas(
      template.segments as unknown as Segment[],
      ctx,
      tx,
    );

    await tx.$executeRaw`
      INSERT INTO "document_number_counters" (id, "templateId", "periodKey", "currentValue", "updatedAt")
      VALUES (gen_random_uuid(), ${template.id}, ${periodKey}, 0, NOW())
      ON CONFLICT ("templateId", "periodKey") DO NOTHING`;

    await tx.$queryRaw`
      SELECT id FROM "document_number_counters"
      WHERE "templateId" = ${template.id} AND "periodKey" = ${periodKey}
      FOR UPDATE`;

    const counter = await tx.documentNumberCounter.findUnique({
      where: { templateId_periodKey: { templateId: template.id, periodKey } },
      select: { currentValue: true },
    });

    let nextValue = (counter?.currentValue ?? 0) + 1;

    if (nextValue > config.maxValue) {
      if (config.resetPeriod === 'MAX_NUMBER') {
        nextValue = config.minValue;
      } else {
        throw new BadRequestException(
          `Đã hết số trong kỳ này (${periodKey}). Liên hệ admin để reset counter.`,
        );
      }
    }

    const renderedSegments = this.renderSegments(
      template.segments as unknown as Segment[],
      formulaValues,
      nextValue,
      config.padding,
    );
    const number = renderedSegments.join(template.separator);

    await tx.documentNumberCounter.update({
      where: { templateId_periodKey: { templateId: template.id, periodKey } },
      data: { currentValue: nextValue, updatedAt: new Date() },
    });

    const log = await tx.documentNumberLog.create({
      data: {
        templateId: template.id,
        generatedNumber: number,
        documentType: template.documentType,
        documentId: options.documentId ?? null,
        userId: ctx.userId,
        isDraft: false,
      },
    });

    return {
      number,
      logId: log.id,
      changed: options.draftPreview !== undefined && options.draftPreview !== number,
    };
  }

  async preview(templateId: string, ctx: ResolutionContext): Promise<{ previewNumber: string }> {
    const template = await this.prisma.documentNumberTemplate.findFirst({
      where: { id: templateId, isActive: true },
    });
    if (!template) throw new NotFoundException(`Template not found: ${templateId}`);

    const config = template.counterConfig as unknown as CounterConfig;
    const periodKey = computePeriodKey(config.resetPeriod, new Date());

    const counter = await this.prisma.documentNumberCounter.findUnique({
      where: { templateId_periodKey: { templateId: template.id, periodKey } },
      select: { currentValue: true },
    });

    const nextValue = (counter?.currentValue ?? 0) + 1;
    const resolvedSegments = await this.resolveSegments(
      template.segments as unknown as Segment[],
      ctx,
      nextValue,
      config.padding,
    );

    return { previewNumber: resolvedSegments.join(template.separator) };
  }

  async buildCtx(userId: string): Promise<ResolutionContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, workId: true, username: true, departmentId: true },
    });
    return {
      userId,
      workId: user?.workId ?? undefined,
      username: user?.username ?? undefined,
      departmentId: user?.departmentId ?? undefined,
    };
  }

  async getLog(logId: string): Promise<{ id: string; userId: string } | null> {
    return this.prisma.documentNumberLog.findUnique({
      where: { id: logId },
      select: { id: true, userId: true },
    });
  }

  async updateLogDocumentId(logId: string, documentId: string): Promise<void> {
    await this.prisma.documentNumberLog.update({
      where: { id: logId },
      data: { documentId },
    });
  }

  async resetCounter(templateId: string): Promise<void> {
    const template = await this.prisma.documentNumberTemplate.findFirst({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException(`Template not found: ${templateId}`);

    const config = template.counterConfig as unknown as CounterConfig;
    const periodKey = computePeriodKey(config.resetPeriod, new Date());

    await this.prisma.documentNumberCounter.update({
      where: { templateId_periodKey: { templateId, periodKey } },
      data: { currentValue: 0, resetAt: new Date() },
    });
  }

  async getStats(templateId: string): Promise<{
    current: number;
    next: number;
    min: number;
    max: number;
    periodKey: string;
  }> {
    const template = await this.prisma.documentNumberTemplate.findFirst({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException(`Template not found: ${templateId}`);

    const config = template.counterConfig as unknown as CounterConfig;
    const periodKey = computePeriodKey(config.resetPeriod, new Date());

    const counter = await this.prisma.documentNumberCounter.findUnique({
      where: { templateId_periodKey: { templateId, periodKey } },
      select: { currentValue: true },
    });

    const current = counter?.currentValue ?? 0;
    return {
      current,
      next: current + 1,
      min: config.minValue,
      max: config.maxValue,
      periodKey,
    };
  }

  // ─── Template CRUD ─────────────────────────────────────────────

  getTemplates() {
    return this.prisma.documentNumberTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  createTemplate(dto: CreateTemplateDto, userId: string) {
    return this.prisma.documentNumberTemplate.create({
      data: { ...(dto as any), createdById: userId },
    });
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    const existing = await this.prisma.documentNumberTemplate.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException(`Template not found: ${id}`);
    return this.prisma.documentNumberTemplate.update({ where: { id }, data: dto as any });
  }

  async deleteTemplate(id: string) {
    const existing = await this.prisma.documentNumberTemplate.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException(`Template not found: ${id}`);
    return this.prisma.documentNumberTemplate.delete({ where: { id } });
  }

  async getLogs(filter: GetLogsFilter) {
    const where: any = {};
    if (filter.templateId) where.templateId = filter.templateId;
    if (filter.userId) where.userId = filter.userId;
    if (filter.fromDate || filter.toDate) {
      where.createdAt = {};
      if (filter.fromDate) where.createdAt.gte = filter.fromDate;
      if (filter.toDate) where.createdAt.lte = filter.toDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.documentNumberLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.documentNumberLog.count({ where }),
    ]);

    return { items, total, page: filter.page, pageSize: filter.pageSize };
  }

  // ─── Private helpers ───────────────────────────────────────────

  private async findActiveTemplate(documentType: string) {
    const template = await this.prisma.documentNumberTemplate.findFirst({
      where: { documentType, isActive: true },
    });
    if (!template) {
      throw new NotFoundException(`No active template for documentType: ${documentType}`);
    }
    return template;
  }

  private async preResolveFormulas(
    segments: Segment[],
    ctx: ResolutionContext,
    prismaArg?: any,
  ): Promise<Map<number, Date | string | number>> {
    const db = prismaArg ?? this.prisma;
    const resolved = new Map<number, Date | string | number>();
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === 'FORMULA' && seg.source) {
        resolved.set(i, await resolveSource(seg.source, ctx, db));
      }
    }
    return resolved;
  }

  private renderSegments(
    segments: Segment[],
    formulaValues: Map<number, Date | string | number>,
    counterValue: number,
    padding: number,
  ): string[] {
    return segments.map((seg, i) => {
      if (seg.type === 'LITERAL') return seg.value ?? '';
      if (seg.type === 'COUNTER') return String(counterValue).padStart(padding, '0');
      if (seg.type === 'FORMULA') {
        const raw = formulaValues.get(i);
        if (raw === undefined) return '';
        return formatValue(raw as any, seg.pattern ?? '');
      }
      return '';
    });
  }

  private async resolveSegments(
    segments: Segment[],
    ctx: ResolutionContext,
    counterValue: number,
    padding: number,
  ): Promise<string[]> {
    const formulaValues = await this.preResolveFormulas(segments, ctx);
    return this.renderSegments(segments, formulaValues, counterValue, padding);
  }
}
