import type { NextFunction, Request, Response } from 'express';

import type { AnonymizeMessageUseCase } from '../../../application/use-cases/AnonymizeMessageUseCase.js';
import { validateAnonymizeRequest } from '../validators/validateAnonymizeRequest.js';

export class AnonymizeController {
  constructor(private readonly anonymizeMessage: AnonymizeMessageUseCase) {}

  async handle(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const message = validateAnonymizeRequest(request.body);
      const result = await this.anonymizeMessage.execute({ message });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
