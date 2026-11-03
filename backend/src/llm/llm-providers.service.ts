import { HttpStatus, Injectable } from '@nestjs/common';
import type { LlmProvider as ProviderRow, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmAdminError } from './llm-admin-error';
import { LlmKeyService } from './llm-key.service';
import type { TokenPrices } from './cost';
import { runKeyTest, type KeyTestReport } from './key-test';
import {
  LlmError,
  type LlmProvider,
  type ModelInfo,
  type ProviderKind,
} from './llm.types';
import { LlmProviderFactory } from './provider-factory';
import {
  CLOUD_KINDS,
  isCloudKind,
  normalizeBaseUrl,
  providerFingerprint,
  roleBlocker,
  validateProviderInput,
} from './provider-rules';

export type ProviderRole = 'PRIMARY' | 'FALLBACK' | 'OFF';

export interface Actor {
  id: string;
  ip?: string;
  userAgent?: string;
}

export interface CreateProviderInput {
  kind: ProviderKind;
  label: string;
  model: string;
  apiKey: string;
  baseUrl?: string | null;
  dataRegion?: string | null;
  zeroRetention?: boolean;
  inputPriceMicroUsdPerMTok?: number | null;
  outputPriceMicroUsdPerMTok?: number | null;
}

export interface UpdateProviderInput {
  label?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string | null;
  dataRegion?: string | null;
  zeroRetention?: boolean;
  inputPriceMicroUsdPerMTok?: number | null;
  outputPriceMicroUsdPerMTok?: number | null;
}

/** What the API shows about a provider. There is deliberately no field that could hold the key. */
export interface ProviderView {
  id: string;
  kind: ProviderKind;
  label: string;
  apiKeyLast4: string;
  baseUrl: string | null;
  model: string;
  dataRegion: string | null;
  zeroRetention: boolean;
  prices: TokenPrices;
  role: ProviderRole;
  fallbackOrder: number | null;
  archivedAt: Date | null;
  test: {
    at: Date | null;
    ok: boolean | null;
    code: string | null;
    latencyMs: number | null;
    byId: string | null;
    /** True while key, model, kind and URL are still the ones the last passing test vouched for. */
    current: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

/** A usable provider with the metadata the gateway records about each call. */
export interface ChainEntry {
  id: string;
  dataRegion: string | null;
  prices: TokenPrices;
  provider: LlmProvider;
}

export interface AssessmentInput {
  fileNumber: string;
  filedAt: Date | string;
  note?: string | null;
}

const MAX_FILE_NUMBER = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class LlmProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: LlmKeyService,
    private readonly audit: AuditService,
    private readonly factory: LlmProviderFactory,
  ) {}

  async list(): Promise<ProviderView[]> {
    const rows = await this.prisma.llmProvider.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async create(
    input: CreateProviderInput,
    actor: Actor,
  ): Promise<ProviderView> {
    this.assertValid(input, true);
    const apiKey = input.apiKey.trim();
    const row = await this.prisma.llmProvider.create({
      data: {
        kind: input.kind,
        label: input.label.trim(),
        model: input.model.trim(),
        baseUrl: this.storedBaseUrl(input.kind, input.baseUrl),
        dataRegion: input.dataRegion?.trim() || null,
        zeroRetention: input.zeroRetention ?? false,
        inputPriceMicroUsdPerMTok: input.inputPriceMicroUsdPerMTok ?? null,
        outputPriceMicroUsdPerMTok: input.outputPriceMicroUsdPerMTok ?? null,
        apiKeyEncrypted: this.keys.encrypt(apiKey),
        apiKeyLast4: apiKey.slice(-4),
        role: 'OFF',
        createdById: actor.id,
      },
    });
    await this.record('LLM_PROVIDER_CREATED', actor, row.id, {
      kind: row.kind,
      model: row.model,
      label: row.label,
      dataRegion: row.dataRegion,
    });
    return this.toView(row);
  }

  async update(
    id: string,
    patch: UpdateProviderInput,
    actor: Actor,
  ): Promise<ProviderView> {
    const row = await this.getActive(id);
    const baseUrl =
      patch.baseUrl === undefined
        ? row.baseUrl
        : this.storedBaseUrl(row.kind, patch.baseUrl);
    this.assertValid(
      {
        kind: row.kind,
        label: patch.label ?? row.label,
        model: patch.model ?? row.model,
        baseUrl,
        apiKey: patch.apiKey ?? null,
      },
      false,
    );

    const newKey = patch.apiKey?.trim();
    const model = patch.model?.trim() ?? row.model;
    // What a key test vouches for: changing any of it voids the test and, with it, the role.
    const identityChanged =
      !!newKey || model !== row.model || baseUrl !== row.baseUrl;

    const updated = await this.prisma.llmProvider.update({
      where: { id },
      data: {
        label: patch.label?.trim() ?? row.label,
        model,
        baseUrl,
        dataRegion:
          patch.dataRegion === undefined
            ? row.dataRegion
            : patch.dataRegion?.trim() || null,
        zeroRetention: patch.zeroRetention ?? row.zeroRetention,
        // Prices are bookkeeping, not part of what a key test vouches for, so changing them keeps the test valid.
        inputPriceMicroUsdPerMTok:
          patch.inputPriceMicroUsdPerMTok === undefined
            ? row.inputPriceMicroUsdPerMTok
            : patch.inputPriceMicroUsdPerMTok,
        outputPriceMicroUsdPerMTok:
          patch.outputPriceMicroUsdPerMTok === undefined
            ? row.outputPriceMicroUsdPerMTok
            : patch.outputPriceMicroUsdPerMTok,
        ...(newKey
          ? {
              apiKeyEncrypted: this.keys.encrypt(newKey),
              apiKeyLast4: newKey.slice(-4),
            }
          : {}),
        ...(identityChanged ? this.clearedTestAndRole() : {}),
      },
    });
    await this.record('LLM_PROVIDER_UPDATED', actor, id, {
      keyChanged: !!newKey,
      modelChanged: model !== row.model,
      baseUrlChanged: baseUrl !== row.baseUrl,
      testVoided: identityChanged,
    });
    return this.toView(updated);
  }

  /** Tests the saved key and records the outcome. A failure also takes the role away. */
  async test(id: string, actor: Actor): Promise<KeyTestReport> {
    const row = await this.getActive(id);
    const apiKey = this.keys.decrypt(row.apiKeyEncrypted);
    const report = await runKeyTest(
      this.factory.create({
        kind: row.kind,
        model: row.model,
        baseUrl: row.baseUrl,
        apiKey,
      }),
    );
    const failedStep = report.steps.find((step) => !step.ok);
    await this.prisma.llmProvider.update({
      where: { id },
      data: {
        lastTestAt: new Date(),
        lastTestOk: report.ok,
        lastTestCode: failedStep?.code ?? null,
        lastTestLatencyMs: report.totalLatencyMs,
        lastTestById: actor.id,
        ...(report.ok
          ? {
              testedFingerprint: providerFingerprint({
                kind: row.kind,
                model: row.model,
                baseUrl: row.baseUrl,
                apiKey,
              }),
            }
          : { testedFingerprint: null, role: 'OFF', fallbackOrder: null }),
      },
    });
    await this.record('LLM_PROVIDER_TESTED', actor, id, {
      ok: report.ok,
      failedStep: failedStep?.id ?? null,
      code: failedStep?.code ?? null,
      latencyMs: report.totalLatencyMs,
      inputTokens: report.inputTokens,
      outputTokens: report.outputTokens,
    });
    return report;
  }

  /** Tests values that are not saved yet. Nothing is written except an audit entry without the key. */
  async testDraft(
    input: CreateProviderInput,
    actor: Actor,
  ): Promise<KeyTestReport> {
    this.assertValid(input, true);
    const report = await runKeyTest(
      this.factory.create({
        kind: input.kind,
        model: input.model.trim(),
        baseUrl: this.storedBaseUrl(input.kind, input.baseUrl),
        apiKey: input.apiKey.trim(),
      }),
    );
    await this.record('LLM_PROVIDER_DRAFT_TESTED', actor, null, {
      kind: input.kind,
      model: input.model.trim(),
      ok: report.ok,
    });
    return report;
  }

  /** Models the provider offers for unsaved values, so the administrator can pick one instead of typing it. */
  async listModelsDraft(input: {
    kind: ProviderKind;
    apiKey: string;
    baseUrl?: string | null;
  }): Promise<ModelInfo[]> {
    this.assertValid(
      {
        kind: input.kind,
        label: '-',
        model: '-',
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
      },
      true,
    );
    return this.fetchModels(
      this.factory.create({
        kind: input.kind,
        model: '-',
        baseUrl: this.storedBaseUrl(input.kind, input.baseUrl),
        apiKey: input.apiKey.trim(),
      }),
    );
  }

  /** Models offered by a saved provider, using its stored key (which never leaves the server). */
  async listModels(id: string): Promise<ModelInfo[]> {
    const row = await this.getActive(id);
    return this.fetchModels(
      this.factory.create({
        kind: row.kind,
        model: row.model,
        baseUrl: row.baseUrl,
        apiKey: this.keys.decrypt(row.apiKeyEncrypted),
      }),
    );
  }

  async setRole(
    id: string,
    change: { role: ProviderRole; fallbackOrder?: number },
    actor: Actor,
  ): Promise<ProviderView> {
    const row = await this.getRow(id);
    if (change.role === 'OFF') {
      const off = await this.prisma.llmProvider.update({
        where: { id },
        data: { role: 'OFF', fallbackOrder: null },
      });
      await this.record('LLM_PROVIDER_ROLE_CHANGED', actor, id, {
        from: row.role,
        to: 'OFF',
      });
      return this.toView(off);
    }

    const blocker = roleBlocker({
      kind: row.kind,
      testedFingerprint: row.testedFingerprint,
      currentFingerprint: this.currentFingerprint(row) ?? '',
      transferAssessmentActive: (await this.activeAssessment()) !== null,
      archived: row.archivedAt !== null,
    });
    if (blocker) {
      throw new LlmAdminError('LLM_ROLE_BLOCKED', HttpStatus.CONFLICT, {
        reason: blocker,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (change.role === 'PRIMARY') {
        // The old PRIMARY steps down first, so the one-primary index is never violated.
        const previous = await tx.llmProvider.findMany({
          where: { role: 'PRIMARY', archivedAt: null, id: { not: id } },
        });
        for (const old of previous) {
          await tx.llmProvider.update({
            where: { id: old.id },
            data: {
              role: 'FALLBACK',
              fallbackOrder: await this.nextFallbackOrder(tx),
            },
          });
        }
      }
      return tx.llmProvider.update({
        where: { id },
        data: {
          role: change.role,
          fallbackOrder:
            change.role === 'FALLBACK'
              ? (change.fallbackOrder ?? (await this.nextFallbackOrder(tx)))
              : null,
        },
      });
    });
    await this.record('LLM_PROVIDER_ROLE_CHANGED', actor, id, {
      from: row.role,
      to: change.role,
    });
    return this.toView(updated);
  }

  async archive(id: string, actor: Actor): Promise<ProviderView> {
    await this.getRow(id);
    const row = await this.prisma.llmProvider.update({
      where: { id },
      data: { archivedAt: new Date(), ...this.clearedRole() },
    });
    await this.record('LLM_PROVIDER_ARCHIVED', actor, id, {});
    return this.toView(row);
  }

  /** Restoring does not give the role back: the provider must be tested and assigned again. */
  async restore(id: string, actor: Actor): Promise<ProviderView> {
    await this.getRow(id);
    const row = await this.prisma.llmProvider.update({
      where: { id },
      data: { archivedAt: null },
    });
    await this.record('LLM_PROVIDER_RESTORED', actor, id, {});
    return this.toView(row);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const row = await this.getRow(id);
    if (row.role !== 'OFF') {
      throw new LlmAdminError('LLM_PROVIDER_IN_USE', HttpStatus.CONFLICT);
    }
    await this.prisma.llmProvider.delete({ where: { id } });
    await this.record('LLM_PROVIDER_DELETED', actor, id, {
      kind: row.kind,
      model: row.model,
    });
  }

  async activeAssessment() {
    return this.prisma.llmTransferAssessment.findFirst({
      where: { withdrawnAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAssessment(input: AssessmentInput, actor: Actor) {
    const fileNumber = input.fileNumber.trim();
    const filedAt = new Date(input.filedAt);
    if (
      !fileNumber ||
      fileNumber.length > MAX_FILE_NUMBER ||
      Number.isNaN(filedAt.getTime()) ||
      filedAt.getTime() > Date.now() + DAY_MS
    ) {
      throw new LlmAdminError('LLM_ASSESSMENT_INVALID', HttpStatus.BAD_REQUEST);
    }
    const created = await this.prisma.llmTransferAssessment.create({
      data: {
        fileNumber,
        filedAt,
        note: input.note?.trim() || null,
        approvedById: actor.id,
      },
    });
    await this.record('LLM_ASSESSMENT_CREATED', actor, created.id, {
      fileNumber,
    });
    return created;
  }

  /**
   * Withdraws the assessment. Cloud providers lose their role in the same transaction, so nothing can still be
   * sent abroad on the strength of an assessment that no longer stands. Self-hosted providers are unaffected.
   */
  async withdrawAssessment(
    actor: Actor,
  ): Promise<{ providersStopped: number }> {
    const active = await this.activeAssessment();
    if (!active) {
      throw new LlmAdminError('LLM_ASSESSMENT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    const stopped = await this.prisma.$transaction(async (tx) => {
      await tx.llmTransferAssessment.updateMany({
        where: { withdrawnAt: null },
        data: { withdrawnAt: new Date(), withdrawnById: actor.id },
      });
      const result = await tx.llmProvider.updateMany({
        where: { kind: { in: [...CLOUD_KINDS] }, role: { not: 'OFF' } },
        data: this.clearedRole(),
      });
      return result.count;
    });
    await this.record('LLM_ASSESSMENT_WITHDRAWN', actor, active.id, {
      providersStopped: stopped,
    });
    return { providersStopped: stopped };
  }

  /**
   * Providers to try for a call, in order: PRIMARY, then FALLBACKs by order. A provider is left out when it is
   * archived, when its test no longer matches its settings, or when it is a cloud kind and no transfer
   * assessment is in force. The gateway calls this on every request, so a withdrawal takes effect immediately.
   */
  async buildChain(): Promise<LlmProvider[]> {
    return (await this.buildChainEntries()).map((entry) => entry.provider);
  }

  /** Like `buildChain`, with what the gateway needs to write lineage and price each call. */
  async buildChainEntries(): Promise<ChainEntry[]> {
    const chain: ChainEntry[] = [];
    for (const row of await this.eligibleRows()) {
      chain.push({
        id: row.id,
        dataRegion: row.dataRegion,
        prices: {
          inputMicroUsdPerMTok: row.inputPriceMicroUsdPerMTok,
          outputMicroUsdPerMTok: row.outputPriceMicroUsdPerMTok,
        },
        provider: this.factory.create({
          kind: row.kind,
          model: row.model,
          baseUrl: row.baseUrl,
          apiKey: this.keys.decrypt(row.apiKeyEncrypted),
        }),
      });
    }
    return chain;
  }

  /**
   * Where a scan would go if a reading were requested now: to a cloud provider (outside the country), to a
   * self-hosted one, or nowhere. Decides which "send" permission a user needs; builds no client and decrypts no key.
   */
  async activeDestinations(): Promise<{ cloud: boolean; internal: boolean }> {
    const rows = await this.eligibleRows();
    return {
      cloud: rows.some((row) => isCloudKind(row.kind)),
      internal: rows.some((row) => !isCloudKind(row.kind)),
    };
  }

  /** PRIMARY then FALLBACKs, minus every provider a call must not use right now. */
  private async eligibleRows() {
    const assessmentActive = (await this.activeAssessment()) !== null;
    const rows = await this.prisma.llmProvider.findMany({
      where: { archivedAt: null, role: { in: ['PRIMARY', 'FALLBACK'] } },
    });
    rows.sort(
      (a, b) =>
        Number(b.role === 'PRIMARY') - Number(a.role === 'PRIMARY') ||
        (a.fallbackOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.fallbackOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return rows.filter((row) => {
      const fingerprint = this.currentFingerprint(row);
      const blocker = roleBlocker({
        kind: row.kind,
        testedFingerprint: row.testedFingerprint,
        currentFingerprint: fingerprint ?? '',
        transferAssessmentActive: assessmentActive,
        archived: false,
      });
      return !blocker && fingerprint !== null;
    });
  }

  // ---------------------------------------------------------------------------------------------------------------

  private assertValid(
    input:
      | CreateProviderInput
      | (Omit<CreateProviderInput, 'apiKey'> & { apiKey: string | null }),
    requireKey: boolean,
  ): void {
    const violations = validateProviderInput(input, { requireKey });
    if (violations.length > 0) {
      throw new LlmAdminError('LLM_PROVIDER_INVALID', HttpStatus.BAD_REQUEST, {
        violations,
      });
    }
  }

  private async fetchModels(provider: LlmProvider): Promise<ModelInfo[]> {
    try {
      return await provider.listModels();
    } catch (error) {
      if (error instanceof LlmError) {
        throw new LlmAdminError(
          'LLM_PROVIDER_CALL_FAILED',
          HttpStatus.BAD_GATEWAY,
          { cause: error.code },
        );
      }
      throw error;
    }
  }

  private storedBaseUrl(
    kind: ProviderKind,
    baseUrl: string | null | undefined,
  ): string | null {
    if (
      CLOUD_KINDS.includes(kind as (typeof CLOUD_KINDS)[number]) ||
      !baseUrl
    ) {
      return null;
    }
    return normalizeBaseUrl(baseUrl);
  }

  private async getRow(id: string): Promise<ProviderRow> {
    const row = await this.prisma.llmProvider.findUnique({ where: { id } });
    if (!row) {
      throw new LlmAdminError('LLM_PROVIDER_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async getActive(id: string): Promise<ProviderRow> {
    const row = await this.getRow(id);
    if (row.archivedAt) {
      throw new LlmAdminError('LLM_PROVIDER_ARCHIVED', HttpStatus.CONFLICT);
    }
    return row;
  }

  /** Fingerprint of the stored settings, or null when the key cannot be decrypted (key ring missing or rotated away). */
  private currentFingerprint(row: ProviderRow): string | null {
    try {
      return providerFingerprint({
        kind: row.kind,
        model: row.model,
        baseUrl: row.baseUrl,
        apiKey: this.keys.decrypt(row.apiKeyEncrypted),
      });
    } catch {
      return null;
    }
  }

  private async nextFallbackOrder(
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const max = await tx.llmProvider.aggregate({
      _max: { fallbackOrder: true },
      where: { role: 'FALLBACK', archivedAt: null },
    });
    return (max._max.fallbackOrder ?? 0) + 1;
  }

  private clearedRole() {
    return { role: 'OFF' as const, fallbackOrder: null };
  }

  private clearedTestAndRole() {
    return {
      ...this.clearedRole(),
      testedFingerprint: null,
      lastTestAt: null,
      lastTestOk: null,
      lastTestCode: null,
      lastTestLatencyMs: null,
      lastTestById: null,
    };
  }

  private toView(row: ProviderRow): ProviderView {
    const fingerprint = this.currentFingerprint(row);
    return {
      id: row.id,
      kind: row.kind,
      label: row.label,
      apiKeyLast4: row.apiKeyLast4,
      baseUrl: row.baseUrl,
      model: row.model,
      dataRegion: row.dataRegion,
      zeroRetention: row.zeroRetention,
      prices: {
        inputMicroUsdPerMTok: row.inputPriceMicroUsdPerMTok,
        outputMicroUsdPerMTok: row.outputPriceMicroUsdPerMTok,
      },
      role: row.role,
      fallbackOrder: row.fallbackOrder,
      archivedAt: row.archivedAt,
      test: {
        at: row.lastTestAt,
        ok: row.lastTestOk,
        code: row.lastTestCode,
        latencyMs: row.lastTestLatencyMs,
        byId: row.lastTestById,
        current: fingerprint !== null && fingerprint === row.testedFingerprint,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async record(
    action: string,
    actor: Actor,
    subjectId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.log({
      userId: actor.id,
      action,
      subject: 'LlmProvider',
      subjectId: subjectId ?? undefined,
      metadata,
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
    });
  }
}
