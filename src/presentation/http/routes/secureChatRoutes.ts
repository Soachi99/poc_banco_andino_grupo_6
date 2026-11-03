import { Router } from 'express';

import type { SecureChatController } from '../controllers/SecureChatController.js';

export function secureChatRoutes(controller: SecureChatController): Router {
  const router = Router();

  router.post('/secureChatGPT', (request, response, next) => {
    controller.handle(request, response, next).catch(next);
  });

  return router;
}
