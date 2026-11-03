import { DomainError } from '../errors/DomainError.js';

export const TOKEN_SECRET_LENGTH = 32;

const TOKEN_PATTERN = new RegExp(`^[a-f0-9]{${TOKEN_SECRET_LENGTH}}$`);

export class Token {
  private constructor(readonly value: string) {}

  static create(value: string): Token {
    if (!TOKEN_PATTERN.test(value)) {
      throw new DomainError(`El token debe ser una cadena hexadecimal de ${TOKEN_SECRET_LENGTH} caracteres.`);
    }

    return new Token(value);
  }
}
