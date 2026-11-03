import { describe, expect, it } from 'vitest';

import { TokenMapping } from '../../../src/domain/entities/TokenMapping.js';
import { MalformedTokenError, UnknownTokenError } from '../../../src/domain/errors/TokenErrors.js';
import type { TokenMappingRepository } from '../../../src/domain/repositories/TokenMappingRepository.js';
import { PiiType, formatPublicToken } from '../../../src/domain/value-objects/PiiType.js';
import { Token } from '../../../src/domain/value-objects/Token.js';
import { AnonymizeMessageUseCase } from '../../../src/application/use-cases/AnonymizeMessageUseCase.js';
import { DeanonymizeMessageUseCase } from '../../../src/application/use-cases/DeanonymizeMessageUseCase.js';
import { DetectPiiUseCase } from '../../../src/application/use-cases/DetectPiiUseCase.js';
import { GenerateTokenUseCase } from '../../../src/application/use-cases/GenerateTokenUseCase.js';
import { EmailDetectionStrategy } from '../../../src/infrastructure/detection/EmailDetectionStrategy.js';
import { PersonNameDetectionStrategy } from '../../../src/infrastructure/detection/PersonNameDetectionStrategy.js';
import { PhoneDetectionStrategy } from '../../../src/infrastructure/detection/PhoneDetectionStrategy.js';
import { RegexPiiDetector } from '../../../src/infrastructure/detection/RegexPiiDetector.js';
import { InMemoryTokenMappingRepository } from '../../../src/infrastructure/persistence/InMemoryTokenMappingRepository.js';
import { CryptoTokenGenerator } from '../../../src/infrastructure/tokenization/CryptoTokenGenerator.js';

describe('DeanonymizeMessageUseCase', () => {
  it('restores the stored text, including repeats, spaces and punctuation', async () => {
    const repository = new CountingRepository(new InMemoryTokenMappingRepository());
    const anonymize = buildAnonymizer(repository);
    const deanonymize = new DeanonymizeMessageUseCase(repository);
    const original = 'María de los Ángeles confirmó a María de los Ángeles: ana+hr@correo.co / (315) 231-9157.';

    const { anonymizedMessage } = await anonymize.execute({ message: original });
    const restored = await deanonymize.execute({ anonymizedMessage });

    expect(restored.message).toBe(original);
    expect(repository.saves).toBeGreaterThan(0);
  });

  it('returns a message without tokens unchanged', async () => {
    const deanonymize = new DeanonymizeMessageUseCase(new InMemoryTokenMappingRepository());
    const anonymizedMessage = 'Hola equipo, la reunión sigue en NAME_completo.';

    await expect(deanonymize.execute({ anonymizedMessage })).resolves.toEqual({ message: anonymizedMessage });
  });

  it('fails the whole operation when any token is unknown or has the wrong prefix', async () => {
    const repository = new InMemoryTokenMappingRepository();
    const emailSecret = 'b'.repeat(32);
    await repository.save(
      TokenMapping.create({
        piiType: PiiType.Email,
        normalizedValue: 'ada@lovelace.dev',
        originalValue: 'Ada@Lovelace.dev',
        token: Token.create(emailSecret),
      }),
    );
    const deanonymize = new DeanonymizeMessageUseCase(repository);
    const known = formatPublicToken(PiiType.Email, emailSecret);
    const unknown = formatPublicToken(PiiType.PersonName, 'c'.repeat(32));
    const wrongPrefix = formatPublicToken(PiiType.PersonName, emailSecret);

    await expect(deanonymize.execute({ anonymizedMessage: `Hola ${known} y ${unknown}` })).rejects.toThrow(UnknownTokenError);
    await expect(deanonymize.execute({ anonymizedMessage: wrongPrefix })).rejects.toThrow(UnknownTokenError);
    await expect(deanonymize.execute({ anonymizedMessage: wrongPrefix })).rejects.toThrow(/Tokens sin registro/);
  });

  it('does not query the vault or return partial data for a malformed token', async () => {
    const repository = new CountingRepository(new InMemoryTokenMappingRepository());
    const anonymize = buildAnonymizer(repository);
    const deanonymize = new DeanonymizeMessageUseCase(repository);
    const { anonymizedMessage } = await anonymize.execute({
      message: 'Oferta para Dago Borda con email dborda@gmail.com',
    });

    repository.finds = 0;

    await expect(deanonymize.execute({ anonymizedMessage: `${anonymizedMessage} NAME_abc` })).rejects.toBeInstanceOf(
      MalformedTokenError,
    );
    expect(repository.finds).toBe(0);
  });
});

function buildAnonymizer(repository: TokenMappingRepository): AnonymizeMessageUseCase {
  return new AnonymizeMessageUseCase(
    new DetectPiiUseCase(
      new RegexPiiDetector([
        new EmailDetectionStrategy(),
        new PhoneDetectionStrategy(),
        new PersonNameDetectionStrategy(),
      ]),
    ),
    new GenerateTokenUseCase(new CryptoTokenGenerator(), repository),
  );
}

class CountingRepository implements TokenMappingRepository {
  finds = 0;
  saves = 0;

  constructor(private readonly inner: TokenMappingRepository) {}

  async findByPii(piiType: TokenMapping['piiType'], normalizedValue: string): Promise<TokenMapping | null> {
    return this.inner.findByPii(piiType, normalizedValue);
  }

  async findByToken(token: string): Promise<TokenMapping | null> {
    this.finds += 1;
    return this.inner.findByToken(token);
  }

  async save(mapping: TokenMapping): Promise<void> {
    this.saves += 1;
    await this.inner.save(mapping);
  }
}
