import { describe, expect, it } from 'vitest';

import type { LanguageModelCompletion, LanguageModelProvider } from '../../../src/domain/services/LanguageModelProvider.js';
import { TokenMapping } from '../../../src/domain/entities/TokenMapping.js';
import { LanguageModelResponseError } from '../../../src/domain/errors/LanguageModelErrors.js';
import { UnauthorizedTokenError } from '../../../src/domain/errors/TokenErrors.js';
import type { TokenMappingRepository } from '../../../src/domain/repositories/TokenMappingRepository.js';
import { formatPublicToken, PiiType } from '../../../src/domain/value-objects/PiiType.js';
import { Token } from '../../../src/domain/value-objects/Token.js';
import { AnonymizeMessageUseCase } from '../../../src/application/use-cases/AnonymizeMessageUseCase.js';
import { DeanonymizeMessageUseCase } from '../../../src/application/use-cases/DeanonymizeMessageUseCase.js';
import { DetectPiiUseCase } from '../../../src/application/use-cases/DetectPiiUseCase.js';
import { GenerateTokenUseCase } from '../../../src/application/use-cases/GenerateTokenUseCase.js';
import { SecureChatGPTUseCase } from '../../../src/application/use-cases/SecureChatGPTUseCase.js';
import { EmailDetectionStrategy } from '../../../src/infrastructure/detection/EmailDetectionStrategy.js';
import { PersonNameDetectionStrategy } from '../../../src/infrastructure/detection/PersonNameDetectionStrategy.js';
import { PhoneDetectionStrategy } from '../../../src/infrastructure/detection/PhoneDetectionStrategy.js';
import { RegexPiiDetector } from '../../../src/infrastructure/detection/RegexPiiDetector.js';
import { InMemoryTokenMappingRepository } from '../../../src/infrastructure/persistence/InMemoryTokenMappingRepository.js';
import { CryptoTokenGenerator } from '../../../src/infrastructure/tokenization/CryptoTokenGenerator.js';

const prompt =
  'Redacta un correo para Dago Borda, cuyo email es dborda@gmail.com y teléfono 3152319157, informándole sobre una entrevista de trabajo.';

describe('SecureChatGPTUseCase', () => {
  it('sends only the anonymized prompt and restores the tokens the model keeps', async () => {
    const repository = new RecordingRepository(new InMemoryTokenMappingRepository());
    const model = new RecordingModel((input) => {
      const name = input.match(/NAME_[a-f0-9]{32}/)?.[0];
      const email = input.match(/EMAIL_[a-f0-9]{32}/)?.[0];
      const phone = input.match(/PHONE_[a-f0-9]{32}/)?.[0];
      return `Hola ${name}, queremos invitarte a una entrevista de trabajo. Puedes confirmar tu asistencia escribiendo a ${email} o llamando al ${phone}.`;
    });
    const { useCase } = buildUseCase(repository, model);

    const result = await useCase.execute({ prompt });

    expect(result.response).toBe(
      'Hola Dago Borda, queremos invitarte a una entrevista de trabajo. Puedes confirmar tu asistencia escribiendo a dborda@gmail.com o llamando al 3152319157.',
    );
    expect(model.requests).toHaveLength(1);
    expect(model.requests[0]?.input).not.toContain('Dago Borda');
    expect(model.requests[0]?.input).not.toContain('dborda@gmail.com');
    expect(model.requests[0]?.input).not.toContain('3152319157');
    expect(model.requests[0]?.instructions).not.toContain('dborda@gmail.com');
    expect(model.requests[0]?.input).toMatch(/NAME_[a-f0-9]{32}/);
  });

  it('allows the model to omit a token and still restores the ones it kept', async () => {
    const model = new RecordingModel((input) => {
      const name = input.match(/NAME_[a-f0-9]{32}/)?.[0];
      return `Hola ${name}, te esperamos en la entrevista.`;
    });
    const { useCase } = buildUseCase(new InMemoryTokenMappingRepository(), model);

    const result = await useCase.execute({ prompt });

    expect(result.response).toBe('Hola Dago Borda, te esperamos en la entrevista.');
    expect(result.response).not.toContain('dborda@gmail.com');
    expect(result.response).not.toContain('3152319157');
  });

  it('does not restore a vault token that was not part of this prompt', async () => {
    const repository = new RecordingRepository(new InMemoryTokenMappingRepository());
    const foreignSecret = 'b'.repeat(32);
    await repository.save(
      TokenMapping.create({
        piiType: PiiType.Email,
        normalizedValue: 'otro@persona.com',
        originalValue: 'otro@persona.com',
        token: Token.create(foreignSecret),
      }),
    );
    const foreignToken = formatPublicToken(PiiType.Email, foreignSecret);
    const model = new RecordingModel(() => `Confirma en ${foreignToken}.`);
    const { useCase, deanonymize } = buildUseCase(repository, model);

    await expect(useCase.execute({ prompt })).rejects.toBeInstanceOf(UnauthorizedTokenError);
    expect(deanonymize.calls).toBe(0);
    expect(repository.tokenLookups).not.toContain(foreignSecret);
  });

  it('rejects an altered, recased, or glued token without restoring the rest', async () => {
    const repository = new InMemoryTokenMappingRepository();
    const altered = buildUseCase(repository, new RecordingModel((input) => alterFirstToken(input)));
    const recased = buildUseCase(repository, new RecordingModel((input) => input.replace('NAME_', 'name_')));
    const glued = buildUseCase(repository, new RecordingModel((input) => input.replace('NAME_', 'xNAME_')));

    await expect(altered.useCase.execute({ prompt })).rejects.toBeInstanceOf(UnauthorizedTokenError);
    await expect(recased.useCase.execute({ prompt })).rejects.toBeInstanceOf(UnauthorizedTokenError);
    await expect(glued.useCase.execute({ prompt })).rejects.toBeInstanceOf(UnauthorizedTokenError);
    expect(altered.deanonymize.calls).toBe(0);
    expect(recased.deanonymize.calls).toBe(0);
    expect(glued.deanonymize.calls).toBe(0);
  });

  it('rejects an empty or oversized model output before restoring anything', async () => {
    const repository = new InMemoryTokenMappingRepository();
    const empty = buildUseCase(repository, new RecordingModel(() => '   '));
    const oversized = buildUseCase(repository, new RecordingModel(() => 'a'.repeat(20_001)));

    await expect(empty.useCase.execute({ prompt })).rejects.toBeInstanceOf(LanguageModelResponseError);
    await expect(oversized.useCase.execute({ prompt })).rejects.toBeInstanceOf(LanguageModelResponseError);
    expect(empty.deanonymize.calls).toBe(0);
    expect(oversized.deanonymize.calls).toBe(0);
  });
});

function alterFirstToken(input: string): string {
  return input.replace(/[a-f0-9]{32}/, (secret) => {
    const last = secret.endsWith('a') ? 'b' : 'a';
    return `${secret.slice(0, -1)}${last}`;
  });
}

function buildUseCase(
  repository: TokenMappingRepository,
  languageModel: LanguageModelProvider,
): { useCase: SecureChatGPTUseCase; deanonymize: CountingDeanonymize } {
  const anonymize = new AnonymizeMessageUseCase(
    new DetectPiiUseCase(
      new RegexPiiDetector([
        new EmailDetectionStrategy(),
        new PhoneDetectionStrategy(),
        new PersonNameDetectionStrategy(),
      ]),
    ),
    new GenerateTokenUseCase(new CryptoTokenGenerator(), repository),
  );
  const deanonymize = new CountingDeanonymize(repository);

  return {
    useCase: new SecureChatGPTUseCase(anonymize, deanonymize, languageModel),
    deanonymize,
  };
}

class CountingDeanonymize extends DeanonymizeMessageUseCase {
  calls = 0;

  override async execute(command: { anonymizedMessage: string }): Promise<{ message: string }> {
    this.calls += 1;
    return super.execute(command);
  }
}

class RecordingModel implements LanguageModelProvider {
  readonly requests: LanguageModelCompletion[] = [];

  constructor(private readonly reply: (input: string) => string) {}

  async complete(request: LanguageModelCompletion): Promise<string> {
    this.requests.push(request);
    return this.reply(request.input);
  }
}

class RecordingRepository implements TokenMappingRepository {
  readonly tokenLookups: string[] = [];

  constructor(private readonly inner: TokenMappingRepository) {}

  findByPii(piiType: PiiType, normalizedValue: string): Promise<TokenMapping | null> {
    return this.inner.findByPii(piiType, normalizedValue);
  }

  async findByToken(token: string): Promise<TokenMapping | null> {
    this.tokenLookups.push(token);
    return this.inner.findByToken(token);
  }

  save(mapping: TokenMapping): Promise<void> {
    return this.inner.save(mapping);
  }
}
