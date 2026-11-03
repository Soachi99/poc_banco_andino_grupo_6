import { DetectedPii } from '../../domain/entities/DetectedPii.js';
import { PiiType } from '../../domain/value-objects/PiiType.js';
import type { PiiDetectionStrategy } from './PiiDetectionStrategy.js';

const PHONE_PATTERNS = [
  /\+\d{1,3}(?:[\s.-]?\d){7,14}\b/g,
  /(?<!\d)(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}(?!\d)/g,
  /(?<!\d)\d{10}(?!\d)/g,
];

const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

export class PhoneDetectionStrategy implements PiiDetectionStrategy {
  readonly piiType = PiiType.Phone;

  detect(message: string): readonly DetectedPii[] {
    const detections: DetectedPii[] = [];

    for (const pattern of PHONE_PATTERNS) {
      for (const match of message.matchAll(new RegExp(pattern.source, pattern.flags))) {
        const rawValue = match[0];
        const start = match.index;
        const normalizedValue = rawValue.replace(/\D/g, '');
        if (start === undefined || normalizedValue.length < MIN_PHONE_DIGITS || normalizedValue.length > MAX_PHONE_DIGITS) {
          continue;
        }

        detections.push(
          DetectedPii.create({
            type: this.piiType,
            rawValue,
            normalizedValue,
            start,
            end: start + rawValue.length,
          }),
        );
      }
    }

    return detections;
  }
}
