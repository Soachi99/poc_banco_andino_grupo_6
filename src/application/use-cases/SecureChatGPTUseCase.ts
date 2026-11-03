import { LanguageModelResponseError } from '../../domain/errors/LanguageModelErrors.js';
import { PII_TOKEN_PREFIX } from '../../domain/value-objects/PiiType.js';
import type { LanguageModelProvider } from '../../domain/services/LanguageModelProvider.js';
import type { SecureChatCommand, SecureChatResult } from '../dto/SecureChatDto.js';
import { assertAuthorizedModelOutput, collectAuthorizedTokens } from '../services/assertAuthorizedModelOutput.js';
import type { AnonymizeMessageUseCase } from './AnonymizeMessageUseCase.js';
import type { DeanonymizeMessageUseCase } from './DeanonymizeMessageUseCase.js';

const MAX_MODEL_OUTPUT_LENGTH = 20_000;

/**
 * El modelo solo ve el prompt ya seudonimizado.
 * Después solo se restituyen los tokens de esta solicitud: omitir uno es válido;
 * inventarlo, alterarlo o tomar uno de otro registro corta la operación entera.
 */
export class SecureChatGPTUseCase {
  constructor(
    private readonly anonymizeMessage: AnonymizeMessageUseCase,
    private readonly deanonymizeMessage: DeanonymizeMessageUseCase,
    private readonly languageModel: LanguageModelProvider,
  ) {}

  async execute(command: SecureChatCommand): Promise<SecureChatResult> {
    const { anonymizedMessage } = await this.anonymizeMessage.execute({ message: command.prompt });
    const authorized = collectAuthorizedTokens(anonymizedMessage);
    const modelOutput = await this.languageModel.complete({
      instructions: tokenPreservationInstructions(),
      input: anonymizedMessage,
    });

    if (modelOutput.trim().length === 0 || modelOutput.length > MAX_MODEL_OUTPUT_LENGTH) {
      throw new LanguageModelResponseError();
    }

    assertAuthorizedModelOutput(modelOutput, authorized);
    const restored = await this.deanonymizeMessage.execute({ anonymizedMessage: modelOutput });
    return { response: restored.message };
  }
}

function tokenPreservationInstructions(): string {
  const prefixes = Object.values(PII_TOKEN_PREFIX).join(', ');

  return [
    'Redacta exactamente lo que pide el usuario.',
    `El mensaje puede incluir seudónimos que empiezan por ${prefixes}, seguidos de un guion bajo y 32 caracteres hexadecimales en minúscula.`,
    'Copia cada seudónimo de forma exacta, carácter por carácter.',
    'No los traduzcas, no cambies mayúsculas, no inventes seudónimos y no agregues datos personales.',
    'Si un seudónimo no hace falta en la respuesta, omítelo.',
    'No escribas esos prefijos salvo para copiar un seudónimo completo del mensaje.',
  ].join(' ');
}
