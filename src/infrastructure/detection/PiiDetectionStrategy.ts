import type { DetectedPii } from '../../domain/entities/DetectedPii.js';
import type { PiiType } from '../../domain/value-objects/PiiType.js';

export interface PiiDetectionStrategy {
  readonly piiType: PiiType;
  detect(message: string): readonly DetectedPii[];
}
