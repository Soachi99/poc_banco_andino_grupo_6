import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TokenMapping } from '../../src/domain/entities/TokenMapping.js';
import { DomainError } from '../../src/domain/errors/DomainError.js';
import { VaultUnavailableError } from '../../src/domain/errors/VaultErrors.js';
import { PiiType } from '../../src/domain/value-objects/PiiType.js';
import { Token } from '../../src/domain/value-objects/Token.js';
import { composeMongoVault, type MongoVault } from '../../src/main/composeMongoVault.js';
import { createApp } from '../../src/main/createApp.js';
import { openVaultDatabase } from '../../src/infrastructure/persistence/mongo/openVaultDatabase.js';

const ORIGINAL = 'Oferta para Nombre Secreto Unico con email correo-secreto-unico@vault.test y teléfono 3001112233';

describe('MongoDB vault', () => {
  let mongod: MongoMemoryServer;
  let uri: string;
  let vault: MongoVault;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
    vault = await composeMongoVault(uri);
  }, 180_000);

  afterAll(async () => {
    await vault?.connection.close().catch(() => undefined);
    await mongod?.stop();
  });

  it('stores the original value through /anonymize and restores it through /deanonymize', async () => {
    const app = createApp({ tokenMappingRepository: vault.repository });

    const first = await request(app).post('/anonymize').send({ message: ORIGINAL });
    const second = await request(app).post('/anonymize').send({ message: ORIGINAL });
    const restored = await request(app).post('/deanonymize').send({
      anonymizedMessage: first.body.anonymizedMessage,
    });

    expect(first.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(restored.status).toBe(200);
    expect(restored.body).toEqual({ message: ORIGINAL });

    const stored = await vault.connection.collection('token_mappings').find({}).toArray();
    expect(stored.length).toBeGreaterThanOrEqual(3);

    for (const record of stored) {
      expect(record.lookupKey).toBeUndefined();
      expect(record.ciphertext).toBeUndefined();
      expect(record.iv).toBeUndefined();
      expect(record.authTag).toBeUndefined();
      expect(record.originalValue).toEqual(expect.any(String));
      expect(record.normalizedValue).toEqual(expect.any(String));
    }

    expect(stored.map((record) => record.originalValue)).toEqual(
      expect.arrayContaining(['Nombre Secreto Unico', 'correo-secreto-unico@vault.test', '3001112233']),
    );
  });

  it('rejects a duplicate token and a duplicate normalized value', async () => {
    const token = Token.create('c'.repeat(32));
    const first = TokenMapping.create({
      piiType: PiiType.Email,
      normalizedValue: 'unico@vault.test',
      originalValue: 'unico@vault.test',
      token,
    });

    await vault.repository.save(first);

    await expect(
      vault.repository.save(
        TokenMapping.create({
          piiType: PiiType.Email,
          normalizedValue: 'unico@vault.test',
          originalValue: 'UNICO@vault.test',
          token: Token.create('d'.repeat(32)),
        }),
      ),
    ).rejects.toThrow(new DomainError('El dato sensible ya tiene un token asociado.'));

    await expect(
      vault.repository.save(
        TokenMapping.create({
          piiType: PiiType.Phone,
          normalizedValue: '3000000000',
          originalValue: '3000000000',
          token,
        }),
      ),
    ).rejects.toThrow(new DomainError('El token ya está asociado a otro dato.'));
  });

  it('keeps mappings after the application connection is closed and opened again', async () => {
    const app = createApp({ tokenMappingRepository: vault.repository });
    const message = 'Seguimiento de Persistencia Larga en persiste@vault.test';
    const anonymized = await request(app).post('/anonymize').send({ message });

    await vault.connection.close();
    vault = await composeMongoVault(uri);

    const restored = await request(createApp({ tokenMappingRepository: vault.repository }))
      .post('/deanonymize')
      .send({ anonymizedMessage: anonymized.body.anonymizedMessage });

    expect(anonymized.status).toBe(200);
    expect(restored.status).toBe(200);
    expect(restored.body).toEqual({ message });
  });

  it('reports a closed repository connection without the lookup value', async () => {
    const extra = await composeMongoVault(uri);
    await extra.connection.close();
    const secret = 'persona-no-loguear@vault.test';

    try {
      await extra.repository.findByPii(PiiType.Email, secret);
      expect.fail('debía fallar al estar desconectado');
    } catch (error) {
      expect(error).toBeInstanceOf(VaultUnavailableError);
      expect((error as Error).message).not.toContain(secret);
    }
  });
});

describe('openVaultDatabase', () => {
  it('hides connection failures and does not echo the URI', async () => {
    const uri = 'mongodb://127.0.0.1:1/data_privacy_vault';

    try {
      await openVaultDatabase(uri, { serverSelectionTimeoutMS: 400, connectTimeoutMS: 400 });
      expect.fail('debía fallar la conexión');
    } catch (error) {
      expect(error).toBeInstanceOf(VaultUnavailableError);
      expect((error as Error).message).toBe('El vault no está disponible.');
      expect((error as Error).message).not.toContain(uri);
    }
  });
});
