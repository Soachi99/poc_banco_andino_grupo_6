import { describe, expect, it } from 'vitest';

import { DetectedPii } from '../../../src/domain/entities/DetectedPii.js';
import type { PiiDetector } from '../../../src/domain/services/PiiDetector.js';
import type { TokenGenerator } from '../../../src/domain/services/TokenGenerator.js';
import { formatPublicToken, PiiType } from '../../../src/domain/value-objects/PiiType.js';
import { Token } from '../../../src/domain/value-objects/Token.js';
import { AnonymizeMessageUseCase } from '../../../src/application/use-cases/AnonymizeMessageUseCase.js';
import { DetectPiiUseCase } from '../../../src/application/use-cases/DetectPiiUseCase.js';
import { GenerateTokenUseCase } from '../../../src/application/use-cases/GenerateTokenUseCase.js';
import { EmailDetectionStrategy } from '../../../src/infrastructure/detection/EmailDetectionStrategy.js';
import { PersonNameDetectionStrategy } from '../../../src/infrastructure/detection/PersonNameDetectionStrategy.js';
import { PhoneDetectionStrategy } from '../../../src/infrastructure/detection/PhoneDetectionStrategy.js';
import { RegexPiiDetector } from '../../../src/infrastructure/detection/RegexPiiDetector.js';
import { InMemoryTokenMappingRepository } from '../../../src/infrastructure/persistence/InMemoryTokenMappingRepository.js';
import { CryptoTokenGenerator } from '../../../src/infrastructure/tokenization/CryptoTokenGenerator.js';

const sample = 'Oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157';

describe('AnonymizeMessageUseCase', () => {
  it('replaces each PII value and preserves the rest of the message', async () => {
    const { useCase } = buildPipeline();

    const { anonymizedMessage } = await useCase.execute({ message: sample });

    expect(anonymizedMessage).toMatch(
      /^Oferta de trabajo para NAME_[a-f0-9]{32} con email EMAIL_[a-f0-9]{32} y teléfono PHONE_[a-f0-9]{32}$/,
    );
    expect(anonymizedMessage).not.toContain('Dago Borda');
    expect(anonymizedMessage).not.toContain('dborda@gmail.com');
    expect(anonymizedMessage).not.toContain('3152319157');
  });

  it('uses one token for repeated values in the same request and keeps it for the next one', async () => {
    const repository = new InMemoryTokenMappingRepository();
    const { useCase } = buildPipeline(repository);
    const message = 'Dago Borda escribió a Dago Borda y a DBORDA@gmail.com / dborda@gmail.com';

    const first = await useCase.execute({ message });
    const second = await useCase.execute({ message });
    const tokens = first.anonymizedMessage.match(/[a-f0-9]{32}/g) ?? [];

    expect(tokens).toHaveLength(4);
    expect(tokens[0]).toBe(tokens[1]);
    expect(tokens[2]).toBe(tokens[3]);
    expect(tokens[0]).not.toBe(tokens[2]);
    expect(second.anonymizedMessage).toBe(first.anonymizedMessage);
    expect(await repository.findByPii(PiiType.PersonName, 'dago borda')).not.toBeNull();
    expect(await repository.findByPii(PiiType.Email, 'dborda@gmail.com')).not.toBeNull();
  });

  it('substitutes only the spans reported by the detector', async () => {
    const detector: PiiDetector = {
      async detect() {
        return [
          DetectedPii.create({
            type: PiiType.PersonName,
            rawValue: 'Ada Lovelace',
            normalizedValue: 'ada lovelace',
            start: 0,
            end: 12,
          }),
          DetectedPii.create({
            type: PiiType.PersonName,
            rawValue: 'Ada Lovelace',
            normalizedValue: 'ada lovelace',
            start: 15,
            end: 27,
          }),
        ];
      },
    };
    const generator = new SequenceTokenGenerator();
    const useCase = new AnonymizeMessageUseCase(
      new DetectPiiUseCase(detector),
      new GenerateTokenUseCase(generator, new InMemoryTokenMappingRepository()),
    );

    const result = await useCase.execute({ message: 'Ada Lovelace y Ada Lovelace' });
    const token = formatPublicToken(PiiType.PersonName, 'a'.repeat(32));

    expect(result.anonymizedMessage).toBe(`${token} y ${token}`);
    expect(generator.calls).toBe(1);
  });
});

function buildPipeline(repository = new InMemoryTokenMappingRepository()): {
  useCase: AnonymizeMessageUseCase;
} {
  const useCase = new AnonymizeMessageUseCase(
    new DetectPiiUseCase(
      new RegexPiiDetector([
        new EmailDetectionStrategy(),
        new PhoneDetectionStrategy(),
        new PersonNameDetectionStrategy(),
      ]),
    ),
    new GenerateTokenUseCase(new CryptoTokenGenerator(), repository),
  );

  return { useCase };
}

class SequenceTokenGenerator implements TokenGenerator {
  calls = 0;

  generate(): Token {
    this.calls += 1;
    return Token.create('a'.repeat(32));
  }
}
