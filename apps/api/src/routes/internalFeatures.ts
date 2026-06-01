// apps/api/src/routes/internalFeatures.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../logger';
import { requireFeatureApproved } from '../middleware/requireFeatureApproved';
// import { runContextualPromptAdapter } from '../adapters/contextualPromptingAdapter';

const router = Router();

/**
 * Internal capability: Contextual Prompting
 * POST /internal/features/contextual-prompt/run
 *
 * Currently disabled; adapter not implemented.
 */

// router.post(
//   '/contextual-prompt/run',
//   authMiddleware,
//   requireFeatureApproved('Contextual Prompting'),
//   async (req: Request, res: Response, next: NextFunction) => {
//     ...
//   },
// );

export default router;
