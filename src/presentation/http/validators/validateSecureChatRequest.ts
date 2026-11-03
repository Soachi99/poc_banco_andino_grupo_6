import { ValidationError } from '../errors/ValidationError.js';

const MAX_PROMPT_LENGTH = 20_000;

export function  validateSecureChatRequest(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('El cuerpo debe ser un objeto JSON.');
  }

  const prompt = (body as { prompt?: unknown }).prompt;

  if (typeof prompt !== 'string') {
    throw new ValidationError('La propiedad prompt es obligatoria y debe ser una cadena de texto.');
  }

  if (prompt.trim().length === 0) {
    throw new ValidationError('La propiedad prompt no puede estar vacía.');
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new ValidationError('La propiedad prompt supera la longitud máxima permitida.');
  }

  return prompt;
}
