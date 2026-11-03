import { HttpStatus, Injectable } from '@nestjs/common';
import { AnthropicProvider } from './anthropic.adapter';
import { GeminiProvider } from './gemini.adapter';
import { OpenAiCompatibleProvider } from './openai-compatible.adapter';
import { LlmAdminError } from './llm-admin-error';
import type { LlmProvider, ProviderKind } from './llm.types';

export interface ProviderSettings {
  kind: ProviderKind;
  model: string;
  baseUrl: string | null;
  apiKey: string;
}

/** Builds a callable provider from stored settings. One adapter per wire protocol. */
@Injectable()
export class LlmProviderFactory {
  create(settings: ProviderSettings): LlmProvider {
    switch (settings.kind) {
      case 'ANTHROPIC':
        return new AnthropicProvider({
          apiKey: settings.apiKey,
          model: settings.model,
        });
      case 'GEMINI':
        return new GeminiProvider({
          apiKey: settings.apiKey,
          model: settings.model,
        });
      case 'OPENAI':
        // The cloud host is fixed in the adapter; a base URL stored with this kind is never used.
        return new OpenAiCompatibleProvider({
          kind: 'OPENAI',
          apiKey: settings.apiKey,
          model: settings.model,
        });
      case 'SELF_HOSTED':
        if (!settings.baseUrl) {
          throw new LlmAdminError(
            'LLM_PROVIDER_INVALID',
            HttpStatus.BAD_REQUEST,
            {
              violations: [{ field: 'baseUrl', rule: 'REQUIRED' }],
            },
          );
        }
        return new OpenAiCompatibleProvider({
          kind: 'SELF_HOSTED',
          apiKey: settings.apiKey,
          model: settings.model,
          baseUrl: settings.baseUrl,
        });
      default: {
        const unreachable: never = settings.kind;
        throw new Error(`unhandled provider kind ${String(unreachable)}`);
      }
    }
  }
}
