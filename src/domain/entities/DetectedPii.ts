import { DomainError } from '../errors/DomainError.js';
import { isPiiType, type PiiType } from '../value-objects/PiiType.js';

export interface DetectedPiiProps {
  type: PiiType;
  rawValue: string;
  normalizedValue: string;
  start: number;
  end: number;
}

export class DetectedPii {
  private constructor(
    readonly type: PiiType,
    readonly rawValue: string,
    readonly normalizedValue: string,
    readonly start: number,
    readonly end: number,
  ) {}

  static create(props: DetectedPiiProps): DetectedPii {
    if (!isPiiType(props.type)) {
      throw new DomainError('El tipo de PII no es válido.');
    }

    if (!Number.isInteger(props.start) || !Number.isInteger(props.end) || props.start < 0 || props.end <= props.start) {
      throw new DomainError('El intervalo de la detección de PII no es válido.');
    }

    if (props.rawValue.length === 0 || props.normalizedValue.trim().length === 0) {
      throw new DomainError('La detección de PII no contiene un valor.');
    }

    return new DetectedPii(props.type, props.rawValue, props.normalizedValue, props.start, props.end);
  }

  overlaps(other: DetectedPii): boolean {
    return this.start < other.end && other.start < this.end;
  }
}
