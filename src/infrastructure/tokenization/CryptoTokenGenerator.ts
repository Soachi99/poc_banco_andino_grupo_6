import { randomBytes } from 'node:crypto';

import type { TokenGenerator } from '../../domain/services/TokenGenerator.js';
import { Token } from '../../domain/value-objects/Token.js';

const TOKEN_BYTE_LENGTH = 16;

export class CryptoTokenGenerator implements TokenGenerator {
  generate(): Token {
    return Token.create(randomBytes(TOKEN_BYTE_LENGTH).toString('hex'));
  }
}
