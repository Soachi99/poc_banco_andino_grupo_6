import { DomainError } from '../../domain/errors/DomainError.js';
import { MalformedTokenError, UnknownTokenError } from '../../domain/errors/TokenErrors.js';
import type { TokenMappingRepository } from '../../domain/repositories/TokenMappingRepository.js';
import { findPrefixedTokens, type PrefixedTokenMatch } from '../../domain/services/findPrefixedTokens.js';
import { piiTypeForPrefix } from '../../domain/value-objects/PiiType.js';
import type { DeanonymizeMessageCommand, DeanonymizeMessageResult } from '../dto/DeanonymizeMessageDto.js';

/**
 * Restituye el texto guardado en el vault.
 * Si falta un token o está mal formado, no devuelve una recuperación parcial.
 */
export class DeanonymizeMessageUseCase {
  constructor(private readonly tokenMappingRepository: TokenMappingRepository) {}

  async execute(command: DeanonymizeMessageCommand): Promise<DeanonymizeMessageResult> {
    const { anonymizedMessage } = command;
    const matches = findPrefixedTokens(anonymizedMessage);
    const malformed = matches.filter((match) => !match.wellFormed);

    if (malformed.length > 0) {
      throw new MalformedTokenError(malformed.map((match) => match.raw));
    }

    const tokens = matches.filter((match): match is Extract<PrefixedTokenMatch, { wellFormed: true }> => match.wellFormed);
    const originals = new Map<string, string>();
    const unknown: string[] = [];

    for (const token of tokens) {
      if (originals.has(token.raw) || unknown.includes(token.raw)) {
        continue;
      }

      const mapping = await this.tokenMappingRepository.findByToken(token.secret);
      const expectedType = piiTypeForPrefix(token.prefix);

      if (!mapping || mapping.piiType !== expectedType) {
        unknown.push(token.raw);
        continue;
      }

      originals.set(token.raw, mapping.originalValue);
    }

    if (unknown.length > 0) {
      throw new UnknownTokenError(unknown);
    }

    let message = '';
    let cursor = 0;

    for (const token of tokens) {
      const original = originals.get(token.raw);
      if (original === undefined || token.start < cursor) {
        throw new DomainError('No se puede desanonimizar el mensaje.');
      }

      message += anonymizedMessage.slice(cursor, token.start) + original;
      cursor = token.end;
    }

    message += anonymizedMessage.slice(cursor);
    return { message };
  }
}
