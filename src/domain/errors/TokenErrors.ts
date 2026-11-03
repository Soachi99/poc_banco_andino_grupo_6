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

/**
 * El texto trae un seudónimo que esta solicitud no emitió, o uno alterado.
 * No enumera los identificadores: el texto puede venir de un modelo y no es confiable.
 */
export class UnauthorizedTokenError extends DomainError {
  constructor() {
    super('La respuesta contiene tokens que no pertenecen a esta solicitud.');
    this.name = 'UnauthorizedTokenError';
  }
}
