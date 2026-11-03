/**
 * Fallos del vault que no revelan el dato sensible ni la tecnología de persistencia.
 * No extienden DomainError: no son reglas de negocio ni deben responder 422.
 */
export class VaultUnavailableError extends Error {
  constructor() {
    super('El vault no está disponible.');
    this.name = 'VaultUnavailableError';
  }
}

export class VaultIntegrityError extends Error {
  constructor() {
    super('No se pudo leer un registro del vault.');
    this.name = 'VaultIntegrityError';
  }
}

export class VaultPersistenceError extends Error {
  constructor() {
    super('No se pudo completar la operación del vault.');
    this.name = 'VaultPersistenceError';
  }
}
