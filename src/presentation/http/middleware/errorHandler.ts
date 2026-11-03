import type { ErrorRequestHandler } from 'express';

import { DomainError } from '../../../domain/errors/DomainError.js';
import { ValidationError } from '../errors/ValidationError.js';

interface HttpErrorLike {
  type?: string;
  status?: number;
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ValidationError) {
    response.status(400).json({ error: error.message });
    return;
  }

  const httpError = asHttpError(error);

  if (httpError?.type === 'entity.parse.failed' || (error instanceof SyntaxError && httpError?.status === 400)) {
    response.status(400).json({ error: 'El cuerpo de la petición no es JSON válido.' });
    return;
  }

  if (httpError?.type === 'entity.too.large') {
    response.status(413).json({ error: 'El cuerpo de la petición excede el tamaño permitido.' });
    return;
  }

  if (error instanceof DomainError) {
    response.status(422).json({ error: error.message });
    return;
  }

  console.error(error instanceof Error ? error.stack : error);
  response.status(500).json({ error: 'Error interno del servidor.' });
};

function asHttpError(error: unknown): HttpErrorLike | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  return error as HttpErrorLike;
}
