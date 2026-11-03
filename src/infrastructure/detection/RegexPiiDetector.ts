import type { DetectedPii } from '../../domain/entities/DetectedPii.js';
import type { PiiDetector } from '../../domain/services/PiiDetector.js';
import type { PiiDetectionStrategy } from './PiiDetectionStrategy.js';

export class RegexPiiDetector implements PiiDetector {
  constructor(private readonly strategies: readonly PiiDetectionStrategy[]) {}

  async detect(message: string): Promise<readonly DetectedPii[]> {
    return this.strategies.flatMap((strategy) => strategy.detect(message));
  }
}
