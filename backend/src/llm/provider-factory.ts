import { HttpStatus, Injectable } from '@nestjs/common';
import { AnthropicProvider } from './anthropic.adapter';
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
      case 'OPENAI':
      case 'SELF_HOSTED':
        // Their adapters arrive in a later milestone; a configuration can be stored but not yet used.
        throw new LlmAdminError(
          'LLM_PROVIDER_KIND_UNSUPPORTED',
          HttpStatus.NOT_IMPLEMENTED,
          { kind: settings.kind },
        );
      default: {
        const unreachable: never = settings.kind;
        throw new Error(`unhandled provider kind ${String(unreachable)}`);
      }
    }
  }
}
