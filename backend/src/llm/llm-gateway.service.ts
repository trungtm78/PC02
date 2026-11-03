import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';
import {
  callWithPolicy,
  LlmExhaustedError,
  type AttemptRecord,
  type CallPolicy,
  type PolicyOutcome,
  type Validation,
} from './call-policy';
import {
  budgetLevel,
  dayStartVietnam,
  estimateCostMicroUsd,
  monthStartVietnam,
  type BudgetLevel,
} from './cost';
import { LlmAdminError } from './llm-admin-error';
import { LlmProvidersService, type ChainEntry } from './llm-providers.service';
import type { LlmRequest } from './llm.types';

const DEFAULT_IMAGE_QUOTA_PER_DAY = 200;
const DEFAULT_MONTH_BUDGET_MICRO_USD = 20_000_000;

/** Retries honour the provider's Retry-After up to 30 s; the call runs in a background job, not a web request. */
const POLICY: CallPolicy = {
  maxAttemptsPerProvider: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
};

export interface GatewayContext {
  userId: string | null;
  /** Groups the calls of one intake session in the lineage. */
  sessionRef: string | null;
  /** Version of the prompt that produced the request, so quality can be compared across prompt changes. */
  promptVersion: string;
}

export interface BudgetStatus {
  usedMicroUsd: number;
  capMicroUsd: number;
  level: BudgetLevel;
}

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The only way the application calls an LLM.
 *
 * It refuses when no provider is usable, when the user has used today's image quota, or when the month's spending
 * cap is reached; then tries the configured providers with retry and failover; and records one lineage row per
 * attempt. Lineage holds what left the system (provider, region, tokens, images, cost), never its content.
 */
@Injectable()
export class LlmGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: LlmProvidersService,
    private readonly settings: SettingsService,
    @Optional()
    private readonly sleep: (ms: number) => Promise<void> = realSleep,
  ) {}

  async call<T>(
    request: LlmRequest,
    validate: (json: unknown) => Validation<T>,
    context: GatewayContext,
  ): Promise<PolicyOutcome<T>> {
    const entries = await this.providers.buildChainEntries();
    if (entries.length === 0) {
      throw new LlmAdminError(
        'LLM_NO_PROVIDER',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const images = request.images?.length ?? 0;
    await this.assertQuota(context.userId, images);
    await this.assertBudget();

    let attempts: AttemptRecord[] = [];
    try {
      const outcome = await callWithPolicy(
        entries.map((entry) => entry.provider),
        request,
        validate,
        POLICY,
        { sleep: this.sleep },
      );
      attempts = outcome.attempts;
      return outcome;
    } catch (error) {
      if (error instanceof LlmExhaustedError) attempts = error.attempts;
      throw error;
    } finally {
      await this.writeLineage(attempts, entries, context, images);
    }
  }

  async budgetStatus(): Promise<BudgetStatus> {
    const capMicroUsd = await this.settings.getNumericValue(
      SETTINGS_KEY.LLM_BUDGET_MONTH_MICRO_USD,
      DEFAULT_MONTH_BUDGET_MICRO_USD,
    );
    const spent = await this.prisma.llmCallLineage.aggregate({
      _sum: { estimatedCostMicroUsd: true },
      where: { createdAt: { gte: monthStartVietnam(new Date()) } },
    });
    const usedMicroUsd = spent._sum.estimatedCostMicroUsd ?? 0;
    return {
      usedMicroUsd,
      capMicroUsd,
      level: budgetLevel(usedMicroUsd, capMicroUsd),
    };
  }

  private async assertQuota(
    userId: string | null,
    images: number,
  ): Promise<void> {
    if (!userId || images === 0) return;
    const limit = await this.settings.getNumericValue(
      SETTINGS_KEY.LLM_QUOTA_IMAGES_PER_USER_DAY,
      DEFAULT_IMAGE_QUOTA_PER_DAY,
    );
    if (limit <= 0) return;
    // Only successful attempts count: a failing provider must not eat the officer's quota.
    const sent = await this.prisma.llmCallLineage.aggregate({
      _sum: { imagesSent: true },
      where: {
        userId,
        outcome: 'OK',
        createdAt: { gte: dayStartVietnam(new Date()) },
      },
    });
    const used = sent._sum.imagesSent ?? 0;
    if (used + images > limit) {
      throw new LlmAdminError(
        'LLM_QUOTA_EXCEEDED',
        HttpStatus.TOO_MANY_REQUESTS,
        {
          limit,
          used,
        },
      );
    }
  }

  private async assertBudget(): Promise<void> {
    const status = await this.budgetStatus();
    if (status.level === 'EXHAUSTED') {
      throw new LlmAdminError(
        'LLM_BUDGET_EXHAUSTED',
        HttpStatus.TOO_MANY_REQUESTS,
        { usedMicroUsd: status.usedMicroUsd, capMicroUsd: status.capMicroUsd },
      );
    }
  }

  private async writeLineage(
    attempts: AttemptRecord[],
    entries: ChainEntry[],
    context: GatewayContext,
    images: number,
  ): Promise<void> {
    if (attempts.length === 0) return;
    await this.prisma.llmCallLineage.createMany({
      data: attempts.map((attempt) => {
        const entry = entries.find(
          (e) =>
            e.provider.kind === attempt.providerKind &&
            e.provider.model === attempt.model,
        );
        const tokens =
          attempt.inputTokens === undefined ||
          attempt.outputTokens === undefined
            ? null
            : {
                inputTokens: attempt.inputTokens,
                outputTokens: attempt.outputTokens,
              };
        return {
          sessionRef: context.sessionRef,
          userId: context.userId,
          providerId: entry?.id ?? null,
          providerKind: attempt.providerKind,
          model: attempt.model,
          dataRegion: entry?.dataRegion ?? null,
          outcome: attempt.outcome,
          latencyMs: attempt.latencyMs ?? null,
          inputTokens: attempt.inputTokens ?? null,
          outputTokens: attempt.outputTokens ?? null,
          estimatedCostMicroUsd: tokens
            ? estimateCostMicroUsd(tokens, entry?.prices ?? null)
            : null,
          imagesSent: images,
          promptVersion: context.promptVersion,
        };
      }),
    });
  }
}
