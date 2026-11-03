import { VaultUnavailableError } from '../domain/errors/VaultErrors.js';
import { createApp } from './createApp.js';
import { composeMongoVault, type MongoVault } from './composeMongoVault.js';
import { loadLocalEnv } from './loadLocalEnv.js';

loadLocalEnv();

const port = Number(process.env.PORT ?? 3001);

async function start(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI es obligatoria.');
    process.exit(1);
  }

  let vault: MongoVault;
  try {
    vault = await composeMongoVault(uri);
  } catch (error) {
    console.error(startupMessage(error));
    process.exit(1);
  }

  const app = createApp({ tokenMappingRepository: vault.repository });
  const server = app.listen(port, () => {
    console.log(`Data Privacy Vault listening on http://localhost:${port} (database ${vault.connection.name})`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Cerrando el vault (${signal}).`);
    server.close(() => {
      void vault.connection.close().finally(() => {
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

function startupMessage(error: unknown): string {
  if (error instanceof VaultUnavailableError) {
    return error.message;
  }

  return 'No se pudo iniciar el vault.';
}

void start();
