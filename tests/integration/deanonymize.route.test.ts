import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/main/createApp.js';

describe('POST /deanonymize', () => {
  it('restores the original message from tokens issued by /anonymize', async () => {
    const app = createApp();
    const original = 'Oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157';

    const anonymized = await request(app).post('/anonymize').send({ message: original });
    const restored = await request(app).post('/deanonymize').send({
      anonymizedMessage: anonymized.body.anonymizedMessage,
    });

    expect(anonymized.status).toBe(200);
    expect(restored.status).toBe(200);
    expect(restored.body).toEqual({ message: original });
  });

  it('rejects an unknown token without returning the values that could be restored', async () => {
    const app = createApp();
    const original = 'Oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157';
    const anonymized = await request(app).post('/anonymize').send({ message: original });
    const tampered = String(anonymized.body.anonymizedMessage).replace(/EMAIL_[a-f0-9]{32}/, `EMAIL_${'f'.repeat(32)}`);

    const response = await request(app).post('/deanonymize').send({ anonymizedMessage: tampered });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: expect.stringContaining('Tokens sin registro') });
    expect(JSON.stringify(response.body)).not.toContain('Dago Borda');
    expect(JSON.stringify(response.body)).not.toContain('dborda@gmail.com');
    expect(JSON.stringify(response.body)).not.toContain('3152319157');
  });

  it('rejects the illustrative short tokens instead of inventing their values', async () => {
    const app = createApp();

    const response = await request(app).post('/deanonymize').send({
      anonymizedMessage:
        'oferta de trabajo para NAME_e1be92e2b3a5 con email EMAIL_8004719c6ea5 y telefono PHONE_40e83067b9cb',
    });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('Tokens malformados');
    expect(response.body.message).toBeUndefined();
  });

  it('rejects a missing anonymizedMessage', async () => {
    const app = createApp();

    const response = await request(app).post('/deanonymize').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
  });
});
