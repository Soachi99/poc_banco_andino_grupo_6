import mongoose, { type Connection, type ConnectOptions } from 'mongoose';

import { VaultUnavailableError } from '../../../domain/errors/VaultErrors.js';

/** Nombre de la base en Atlas. Sin esto, MongoDB usa `test` cuando la URI no trae path. */
export const DEFAULT_VAULT_DATABASE = 'poc_anonymize';

/**
 * Abre una conexión propia, sin compartir el estado global de Mongoose.
 * Un fallo de red no incluye la URI: puede contener credenciales.
 */
export async function openVaultDatabase(uri: string, options: ConnectOptions = {}): Promise<Connection> {
  mongoose.set('bufferCommands', false);

  const configuredName = process.env.MONGODB_DB_NAME?.trim();
  const connection = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    dbName: configuredName || DEFAULT_VAULT_DATABASE,
    ...options,
  });

  try {
    await connection.asPromise();
    return connection;
  } catch {
    await connection.close().catch(() => undefined);
    throw new VaultUnavailableError();
  }
}
