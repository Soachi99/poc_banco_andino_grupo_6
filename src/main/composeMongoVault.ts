import type { Connection } from 'mongoose';

import { VaultUnavailableError } from '../domain/errors/VaultErrors.js';
import { MongoTokenMappingRepository } from '../infrastructure/persistence/mongo/MongoTokenMappingRepository.js';
import { openVaultDatabase } from '../infrastructure/persistence/mongo/openVaultDatabase.js';
import { tokenMappingSchema, type TokenMappingRecord } from '../infrastructure/persistence/mongo/tokenMappingSchema.js';

export interface MongoVault {
  connection: Connection;
  repository: MongoTokenMappingRepository;
}

/** Punto de composición del adaptador persistente. Los casos de uso no participan. */
export async function composeMongoVault(uri: string): Promise<MongoVault> {
  const connection = await openVaultDatabase(uri);

  try {
    const model = connection.model<TokenMappingRecord>('TokenMapping', tokenMappingSchema);
    await model.syncIndexes();
    return {
      connection,
      repository: new MongoTokenMappingRepository(model),
    };
  } catch (error) {
    await connection.close().catch(() => undefined);
    if (error instanceof VaultUnavailableError) {
      throw error;
    }

    throw new VaultUnavailableError();
  }
}
