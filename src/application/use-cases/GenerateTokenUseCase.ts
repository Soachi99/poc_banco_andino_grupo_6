import { TokenMapping } from '../../domain/entities/TokenMapping.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import type { TokenMappingRepository } from '../../domain/repositories/TokenMappingRepository.js';
import type { TokenGenerator } from '../../domain/services/TokenGenerator.js';
import type { PiiType } from '../../domain/value-objects/PiiType.js';
import type { Token } from '../../domain/value-objects/Token.js';

const MAX_TOKEN_GENERATION_ATTEMPTS = 5;

/**
 * Asigna un seudónimo a un dato ya normalizado.
 * Reutiliza el vínculo existente y no entrega el valor sensible al generador.
 */
export class GenerateTokenUseCase {
  constructor(
    private readonly tokenGenerator: TokenGenerator,
    private readonly tokenMappingRepository: TokenMappingRepository,
  ) {}

  async execute(piiType: PiiType, normalizedValue: string, originalValue: string): Promise<Token> {
    const existing = await this.tokenMappingRepository.findByPii(piiType, normalizedValue);
    if (existing) {
      return existing.token;
    }

    for (let attempt = 0; attempt < MAX_TOKEN_GENERATION_ATTEMPTS; attempt += 1) {
      const token = this.tokenGenerator.generate();
      const tokenInUse = await this.tokenMappingRepository.findByToken(token.value);
      if (tokenInUse) {
        continue;
      }

      const mapping = TokenMapping.create({ piiType, normalizedValue, originalValue, token });

      try {
        await this.tokenMappingRepository.save(mapping);
        return token;
      } catch (error) {
        const winner = await this.tokenMappingRepository.findByPii(piiType, normalizedValue);
        if (winner) {
          return winner.token;
        }

        if (error instanceof DomainError) {
          continue;
        }

        throw error;
      }
    }

    throw new DomainError('No fue posible generar un token único.');
  }
}
