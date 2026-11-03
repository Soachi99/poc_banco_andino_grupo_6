import { LanguageModelUnavailableError } from '../../domain/errors/LanguageModelErrors.js';

const DEFAULT_MODEL = 'gpt-6-luna';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1_024;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export interface OpenAiSettings {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

export function readOpenAiSettings(env: NodeJS.ProcessEnv): OpenAiSettings {
  const apiKey = env.OPENAI_API_KEY?.trim() ?? '';
  if (apiKey.length === 0) {
    throw new LanguageModelUnavailableError('El servicio de lenguaje no está configurado.');
  }

  const modelSource = env.OPENAI_MODEL?.trim() ?? '';
  const model = modelSource.length === 0 ? DEFAULT_MODEL : modelSource;
  if (!MODEL_PATTERN.test(model)) {
    throw new LanguageModelUnavailableError('La configuración del servicio de lenguaje no es válida.');
  }

  return {
    apiKey,
    model,
    timeoutMs: readBoundedInt(env.OPENAI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 120_000),
    maxOutputTokens: readBoundedInt(env.OPENAI_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS, 16, 4_096),
  };
}

function readBoundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }

  if (!/^\d+$/.test(raw.trim())) {
    throw new LanguageModelUnavailableError('La configuración del servicio de lenguaje no es válida.');
  }

  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new LanguageModelUnavailableError('La configuración del servicio de lenguaje no es válida.');
  }

  return value;
}
