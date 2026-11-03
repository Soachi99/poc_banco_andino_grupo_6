import { describe, expect, it } from 'vitest';

import { DetectPiiUseCase } from '../../../src/application/use-cases/DetectPiiUseCase.js';
import { EmailDetectionStrategy } from '../../../src/infrastructure/detection/EmailDetectionStrategy.js';
import { PersonNameDetectionStrategy } from '../../../src/infrastructure/detection/PersonNameDetectionStrategy.js';
import { PhoneDetectionStrategy } from '../../../src/infrastructure/detection/PhoneDetectionStrategy.js';
import { RegexPiiDetector } from '../../../src/infrastructure/detection/RegexPiiDetector.js';
import { PiiType } from '../../../src/domain/value-objects/PiiType.js';

const detectPii = new DetectPiiUseCase(
  new RegexPiiDetector([
    new EmailDetectionStrategy(),
    new PhoneDetectionStrategy(),
    new PersonNameDetectionStrategy(),
  ]),
);

describe('PII detection', () => {
  it('finds the name, email and phone in the sample offer', async () => {
    const message = 'Oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157';

    const detections = await detectPii.execute(message);

    expect(detections.map((item) => [item.type, item.rawValue])).toEqual([
      [PiiType.PersonName, 'Dago Borda'],
      [PiiType.Email, 'dborda@gmail.com'],
      [PiiType.Phone, '3152319157'],
    ]);
  });

  it('detects compound Spanish names and ignores a following sentence', async () => {
    const detections = await detectPii.execute('Invitar a María de los Ángeles. Ana López confirma.');

    expect(detections.map((item) => item.rawValue)).toEqual(['María de los Ángeles', 'Ana López']);
  });

  it('does not treat a normal sentence as a person name', async () => {
    const detections = await detectPii.execute('Oferta de trabajo para el martes.');

    expect(detections).toEqual([]);
  });

  it('normalizes equivalent emails and phones', async () => {
    const detections = await detectPii.execute('ADA@Lovelace.dev y ada@lovelace.dev, tel 315-231-9157 o 3152319157');

    const emails = detections.filter((item) => item.type === PiiType.Email);
    const phones = detections.filter((item) => item.type === PiiType.Phone);

    expect(emails.map((item) => item.normalizedValue)).toEqual(['ada@lovelace.dev', 'ada@lovelace.dev']);
    expect(phones.map((item) => item.normalizedValue)).toEqual(['3152319157', '3152319157']);
  });

  it('keeps a single international phone instead of an inner local number', async () => {
    const detections = await detectPii.execute('Llama al +57 315 231 9157 hoy.');

    expect(detections.map((item) => item.rawValue)).toEqual(['+57 315 231 9157']);
    expect(detections[0]?.normalizedValue).toBe('573152319157');
  });

  it('treats a title-case sequence as a person name with the current heuristic', async () => {
    const detections = await detectPii.execute('Reunión en Banco Andino.');

    expect(detections.map((item) => item.rawValue)).toEqual(['Banco Andino']);
  });
});
