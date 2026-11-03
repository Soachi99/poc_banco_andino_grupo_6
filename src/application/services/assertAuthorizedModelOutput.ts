import { UnauthorizedTokenError } from '../../domain/errors/TokenErrors.js';
import { findPrefixedTokens } from '../../domain/services/findPrefixedTokens.js';
import { PII_TOKEN_PREFIX } from '../../domain/value-objects/PiiType.js';

const IDENTIFIER = /[A-Za-z0-9_]/;

/**
 * Tokens públicos bien formados que esta solicitud sí puede restituir.
 * Un modelo puede omitirlos; no puede inventar otros ni deformarlos.
 */
export function collectAuthorizedTokens(anonymizedMessage: string): ReadonlySet<string> {
  const authorized = new Set<string>();

  for (const match of findPrefixedTokens(anonymizedMessage)) {
    if (match.wellFormed) {
      authorized.add(match.raw);
    }
  }

  return authorized;
}

/**
 * Rechaza el texto completo si aparece un prefijo de token que no es
 * exactamente uno de los seudónimos enviados al modelo.
 * Cubre tokens desconocidos, recortados, en otro caso o pegados a otro identificador.
 */
export function assertAuthorizedModelOutput(output: string, authorized: ReadonlySet<string>): void {
  const prefixes = Object.values(PII_TOKEN_PREFIX).sort((left, right) => right.length - left.length);
  const pattern = new RegExp(`(?:${prefixes.map(escapeRegex).join('|')})_`, 'gi');

  for (const match of output.matchAll(pattern)) {
    const start = match.index;
    if (start === undefined || !isDelimitedAuthorizedToken(output, start, authorized)) {
      throw new UnauthorizedTokenError();
    }
  }
}

function isDelimitedAuthorizedToken(text: string, start: number, authorized: ReadonlySet<string>): boolean {
  const previous = start > 0 ? text.charAt(start - 1) : '';
  if (previous.length > 0 && IDENTIFIER.test(previous)) {
    return false;
  }

  for (const token of authorized) {
    if (!text.startsWith(token, start)) {
      continue;
    }

    const next = text.charAt(start + token.length);
    if (next.length === 0 || !IDENTIFIER.test(next)) {
      return true;
    }
  }

  return false;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
