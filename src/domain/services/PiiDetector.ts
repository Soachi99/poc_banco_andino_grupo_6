import type { DetectedPii } from '../entities/DetectedPii.js';

export interface PiiDetector {
  detect(message: string): Promise<readonly DetectedPii[]>;
}
