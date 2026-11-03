import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/main/createApp.js';

describe('POST /anonymize', () => {
  it('returns a pseudonymized message and keeps tokens stable across requests', async () => {
    const app = createApp();
    const payload = {
      message: 'Oferta de trabajo para Dago Borda con email pruebaxd@gmail.com y teléfono 3124567676',
    };

    const first = await request(app).post('/anonymize').send(payload);
    const second = await request(app).post('/anonymize').send(payload);
    const tokens = String(first.body.anonymizedMessage).match(/[a-f0-9]{32}/g) ?? [];

    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      anonymizedMessage: expect.stringMatching(
        /^Oferta de trabajo para [a-f0-9]{32} con email [a-f0-9]{32} y teléfono [a-f0-9]{32}$/,
      ),
    });
    expect(new Set(tokens).size).toBe(3);
    expect(second.body).toEqual(first.body);
  });

  it('rejects an empty or missing message', async () => {
    const app = createApp();

    const missing = await request(app).post('/anonymize').send({});
    const empty = await request(app).post('/anonymize').send({ message: '   ' });

    expect(missing.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(missing.body.error).toEqual(expect.any(String));
  });

  it('rejects malformed JSON', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/anonymize')
      .set('Content-Type', 'application/json')
      .send('{"message":');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('El cuerpo de la petición no es JSON válido.');
  });
});
