import { Router } from 'express';

import type { AnonymizeController } from '../controllers/AnonymizeController.js';

export function anonymizeRoutes(controller: AnonymizeController): Router {
  const router = Router();

  router.post('/anonymize', (request, response, next) => {
    controller.handle(request, response, next).catch(next);
  });

  return router;
}
