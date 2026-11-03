import { DomainError } from '../errors/DomainError.js';
import { isPiiType, type PiiType } from '../value-objects/PiiType.js';
import type { Token } from '../value-objects/Token.js';

export interface TokenMappingProps {
  piiType: PiiType;
  normalizedValue: string;
  originalValue: string;
  token: Token;
  createdAt?: Date;
}

/**
 * Vínculo reversible entre un dato sensible y su seudónimo.
 * Conservarlo permite una desanonimización controlada posterior.
 * originalValue es el texto recuperable. normalizedValue solo identifica el dato.
 */
export class TokenMapping {
  private constructor(
    readonly piiType: PiiType,
    readonly normalizedValue: string,
    readonly originalValue: string,
    readonly token: Token,
    readonly createdAt: Date,
  ) {}

  static create(props: TokenMappingProps): TokenMapping {
    if (!isPiiType(props.piiType)) {
      throw new DomainError('El tipo de PII no es válido.');
    }

    if (props.normalizedValue.trim().length === 0) {
      throw new DomainError('El valor sensible normalizado no puede estar vacío.');
    }

    if (props.originalValue.length === 0) {
      throw new DomainError('El valor original no puede estar vacío.');
    }

    return new TokenMapping(
      props.piiType,
      props.normalizedValue,
      props.originalValue,
      props.token,
      props.createdAt ?? new Date(),
    );
  }
}
