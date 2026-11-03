import type { DetectedPii } from '../entities/DetectedPii.js';
import { piiTypePriority } from '../value-objects/PiiType.js';

/**
 * Ante solapes, conserva el tipo de mayor prioridad y, a igualdad, el tramo más largo.
 * El resultado queda ordenado por aparición en el mensaje.
 */
export function selectNonOverlappingDetections(candidates: readonly DetectedPii[]): DetectedPii[] {
  const ranked = [...candidates].sort((left, right) => {
    const byPriority = piiTypePriority(right.type) - piiTypePriority(left.type);
    if (byPriority !== 0) {
      return byPriority;
    }

    const byLength = right.end - right.start - (left.end - left.start);
    if (byLength !== 0) {
      return byLength;
    }

    return left.start - right.start;
  });

  const selected: DetectedPii[] = [];

  for (const candidate of ranked) {
    const overlapsSelection = selected.some((chosen) => candidate.overlaps(chosen));
    if (!overlapsSelection) {
      selected.push(candidate);
    }
  }

  selected.sort((left, right) => left.start - right.start);
  return selected;
}
