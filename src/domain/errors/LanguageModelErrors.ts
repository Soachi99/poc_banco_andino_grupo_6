/**
 * Fallos del proveedor de lenguaje.
 * El mensaje es fijo: no incluye el prompt, la respuesta ni la credencial.
 */
export class LanguageModelUnavailableError extends Error {
  constructor(message = 'El servicio de lenguaje no está disponible.') {
    super(message);
    this.name = 'LanguageModelUnavailableError';
  }
}

export class LanguageModelTimeoutError extends Error {
  constructor() {
    super('El servicio de lenguaje no respondió a tiempo.');
    this.name = 'LanguageModelTimeoutError';
  }
}

export class LanguageModelRateLimitError extends Error {
  constructor() {
    super('El servicio de lenguaje alcanzó el límite de consumo.');
    this.name = 'LanguageModelRateLimitError';
  }
}

export class LanguageModelResponseError extends Error {
  constructor() {
    super('El servicio de lenguaje devolvió una respuesta que no se puede usar.');
    this.name = 'LanguageModelResponseError';
  }
}
