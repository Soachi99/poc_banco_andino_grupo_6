import express, { type Express } from 'express';

import { AnonymizeMessageUseCase } from '../application/use-cases/AnonymizeMessageUseCase.js';
import { DetectPiiUseCase } from '../application/use-cases/DetectPiiUseCase.js';
import { GenerateTokenUseCase } from '../application/use-cases/GenerateTokenUseCase.js';
import type { TokenMappingRepository } from '../domain/repositories/TokenMappingRepository.js';
import type { PiiDetector } from '../domain/services/PiiDetector.js';
import type { TokenGenerator } from '../domain/services/TokenGenerator.js';
import { EmailDetectionStrategy } from '../infrastructure/detection/EmailDetectionStrategy.js';
import { PersonNameDetectionStrategy } from '../infrastructure/detection/PersonNameDetectionStrategy.js';
import { PhoneDetectionStrategy } from '../infrastructure/detection/PhoneDetectionStrategy.js';
import { RegexPiiDetector } from '../infrastructure/detection/RegexPiiDetector.js';
import { InMemoryTokenMappingRepository } from '../infrastructure/persistence/InMemoryTokenMappingRepository.js';
import { CryptoTokenGenerator } from '../infrastructure/tokenization/CryptoTokenGenerator.js';
import { AnonymizeController } from '../presentation/http/controllers/AnonymizeController.js';
import { errorHandler } from '../presentation/http/middleware/errorHandler.js';
import { anonymizeRoutes } from '../presentation/http/routes/anonymizeRoutes.js';

export interface AppDependencies {
  detector?: PiiDetector;
  tokenGenerator?: TokenGenerator;
  tokenMappingRepository?: TokenMappingRepository;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const detector =
    dependencies.detector ??
    new RegexPiiDetector([
      new EmailDetectionStrategy(),
      new PhoneDetectionStrategy(),
      new PersonNameDetectionStrategy(),
    ]);
  const tokenGenerator = dependencies.tokenGenerator ?? new CryptoTokenGenerator();
  const tokenMappingRepository = dependencies.tokenMappingRepository ?? new InMemoryTokenMappingRepository();

  const detectPii = new DetectPiiUseCase(detector);
  const generateToken = new GenerateTokenUseCase(tokenGenerator, tokenMappingRepository);
  const anonymizeMessage = new AnonymizeMessageUseCase(detectPii, generateToken);
  const controller = new AnonymizeController(anonymizeMessage);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(anonymizeRoutes(controller));
  app.use(errorHandler);

  return app;
}
