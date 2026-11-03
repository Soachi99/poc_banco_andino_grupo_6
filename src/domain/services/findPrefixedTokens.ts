import { PII_TOKEN_PREFIX } from '../value-objects/PiiType.js';
import { TOKEN_SECRET_LENGTH } from '../value-objects/Token.js';

export type PrefixedTokenMatch =
  | {
      wellFormed: true;
      prefix: string;
      secret: string;
      raw: string;
      start: number;
      end: number;
    }
  | {
      wellFormed: false;
      prefix: string;
      raw: string;
      start: number;
      end: number;
    };

/**
 * Un token válido es PREFIJO_ y 32 hexadecimales en minúscula, delimitado.
 * Un prefijo seguido solo de hexadecimales de otra forma, o pegado a más
 * caracteres de identificador, es un token malformado.
 * Un prefijo seguido de texto no hexadecimal se conserva como texto normal.
 */
export function findPrefixedTokens(message: string): PrefixedTokenMatch[] {
  const prefixes = Object.values(PII_TOKEN_PREFIX).sort((left, right) => right.length - left.length);
  const pattern = new RegExp(`(?<![A-Za-z0-9_])(?:${prefixes.map(escapeRegex).join('|')})_`, 'g');
  const matches: PrefixedTokenMatch[] = [];

  for (const match of message.matchAll(pattern)) {
    const start = match.index;
    const prefixWithSeparator = match[0];
    if (start === undefined) {
      continue;
    }

    const prefix = prefixWithSeparator.slice(0, -1);
    const tail = readIdentifierTail(message, start + prefixWithSeparator.length);
    const kind = classifyTail(tail);
    if (kind === 'ignore') {
      continue;
    }

    const raw = message.slice(start, start + prefixWithSeparator.length + tail.length);
    const end = start + raw.length;

    if (kind === 'valid') {
      matches.push({ wellFormed: true, prefix, secret: tail, raw, start, end });
      continue;
    }

    matches.push({ wellFormed: false, prefix, raw, start, end });
  }

  return matches;
}

function classifyTail(tail: string): 'valid' | 'malformed' | 'ignore' {
  if (tail.length === TOKEN_SECRET_LENGTH && /^[a-f0-9]+$/.test(tail)) {
    return 'valid';
  }

  if (/^[a-fA-F0-9]*$/.test(tail)) {
    return 'malformed';
  }

  if (new RegExp(`^[a-fA-F0-9]{${TOKEN_SECRET_LENGTH}}[A-Za-z0-9_]+$`).test(tail)) {
    return 'malformed';
  }

  return 'ignore';
}

function readIdentifierTail(message: string, start: number): string {
  let end = start;
  while (end < message.length && /[A-Za-z0-9_]/.test(message.charAt(end))) {
    end += 1;
  }

  return message.slice(start, end);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
