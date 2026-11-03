import { DetectedPii } from '../../domain/entities/DetectedPii.js';
import { PiiType } from '../../domain/value-objects/PiiType.js';
import type { PiiDetectionStrategy } from './PiiDetectionStrategy.js';

const EMAIL_PATTERN =
  /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![A-Za-z0-9.-])/g;

export class EmailDetectionStrategy implements PiiDetectionStrategy {
  readonly piiType = PiiType.Email;

  detect(message: string): readonly DetectedPii[] {
    const detections: DetectedPii[] = [];

    for (const match of message.matchAll(new RegExp(EMAIL_PATTERN.source, EMAIL_PATTERN.flags))) {
      const rawValue = match[0];
      const start = match.index;
      if (start === undefined) {
        continue;
      }

      detections.push(
        DetectedPii.create({
          type: this.piiType,
          rawValue,
          normalizedValue: rawValue.normalize('NFC').trim().toLowerCase(),
          start,
          end: start + rawValue.length,
        }),
      );
    }

    return detections;
  }
}
