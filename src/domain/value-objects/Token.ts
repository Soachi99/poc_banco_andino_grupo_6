import { DomainError } from '../errors/DomainError.js';

const TOKEN_PATTERN = /^[a-f0-9]{32}$/;

export class Token {
  private constructor(readonly value: string) {}

  static create(value: string): Token {
    if (!TOKEN_PATTERN.test(value)) {
      throw new DomainError('El token debe ser una cadena hexadecimal de 32 caracteres.');
    }

    return new Token(value);
  }
}
