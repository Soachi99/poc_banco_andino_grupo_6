import type { NextFunction, Request, Response } from 'express';

import type { SecureChatGPTUseCase } from '../../../application/use-cases/SecureChatGPTUseCase.js';
import { validateSecureChatRequest } from '../validators/validateSecureChatRequest.js';

export class SecureChatController {
  constructor(private readonly secureChat: SecureChatGPTUseCase) {}

  async handle(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const prompt = validateSecureChatRequest(request.body);
      const result = await this.secureChat.execute({ prompt });
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
