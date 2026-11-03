import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { LlmGatewayService } from './llm-gateway.service';
import { LlmProvidersService } from './llm-providers.service';

/**
 * The gateway has an optional injectable `sleep` with a real default. Nest must still be able to build it when the
 * container has no provider for that parameter, otherwise the whole application fails to start.
 */
describe('LlmGatewayService dependency injection', () => {
  it('is built by Nest without an explicit sleep, and works', async () => {
    const module = await Test.createTestingModule({
      providers: [
        LlmGatewayService,
        { provide: PrismaService, useValue: {} },
        { provide: SettingsService, useValue: {} },
        {
          provide: LlmProvidersService,
          useValue: { buildChainEntries: () => Promise.resolve([]) },
        },
      ],
    }).compile();

    const gateway = module.get(LlmGatewayService);
    const error = await gateway
      .call(
        {
          system: 's',
          userText: 'u',
          schemaName: 'x',
          schema: { type: 'object' },
          maxOutputTokens: 1,
        },
        (json) => ({ ok: true as const, value: json }),
        { userId: null, sessionRef: null, promptVersion: 'v1' },
      )
      .catch((e: unknown) => e);
    expect(
      (error as { getResponse(): { code: string } }).getResponse().code,
    ).toBe('LLM_NO_PROVIDER');
  });
});
