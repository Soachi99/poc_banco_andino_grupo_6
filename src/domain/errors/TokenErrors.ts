import { DomainError } from './DomainError.js';

export class MalformedTokenError extends DomainError {
  constructor(tokens: readonly string[]) {
    super(`No se puede desanonimizar el mensaje. Tokens malformados: ${tokens.join(', ')}.`);
    this.name = 'MalformedTokenError';
  }
}

export class UnknownTokenError extends DomainError {
  constructor(tokens: readonly string[]) {
    super(`No se puede desanonimizar el mensaje. Tokens sin registro: ${tokens.join(', ')}.`);
    this.name = 'UnknownTokenError';
  }
}
