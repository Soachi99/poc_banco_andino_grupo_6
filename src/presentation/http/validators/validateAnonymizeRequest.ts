import { ValidationError } from '../errors/ValidationError.js';

const MAX_MESSAGE_LENGTH = 20_000;

export function validateAnonymizeRequest(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('El cuerpo debe ser un objeto JSON.');
  }

  const message = (body as { message?: unknown }).message;

  if (typeof message !== 'string') {
    throw new ValidationError('La propiedad message es obligatoria y debe ser una cadena de texto.');
  }

  if (message.trim().length === 0) {
    throw new ValidationError('La propiedad message no puede estar vacía.');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError('La propiedad message supera la longitud máxima permitida.');
  }

  return message;
}
