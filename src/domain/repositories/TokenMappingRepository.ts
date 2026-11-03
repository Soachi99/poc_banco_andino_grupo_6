import type { TokenMapping } from '../entities/TokenMapping.js';
import type { PiiType } from '../value-objects/PiiType.js';

/**
 * Persistencia del vínculo dato-token.
 * findByToken deja preparado el camino de desanonimización controlada.
 */
export interface TokenMappingRepository {
  findByPii(piiType: PiiType, normalizedValue: string): Promise<TokenMapping | null>;
  findByToken(token: string): Promise<TokenMapping | null>;
  save(mapping: TokenMapping): Promise<void>;
}
