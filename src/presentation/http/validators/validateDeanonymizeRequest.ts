import { ValidationError } from '../errors/ValidationError.js';

const MAX_MESSAGE_LENGTH = 20_000;

export function validateDeanonymizeRequest(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('El cuerpo debe ser un objeto JSON.');
  }

  const anonymizedMessage = (body as { anonymizedMessage?: unknown }).anonymizedMessage;

  if (typeof anonymizedMessage !== 'string') {
    throw new ValidationError('La propiedad anonymizedMessage es obligatoria y debe ser una cadena de texto.');
  }

  if (anonymizedMessage.trim().length === 0) {
    throw new ValidationError('La propiedad anonymizedMessage no puede estar vacía.');
  }

  if (anonymizedMessage.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError('La propiedad anonymizedMessage supera la longitud máxima permitida.');
  }

  return anonymizedMessage;
}
