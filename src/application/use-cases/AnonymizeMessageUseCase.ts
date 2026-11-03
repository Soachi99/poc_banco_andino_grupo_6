import { DomainError } from '../../domain/errors/DomainError.js';
import type { AnonymizeMessageCommand, AnonymizeMessageResult } from '../dto/AnonymizeMessageDto.js';
import type { DetectPiiUseCase } from './DetectPiiUseCase.js';
import type { GenerateTokenUseCase } from './GenerateTokenUseCase.js';

/**
 * Seudonimiza el mensaje: sustituye PII por tokens y conserva el vínculo en el vault.
 * El nombre del caso de uso sigue el contrato HTTP; la operación no es irreversible.
 */
export class AnonymizeMessageUseCase {
  constructor(
    private readonly detectPii: DetectPiiUseCase,
    private readonly generateToken: GenerateTokenUseCase,
  ) {}

  async execute(command: AnonymizeMessageCommand): Promise<AnonymizeMessageResult> {
    const { message } = command;
    const detections = await this.detectPii.execute(message);
    let anonymizedMessage = '';
    let cursor = 0;

    for (const detection of detections) {
      if (detection.start < cursor || detection.end > message.length) {
        throw new DomainError('La detección de PII queda fuera del mensaje.');
      }

      if (message.slice(detection.start, detection.end) !== detection.rawValue) {
        throw new DomainError('La detección de PII no coincide con el texto del mensaje.');
      }

      const token = await this.generateToken.execute(detection.type, detection.normalizedValue);
      anonymizedMessage += message.slice(cursor, detection.start) + token.value;
      cursor = detection.end;
    }

    anonymizedMessage += message.slice(cursor);
    return { anonymizedMessage };
  }
}
