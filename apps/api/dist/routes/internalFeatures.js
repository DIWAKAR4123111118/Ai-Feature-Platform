"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/internalFeatures.ts
const express_1 = require("express");
// import { runContextualPromptAdapter } from '../adapters/contextualPromptingAdapter';
const router = (0, express_1.Router)();
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
exports.default = router;
