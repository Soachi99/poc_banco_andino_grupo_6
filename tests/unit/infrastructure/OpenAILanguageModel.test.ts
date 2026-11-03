import { APIConnectionTimeoutError, APIError } from 'openai';
import { describe, expect, it, vi } from 'vitest';

import {
  LanguageModelRateLimitError,
  LanguageModelResponseError,
  LanguageModelTimeoutError,
  LanguageModelUnavailableError,
} from '../../../src/domain/errors/LanguageModelErrors.js';
import {
  OpenAILanguageModel,
  type OpenAiClientFactory,
  type OpenAiResponsePayload,
} from '../../../src/infrastructure/openai/OpenAILanguageModel.js';
import type { OpenAiSettings } from '../../../src/infrastructure/openai/readOpenAiSettings.js';

const secretKey = 'sk-test-key';
const leaked = `fallo con ${secretKey} y dborda@gmail.com`;

describe('OpenAILanguageModel', () => {
  it('calls the Responses API with the configured model and does not store the prompt', async () => {
    const seen: { settings?: OpenAiSettings; body?: unknown; options?: unknown } = {};
    const model = new OpenAILanguageModel(configuredEnv(), clientFactory(seen, { output_text: 'texto listo', status: 'completed' }));

    await expect(model.complete({ instructions: 'conserva los seudónimos', input: 'Hola NAME_aa' })).resolves.toBe('texto listo');
    expect(seen.settings?.model).toBe('gpt-test');
    expect(seen.settings?.apiKey).toBe(secretKey);
    expect(seen.body).toEqual({
      model: 'gpt-test',
      instructions: 'conserva los seudónimos',
      input: 'Hola NAME_aa',
      store: false,
      max_output_tokens: 1024,
    });
    expect(seen.options).toEqual({ timeout: 5000, maxRetries: 0 });
  });

  it('uses gpt-6-luna when the model is not configured', async () => {
    const seen: { body?: { model?: string } } = {};
    const env = configuredEnv();
    delete env.OPENAI_MODEL;
    const model = new OpenAILanguageModel(env, clientFactory(seen, { output_text: 'ok', status: 'completed' }));

    await model.complete({ instructions: 'x', input: 'y' });

    expect(seen.body?.model).toBe('gpt-6-luna');
  });

  it('fails closed on an empty, incomplete, or failed payload without echoing it', async () => {
    await expect(completeWith({ output_text: '   ', status: 'completed' })).rejects.toBeInstanceOf(LanguageModelResponseError);
    await expect(
      completeWith({
        output_text: `texto con ${leaked}`,
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
      }),
    ).rejects.toThrow(new LanguageModelResponseError().message);
    await expect(completeWith({ output_text: 'no usar', status: 'failed', error: { code: 'server_error' } })).rejects.toBeInstanceOf(
      LanguageModelResponseError,
    );
  });

  it('maps timeout, rate limit, and upstream failures to safe errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const info = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expectSafeError(completeWithError(new APIConnectionTimeoutError({ message: leaked })), LanguageModelTimeoutError);
    await expectSafeError(
      completeWithError(APIError.generate(429, { error: { message: leaked } }, leaked, new Headers())),
      LanguageModelRateLimitError,
    );
    await expectSafeError(
      completeWithError(APIError.generate(401, { error: { message: leaked } }, leaked, new Headers())),
      LanguageModelUnavailableError,
    );
    await expectSafeError(
      completeWithError(APIError.generate(503, { error: { message: leaked } }, leaked, new Headers())),
      LanguageModelUnavailableError,
    );
    await expectSafeError(
      completeWithError(APIError.generate(400, { error: { message: leaked } }, leaked, new Headers())),
      LanguageModelResponseError,
    );

    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    log.mockRestore();
    info.mockRestore();
  });

  it('does not call OpenAI when the key or the settings are invalid', async () => {
    const factory = vi.fn<OpenAiClientFactory>();
    const missing = new OpenAILanguageModel({}, factory);
    const invalid = new OpenAILanguageModel({ OPENAI_API_KEY: secretKey, OPENAI_MODEL: 'modelo con espacios' }, factory);

    await expect(missing.complete({ instructions: 'x', input: 'y' })).rejects.toThrow('El servicio de lenguaje no está configurado.');
    await expect(invalid.complete({ instructions: 'x', input: 'y' })).rejects.toThrow(
      'La configuración del servicio de lenguaje no es válida.',
    );
    expect(factory).not.toHaveBeenCalled();
  });
});

function configuredEnv(): NodeJS.ProcessEnv {
  return {
    OPENAI_API_KEY: secretKey,
    OPENAI_MODEL: 'gpt-test',
    OPENAI_TIMEOUT_MS: '5000',
  };
}

function clientFactory(
  seen: { settings?: OpenAiSettings; body?: unknown; options?: unknown },
  payload: OpenAiResponsePayload,
): OpenAiClientFactory {
  return (settings) => {
    seen.settings = settings;
    return {
      async create(body, options) {
        seen.body = body;
        seen.options = options;
        return payload;
      },
    };
  };
}

async function expectSafeError(operation: Promise<string>, errorType: new (...args: never[]) => Error): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(errorType);
  await operation.catch((error: Error) => {
    expect(error.message).not.toContain(secretKey);
    expect(error.message).not.toContain('dborda@gmail.com');
  });
}

function completeWith(payload: OpenAiResponsePayload): Promise<string> {
  return new OpenAILanguageModel(configuredEnv(), clientFactory({}, payload)).complete({ instructions: 'x', input: 'y' });
}

function completeWithError(error: unknown): Promise<string> {
  return new OpenAILanguageModel(configuredEnv(), () => ({
    async create() {
      throw error;
    },
  })).complete({ instructions: 'x', input: leaked });
}
