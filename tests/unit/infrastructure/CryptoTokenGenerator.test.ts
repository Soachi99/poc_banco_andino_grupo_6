import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { CryptoTokenGenerator } from '../../../src/infrastructure/tokenization/CryptoTokenGenerator.js';

describe('CryptoTokenGenerator', () => {
  const generator = new CryptoTokenGenerator();

  it('creates unpredictable lowercase hex tokens without using the sensitive value', () => {
    const sensitiveValue = 'dborda@gmail.com';
    const tokens = new Set(Array.from({ length: 20 }, () => generator.generate().value));

    expect(tokens.size).toBe(20);

    for (const token of tokens) {
      expect(token).toMatch(/^[a-f0-9]{32}$/);
      expect(token).not.toContain(sensitiveValue);
      expect(token).not.toBe(createHash('sha256').update(sensitiveValue).digest('hex').slice(0, 32));
    }
  });
});
