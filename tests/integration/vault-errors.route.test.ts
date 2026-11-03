import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TokenMapping } from '../../src/domain/entities/TokenMapping.js';
import { VaultUnavailableError } from '../../src/domain/errors/VaultErrors.js';
import type { TokenMappingRepository } from '../../src/domain/repositories/TokenMappingRepository.js';
import type { PiiType } from '../../src/domain/value-objects/PiiType.js';
import { createApp } from '../../src/main/createApp.js';

describe('vault persistence errors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 503 when the vault is unavailable and omits the submitted PII', async () => {
    const app = createApp({ tokenMappingRepository: new UnavailableRepository() });
    const email = 'ada@secret.com';

    const response = await request(app).post('/anonymize').send({
      message: `Contacto ${email}`,
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'El vault no está disponible.' });
    expect(JSON.stringify(response.body)).not.toContain(email);
  });

  it('does not write error messages that may contain PII to the log', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createApp({ tokenMappingRepository: new LeakyRepository() });
    const email = 'ada@secret.com';

    const response = await request(app).post('/anonymize').send({
      message: `Contacto ${email}`,
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Error interno del servidor.' });
    expect(spy.mock.calls.flat().join(' ')).not.toContain(email);
    expect(spy).toHaveBeenCalledWith('Error');
  });
});

class UnavailableRepository implements TokenMappingRepository {
  async findByPii(_piiType: PiiType, _normalizedValue: string): Promise<TokenMapping | null> {
    throw new VaultUnavailableError();
  }

  async findByToken(_token: string): Promise<TokenMapping | null> {
    throw new VaultUnavailableError();
  }

  async save(_mapping: TokenMapping): Promise<void> {
    throw new VaultUnavailableError();
  }
}

class LeakyRepository implements TokenMappingRepository {
  async findByPii(_piiType: PiiType, _normalizedValue: string): Promise<TokenMapping | null> {
    throw new Error('fallo con ada@secret.com');
  }

  async findByToken(_token: string): Promise<TokenMapping | null> {
    throw new Error('fallo con ada@secret.com');
  }

  async save(_mapping: TokenMapping): Promise<void> {
    throw new Error('fallo con ada@secret.com');
  }
}
