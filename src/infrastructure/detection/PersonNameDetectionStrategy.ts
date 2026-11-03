import { DetectedPii } from '../../domain/entities/DetectedPii.js';
import { PiiType } from '../../domain/value-objects/PiiType.js';
import type { PiiDetectionStrategy } from './PiiDetectionStrategy.js';

interface TextSpan {
  text: string;
  start: number;
  end: number;
}

const WORD_PATTERN = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:-[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*/g;
const NAME_WORD_PATTERN = /^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:-[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+)?$/;
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos', 'das', 'van', 'von', 'di']);
const MIN_NAME_WORDS = 2;
const MAX_NAME_WORDS = 4;

export class PersonNameDetectionStrategy implements PiiDetectionStrategy {
  readonly piiType = PiiType.PersonName;

  detect(message: string): readonly DetectedPii[] {
    const words = tokenize(message);
    const detections: DetectedPii[] = [];
    let index = 0;

    while (index < words.length) {
      if (!isNameWord(words[index]?.text ?? '')) {
        index += 1;
        continue;
      }

      const consumed = consumeName(message, words, index);
      if (!consumed) {
        index += 1;
        continue;
      }

      const rawValue = message.slice(consumed.start, consumed.end);
      detections.push(
        DetectedPii.create({
          type: this.piiType,
          rawValue,
          normalizedValue: normalizePersonName(rawValue),
          start: consumed.start,
          end: consumed.end,
        }),
      );
      index = consumed.nextIndex;
    }

    return detections;
  }
}

function tokenize(message: string): TextSpan[] {
  return [...message.matchAll(WORD_PATTERN)].map((match) => {
    const text = match[0];
    const start = match.index ?? 0;
    return { text, start, end: start + text.length };
  });
}

function consumeName(
  message: string,
  words: readonly TextSpan[],
  startIndex: number,
): { start: number; end: number; nextIndex: number } | null {
  let nameWordCount = 0;
  let lastNameWordIndex = startIndex;
  let lastConsumedIndex = startIndex;
  let cursor = startIndex;

  while (cursor < words.length && nameWordCount < MAX_NAME_WORDS) {
    const current = words[cursor];
    if (!current) {
      break;
    }

    if (isNameWord(current.text)) {
      if (cursor !== startIndex && !onlyWhitespaceBetween(message, words[lastConsumedIndex], current)) {
        break;
      }

      nameWordCount += 1;
      lastNameWordIndex = cursor;
      lastConsumedIndex = cursor;
      cursor += 1;
      continue;
    }

    if (nameWordCount > 0 && isParticle(current.text)) {
      const continuation = skipParticles(message, words, lastConsumedIndex, cursor);
      if (continuation === null) {
        break;
      }

      lastConsumedIndex = continuation.lastParticleIndex;
      cursor = continuation.nameWordIndex;
      continue;
    }

    break;
  }

  const firstWord = words[startIndex];
  const lastNameWord = words[lastNameWordIndex];
  if (nameWordCount < MIN_NAME_WORDS || !firstWord || !lastNameWord) {
    return null;
  }

  return {
    start: firstWord.start,
    end: lastNameWord.end,
    nextIndex: lastNameWordIndex + 1,
  };
}

function skipParticles(
  message: string,
  words: readonly TextSpan[],
  lastConsumedIndex: number,
  particleIndex: number,
): { lastParticleIndex: number; nameWordIndex: number } | null {
  let previous = words[lastConsumedIndex];
  let lookahead = particleIndex;

  if (!previous) {
    return null;
  }

  while (lookahead < words.length && isParticle(words[lookahead]?.text ?? '')) {
    const current = words[lookahead];
    if (!current || !onlyWhitespaceBetween(message, previous, current)) {
      return null;
    }

    previous = current;
    lookahead += 1;
  }

  const nextName = words[lookahead];
  if (!nextName || !isNameWord(nextName.text) || !onlyWhitespaceBetween(message, previous, nextName)) {
    return null;
  }

  return {
    lastParticleIndex: lookahead - 1,
    nameWordIndex: lookahead,
  };
}

function onlyWhitespaceBetween(message: string, left: TextSpan | undefined, right: TextSpan | undefined): boolean {
  if (!left || !right || right.start < left.end) {
    return false;
  }

  const gap = message.slice(left.end, right.start);
  return gap.length === 0 || /^\s+$/.test(gap);
}

function isNameWord(word: string): boolean {
  return NAME_WORD_PATTERN.test(word);
}

function isParticle(word: string): boolean {
  return PARTICLES.has(word);
}

function normalizePersonName(rawValue: string): string {
  return rawValue.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');
}
