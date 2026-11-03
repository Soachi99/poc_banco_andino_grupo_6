import { describe, expect, it } from 'vitest';

import { findPrefixedTokens } from '../../../src/domain/services/findPrefixedTokens.js';
import { formatPublicToken, PiiType } from '../../../src/domain/value-objects/PiiType.js';

const secret = 'a'.repeat(32);

describe('findPrefixedTokens', () => {
  it('reads every configured prefix without hardcoding the scan to one type', () => {
    const message = [
      formatPublicToken(PiiType.PersonName, secret),
      formatPublicToken(PiiType.Email, 'b'.repeat(32)),
      formatPublicToken(PiiType.Phone, 'c'.repeat(32)),
    ].join(' ');

    const found = findPrefixedTokens(message);

    expect(found.map((token) => token.prefix)).toEqual(['NAME', 'EMAIL', 'PHONE']);
    expect(found.every((token) => token.wellFormed)).toBe(true);
  });

  it('keeps punctuation outside the token and ignores non-hex text', () => {
    const token = formatPublicToken(PiiType.PersonName, secret);
    const found = findPrefixedTokens(`(${token}), revisa NAME_completo.`);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ raw: token, wellFormed: true });
  });

  it('rejects a short, oversized, uppercase or glued token as malformed', () => {
    const token = formatPublicToken(PiiType.Email, secret);
    const found = findPrefixedTokens(`${token}x NAME_abc NAME_ PHONE_${'D'.repeat(32)} EMAIL_${'a'.repeat(33)}`);

    expect(found.map((match) => match.raw)).toEqual([
      `${token}x`,
      'NAME_abc',
      'NAME_',
      `PHONE_${'D'.repeat(32)}`,
      `EMAIL_${'a'.repeat(33)}`,
    ]);
    expect(found.every((match) => !match.wellFormed)).toBe(true);
  });
});
