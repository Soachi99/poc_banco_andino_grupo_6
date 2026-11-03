import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TokenMapping } from '../../src/domain/entities/TokenMapping.js';
import {
  LanguageModelRateLimitError,
  LanguageModelResponseError,
  LanguageModelTimeoutError,
  LanguageModelUnavailableError,
} from '../../src/domain/errors/LanguageModelErrors.js';
import type { LanguageModelCompletion, LanguageModelProvider } from '../../src/domain/services/LanguageModelProvider.js';
import { formatPublicToken, PiiType } from '../../src/domain/value-objects/PiiType.js';
import { Token } from '../../src/domain/value-objects/Token.js';
import { InMemoryTokenMappingRepository } from '../../src/infrastructure/persistence/InMemoryTokenMappingRepository.js';
import { createApp } from '../../src/main/createApp.js';

const prompt =
  'Redacta un correo para Dago Borda, cuyo email es dborda@gmail.com y teléfono 3152319157, informándole sobre una entrevista de trabajo.';

describe('POST /secureChatGPT', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the deanonymized answer and never forwards the original PII', async () => {
    const model = new ScriptedModel((input) => {
      const name = requiredToken(input, 'NAME');
      const email = requiredToken(input, 'EMAIL');
      const phone = requiredToken(input, 'PHONE');
      return `Hola ${name}, queremos invitarte a una entrevista de trabajo. Puedes confirmar tu asistencia escribiendo a ${email} o llamando al ${phone}.`;
    });
    const app = createApp({ languageModel: model });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await request(app).post('/secureChatGPT').send({ prompt });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      response:
        'Hola Dago Borda, queremos invitarte a una entrevista de trabajo. Puedes confirmar tu asistencia escribiendo a dborda@gmail.com o llamando al 3152319157.',
    });
    expect(model.inputs.join('\n')).not.toContain('Dago Borda');
    expect(model.inputs.join('\n')).not.toContain('dborda@gmail.com');
    expect(model.inputs.join('\n')).not.toContain('3152319157');
    expect(`${log.mock.calls.flat().join(' ')} ${errorLog.mock.calls.flat().join(' ')}`).not.toContain('dborda@gmail.com');
  });

  it('rejects a vault token that this prompt did not issue', async () => {
    const repository = new InMemoryTokenMappingRepository();
    const foreignSecret = 'c'.repeat(32);
    await repository.save(
      TokenMapping.create({
        piiType: PiiType.PersonName,
        normalizedValue: 'secreto ajeno',
        originalValue: 'Secreto Ajeno',
        token: Token.create(foreignSecret),
      }),
    );
    const app = createApp({
      tokenMappingRepository: repository,
      languageModel: new ScriptedModel(() => `Datos de ${formatPublicToken(PiiType.PersonName, foreignSecret)}.`),
    });

    const response = await request(app).post('/secureChatGPT').send({ prompt });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: 'La respuesta contiene tokens que no pertenecen a esta solicitud.' });
    expect(JSON.stringify(response.body)).not.toContain('Secreto Ajeno');
    expect(JSON.stringify(response.body)).not.toContain('dborda@gmail.com');
  });

  it('rejects an empty prompt and a prompt over the size limit', async () => {
    const app = createApp({ languageModel: new ScriptedModel(() => 'no debe llamarse') });

    const missing = await request(app).post('/secureChatGPT').send({});
    const oversized = await request(app).post('/secureChatGPT').send({ prompt: 'a'.repeat(20_001) });

    expect(missing.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(missing.body.error).toEqual(expect.any(String));
  });

  it.each([
    [new LanguageModelTimeoutError(), 504],
    [new LanguageModelRateLimitError(), 429],
    [new LanguageModelUnavailableError(), 503],
    [new LanguageModelResponseError(), 502],
  ])('maps %s to HTTP %s without logging the prompt', async (failure, status) => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createApp({
      languageModel: new ScriptedModel(() => {
        throw failure;
      }),
    });

    const response = await request(app).post('/secureChatGPT').send({ prompt });

    expect(response.status).toBe(status);
    expect(JSON.stringify(response.body)).not.toContain('dborda@gmail.com');
    expect(JSON.stringify(response.body)).not.toContain('Dago Borda');
    expect(errorLog.mock.calls.flat().join(' ')).toBe(failure.name);
  });

  it('does not log an unexpected provider message that contains PII', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createApp({
      languageModel: new ScriptedModel(() => {
        throw new Error('fallo con dborda@gmail.com');
      }),
    });

    const response = await request(app).post('/secureChatGPT').send({ prompt });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Error interno del servidor.' });
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain('dborda@gmail.com');
  });
});

class ScriptedModel implements LanguageModelProvider {
  readonly inputs: string[] = [];

  constructor(private readonly reply: (input: string) => string) {}

  async complete(request: LanguageModelCompletion): Promise<string> {
    this.inputs.push(request.input);
    return this.reply(request.input);
  }
}

function requiredToken(input: string, prefix: string): string {
  const token = input.match(new RegExp(`${prefix}_[a-f0-9]{32}`))?.[0];
  if (!token) {
    throw new Error(`Falta el token ${prefix}.`);
  }

  return token;
}
