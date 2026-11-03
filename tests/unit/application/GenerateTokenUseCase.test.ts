import { describe, expect, it } from 'vitest';

import { TokenMapping } from '../../../src/domain/entities/TokenMapping.js';
import type { TokenGenerator } from '../../../src/domain/services/TokenGenerator.js';
import { PiiType } from '../../../src/domain/value-objects/PiiType.js';
import { Token } from '../../../src/domain/value-objects/Token.js';
import { GenerateTokenUseCase } from '../../../src/application/use-cases/GenerateTokenUseCase.js';
import { InMemoryTokenMappingRepository } from '../../../src/infrastructure/persistence/InMemoryTokenMappingRepository.js';

describe('GenerateTokenUseCase', () => {
  it('reuses the stored token for the same type and value', async () => {
    const generator = new ScriptedTokenGenerator(['a'.repeat(32), 'b'.repeat(32)]);
    const repository = new InMemoryTokenMappingRepository();
    const useCase = new GenerateTokenUseCase(generator, repository);

    const first = await useCase.execute(PiiType.Email, 'ada@lovelace.dev', 'Ada@Lovelace.dev');
    const second = await useCase.execute(PiiType.Email, 'ada@lovelace.dev', 'ADA@lovelace.dev');

    expect(second.value).toBe(first.value);
    expect(generator.calls).toBe(1);
    expect((await repository.findByPii(PiiType.Email, 'ada@lovelace.dev'))?.originalValue).toBe('Ada@Lovelace.dev');
  });

  it('keeps different PII types on different tokens', async () => {
    const generator = new ScriptedTokenGenerator(['a'.repeat(32), 'b'.repeat(32)]);
    const useCase = new GenerateTokenUseCase(generator, new InMemoryTokenMappingRepository());

    const asEmail = await useCase.execute(PiiType.Email, '3152319157', '3152319157');
    const asPhone = await useCase.execute(PiiType.Phone, '3152319157', '3152319157');

    expect(asEmail.value).not.toBe(asPhone.value);
  });

  it('retries when the generated token is already in use', async () => {
    const repository = new InMemoryTokenMappingRepository();
    const collided = 'a'.repeat(32);
    await repository.save(
      TokenMapping.create({
        piiType: PiiType.Phone,
        normalizedValue: '3000000000',
        originalValue: '3000000000',
        token: Token.create(collided),
      }),
    );

    const generator = new ScriptedTokenGenerator([collided, 'b'.repeat(32)]);
    const useCase = new GenerateTokenUseCase(generator, repository);
    const token = await useCase.execute(PiiType.Email, 'ada@lovelace.dev', 'ada@lovelace.dev');

    expect(token.value).toBe('b'.repeat(32));
  });
});

class ScriptedTokenGenerator implements TokenGenerator {
  calls = 0;

  constructor(private readonly values: readonly string[]) {}

  generate(): Token {
    const value = this.values[this.calls] ?? this.values[this.values.length - 1] ?? '';
    this.calls += 1;
    return Token.create(value);
  }
}
