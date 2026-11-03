import type { Model } from 'mongoose';

import { TokenMapping } from '../../../domain/entities/TokenMapping.js';
import { DomainError } from '../../../domain/errors/DomainError.js';
import { VaultIntegrityError, VaultPersistenceError, VaultUnavailableError } from '../../../domain/errors/VaultErrors.js';
import type { TokenMappingRepository } from '../../../domain/repositories/TokenMappingRepository.js';
import { isPiiType, type PiiType } from '../../../domain/value-objects/PiiType.js';
import { Token } from '../../../domain/value-objects/Token.js';
import type { TokenMappingRecord } from './tokenMappingSchema.js';

const UNAVAILABLE_ERROR_NAMES = new Set([
  'MongoNetworkError',
  'MongoServerSelectionError',
  'MongoNotConnectedError',
  'MongoTimeoutError',
  'MongoSystemError',
]);

/**
 * Adaptador MongoDB del vault.
 * Guarda la pareja en claro. El caso de uso sigue viendo TokenMapping.
 */
export class MongoTokenMappingRepository implements TokenMappingRepository {
  constructor(private readonly model: Model<TokenMappingRecord>) {}

  async findByPii(piiType: PiiType, normalizedValue: string): Promise<TokenMapping | null> {
    const doc = await this.guard(() => this.model.findOne({ piiType, normalizedValue }).lean<TokenMappingRecord>().exec());
    return doc ? this.toMapping(doc) : null;
  }

  async findByToken(token: string): Promise<TokenMapping | null> {
    const doc = await this.guard(() => this.model.findOne({ token }).lean<TokenMappingRecord>().exec());
    return doc ? this.toMapping(doc) : null;
  }

  async save(mapping: TokenMapping): Promise<void> {
    await this.guard(() =>
      this.model.create({
        token: mapping.token.value,
        piiType: mapping.piiType,
        originalValue: mapping.originalValue,
        normalizedValue: mapping.normalizedValue,
        createdAt: mapping.createdAt,
      }),
    );
  }

  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    if (this.model.db.readyState !== 1) {
      throw new VaultUnavailableError();
    }

    try {
      return await operation();
    } catch (error) {
      if (error instanceof DomainError || error instanceof VaultUnavailableError || error instanceof VaultIntegrityError) {
        throw error;
      }

      if (isDuplicateKey(error)) {
        throw duplicateMappingError(error);
      }

      if (isMongoUnavailable(error)) {
        throw new VaultUnavailableError();
      }

      throw new VaultPersistenceError();
    }
  }

  private toMapping(doc: TokenMappingRecord): TokenMapping {
    if (!isPiiType(doc.piiType)) {
      throw new VaultIntegrityError();
    }

    try {
      return TokenMapping.create({
        piiType: doc.piiType,
        normalizedValue: doc.normalizedValue,
        originalValue: doc.originalValue,
        token: Token.create(doc.token),
        createdAt: doc.createdAt,
      });
    } catch {
      throw new VaultIntegrityError();
    }
  }
}

function walk(error: unknown, depth = 0): unknown[] {
  if (depth > 5 || typeof error !== 'object' || error === null) {
    return [];
  }

  const cause = 'cause' in error ? (error as { cause?: unknown }).cause : undefined;
  if (cause === undefined || cause === error) {
    return [error];
  }

  return [error, ...walk(cause, depth + 1)];
}

function isDuplicateKey(error: unknown): boolean {
  return walk(error).some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null || !('code' in candidate)) {
      return false;
    }

    const code = (candidate as { code?: unknown }).code;
    return code === 11000 || code === 11001;
  });
}

function isMongoUnavailable(error: unknown): boolean {
  return walk(error).some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null || !('name' in candidate)) {
      return false;
    }

    return UNAVAILABLE_ERROR_NAMES.has(String((candidate as { name?: unknown }).name));
  });
}

function keyPatternOf(error: unknown): Record<string, unknown> | undefined {
  for (const candidate of walk(error)) {
    if (typeof candidate !== 'object' || candidate === null) {
      continue;
    }

    if ('keyPattern' in candidate && typeof (candidate as { keyPattern?: unknown }).keyPattern === 'object') {
      const pattern = (candidate as { keyPattern?: Record<string, unknown> | null }).keyPattern;
      if (pattern) {
        return pattern;
      }
    }
  }

  return undefined;
}

function duplicateMappingError(error: unknown): DomainError {
  const pattern = keyPatternOf(error);
  if (pattern && 'normalizedValue' in pattern) {
    return new DomainError('El dato sensible ya tiene un token asociado.');
  }

  return new DomainError('El token ya está asociado a otro dato.');
}
