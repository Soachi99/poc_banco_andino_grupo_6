import type { TokenMapping } from '../../domain/entities/TokenMapping.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import type { TokenMappingRepository } from '../../domain/repositories/TokenMappingRepository.js';
import type { PiiType } from '../../domain/value-objects/PiiType.js';

/**
 * Vault volátil del proceso.
 * El adaptador guarda el valor normalizado en claro porque la seudonimización
 * debe poder revertirse. Un adaptador persistente tiene que cifrar ese valor en reposo.
 */
export class InMemoryTokenMappingRepository implements TokenMappingRepository {
  private readonly byPii = new Map<PiiType, Map<string, TokenMapping>>();
  private readonly byToken = new Map<string, TokenMapping>();

  async findByPii(piiType: PiiType, normalizedValue: string): Promise<TokenMapping | null> {
    return this.byPii.get(piiType)?.get(normalizedValue) ?? null;
  }

  async findByToken(token: string): Promise<TokenMapping | null> {
    return this.byToken.get(token) ?? null;
  }

  async save(mapping: TokenMapping): Promise<void> {
    const values = this.bucket(mapping.piiType);

    if (values.has(mapping.normalizedValue)) {
      throw new DomainError('El dato sensible ya tiene un token asociado.');
    }

    if (this.byToken.has(mapping.token.value)) {
      throw new DomainError('El token ya está asociado a otro dato.');
    }

    values.set(mapping.normalizedValue, mapping);
    this.byToken.set(mapping.token.value, mapping);
  }

  private bucket(piiType: PiiType): Map<string, TokenMapping> {
    const existing = this.byPii.get(piiType);
    if (existing) {
      return existing;
    }

    const created = new Map<string, TokenMapping>();
    this.byPii.set(piiType, created);
    return created;
  }
}
