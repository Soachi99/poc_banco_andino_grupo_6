import { describe, expect, it } from 'vitest';

import { DetectedPii } from '../../../src/domain/entities/DetectedPii.js';
import { selectNonOverlappingDetections } from '../../../src/domain/services/selectNonOverlappingDetections.js';
import { PiiType } from '../../../src/domain/value-objects/PiiType.js';
import { Token } from '../../../src/domain/value-objects/Token.js';
import { DomainError } from '../../../src/domain/errors/DomainError.js';

describe('Token', () => {
  it('accepts a 32-character lowercase hex value', () => {
    expect(Token.create('a'.repeat(32)).value).toBe('a'.repeat(32));
  });

  it('rejects tokens that are not cryptographic hex identifiers', () => {
    expect(() => Token.create('Dago Borda')).toThrow(DomainError);
    expect(() => Token.create('A'.repeat(32))).toThrow(DomainError);
    expect(() => Token.create('ab')).toThrow(DomainError);
  });
});

describe('selectNonOverlappingDetections', () => {
  it('keeps the higher-priority detection when spans overlap', () => {
    const email = detection(PiiType.Email, 0, 10);
    const name = detection(PiiType.PersonName, 4, 14);

    const selected = selectNonOverlappingDetections([name, email]);

    expect(selected.map((item) => item.type)).toEqual([PiiType.Email]);
  });

  it('keeps the longer match when two detections share type and overlap', () => {
    const shortPhone = detection(PiiType.Phone, 4, 14);
    const longPhone = detection(PiiType.Phone, 0, 16);

    const selected = selectNonOverlappingDetections([shortPhone, longPhone]);

    expect(selected).toEqual([longPhone]);
  });
});

function detection(type: PiiType, start: number, end: number): DetectedPii {
  const rawValue = 'x'.repeat(end - start);
  return DetectedPii.create({
    type,
    rawValue,
    normalizedValue: rawValue,
    start,
    end,
  });
}
