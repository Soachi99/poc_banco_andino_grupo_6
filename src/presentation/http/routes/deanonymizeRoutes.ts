import { Router } from 'express';

import type { DeanonymizeController } from '../controllers/DeanonymizeController.js';

export function deanonymizeRoutes(controller: DeanonymizeController): Router {
  const router = Router();

  router.post('/deanonymize', (request, response, next) => {
    controller.handle(request, response, next).catch(next);
  });

  return router;
}
