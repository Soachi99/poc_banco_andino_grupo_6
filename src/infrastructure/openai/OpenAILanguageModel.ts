import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from 'openai';

import {
  LanguageModelRateLimitError,
  LanguageModelResponseError,
  LanguageModelTimeoutError,
  LanguageModelUnavailableError,
} from '../../domain/errors/LanguageModelErrors.js';
import type { LanguageModelCompletion, LanguageModelProvider } from '../../domain/services/LanguageModelProvider.js';
import { readOpenAiSettings, type OpenAiSettings } from './readOpenAiSettings.js';

const MAX_MODEL_OUTPUT_CHARS = 20_000;

export interface OpenAiResponseRequest {
  model: string;
  instructions: string;
  input: string;
  store: false;
  max_output_tokens: number;
}

export interface OpenAiRequestOptions {
  timeout: number;
  maxRetries: number;
}

export interface OpenAiResponsePayload {
  output_text?: string | null;
  status?: string | null;
  error?: { code?: string | null } | null;
  incomplete_details?: { reason?: string | null } | null;
}

export interface OpenAiResponsesClient {
  create(body: OpenAiResponseRequest, options: OpenAiRequestOptions): Promise<OpenAiResponsePayload>;
}

export type OpenAiClientFactory = (settings: OpenAiSettings) => OpenAiResponsesClient;

/**
 * Adaptador de la Responses API, la interfaz actual del SDK oficial para generar texto.
 * Chat Completions queda como API anterior. store queda en false para no conservar el prompt seudonimizado.
 * Ni la clave ni el texto de la petición salen en errores o en la consola.
 */
export class OpenAILanguageModel implements LanguageModelProvider {
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly createClient: OpenAiClientFactory = createSdkClient,
  ) {}

  async complete(request: LanguageModelCompletion): Promise<string> {
    const settings = readOpenAiSettings(this.env);
    const client = this.createClient(settings);

    try {
      const payload = await client.create(
        {
          model: settings.model,
          instructions: request.instructions,
          input: request.input,
          store: false,
          max_output_tokens: settings.maxOutputTokens,
        },
        { timeout: settings.timeoutMs, maxRetries: 0 },
      );
      return readUsableText(payload);
    } catch (error) {
      throw toLanguageModelError(error);
    }
  }
}

function createSdkClient(settings: OpenAiSettings): OpenAiResponsesClient {
  const client = new OpenAI({
    apiKey: settings.apiKey,
    timeout: settings.timeoutMs,
    maxRetries: 0,
  });

  return {
    create(body, options) {
      return client.responses.create(body, options);
    },
  };
}

function readUsableText(payload: OpenAiResponsePayload): string {
  if (payload.error?.code === 'rate_limit_exceeded') {
    throw new LanguageModelRateLimitError();
  }

  if (payload.error || payload.incomplete_details) {
    throw new LanguageModelResponseError();
  }

  if (payload.status !== undefined && payload.status !== null && payload.status !== 'completed') {
    throw new LanguageModelResponseError();
  }

  const text = payload.output_text;
  if (typeof text !== 'string' || text.trim().length === 0 || text.length > MAX_MODEL_OUTPUT_CHARS) {
    throw new LanguageModelResponseError();
  }

  return text;
}

function toLanguageModelError(error: unknown): Error {
  if (
    error instanceof LanguageModelResponseError ||
    error instanceof LanguageModelTimeoutError ||
    error instanceof LanguageModelRateLimitError ||
    error instanceof LanguageModelUnavailableError
  ) {
    return error;
  }

  if (error instanceof APIConnectionTimeoutError) {
    return new LanguageModelTimeoutError();
  }

  if (error instanceof RateLimitError) {
    return new LanguageModelRateLimitError();
  }

  if (
    error instanceof APIConnectionError ||
    error instanceof AuthenticationError ||
    error instanceof PermissionDeniedError ||
    error instanceof InternalServerError
  ) {
    return new LanguageModelUnavailableError();
  }

  if (error instanceof APIError) {
    if (error.status === 408) {
      return new LanguageModelTimeoutError();
    }

    if (error.status === 429) {
      return new LanguageModelRateLimitError();
    }

    if (error.status === 401 || error.status === 403 || (error.status !== undefined && error.status >= 500)) {
      return new LanguageModelUnavailableError();
    }

    return new LanguageModelResponseError();
  }

  return new LanguageModelUnavailableError();
}
