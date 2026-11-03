import type { NextFunction, Request, Response } from 'express';

import type { DeanonymizeMessageUseCase } from '../../../application/use-cases/DeanonymizeMessageUseCase.js';
import { validateDeanonymizeRequest } from '../validators/validateDeanonymizeRequest.js';

export class DeanonymizeController {
  constructor(private readonly deanonymizeMessage: DeanonymizeMessageUseCase) {}

  async handle(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const anonymizedMessage = validateDeanonymizeRequest(request.body);
      const result = await this.deanonymizeMessage.execute({ anonymizedMessage });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
