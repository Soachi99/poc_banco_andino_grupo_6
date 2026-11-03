import type { DetectedPii } from '../../domain/entities/DetectedPii.js';
import type { PiiDetector } from '../../domain/services/PiiDetector.js';
import { selectNonOverlappingDetections } from '../../domain/services/selectNonOverlappingDetections.js';

export class DetectPiiUseCase {
  constructor(private readonly detector: PiiDetector) {}

  async execute(message: string): Promise<readonly DetectedPii[]> {
    const candidates = await this.detector.detect(message);
    return selectNonOverlappingDetections(candidates);
  }
}
