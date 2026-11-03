import type { Token } from '../value-objects/Token.js';

/**
 * Produce un identificador aleatorio.
 * No recibe el dato original: el token no se deriva del valor sensible.
 */
export interface TokenGenerator {
  generate(): Token;
}
