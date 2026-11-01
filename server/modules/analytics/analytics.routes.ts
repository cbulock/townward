import { Router } from 'express';
import { currentUser } from '../../http/middleware.ts';
import { checkLimits, RateLimiter } from '../../http/rateLimit.ts';
import { parse } from '../../http/validate.ts';
import { addressOf } from '../auth/auth.limits.ts';
import { TrackBody } from './analytics.schemas.ts';
import type { AnalyticsService } from './analytics.service.ts';

/** /api/events: anonymous usage events (docs/specs/analytics.md). */
export function analyticsRoutes(analytics: AnalyticsService, limiter = new RateLimiter({ max: 120, windowMs: 10 * 60_000 })): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const address = addressOf(req);
    checkLimits(res, [[limiter, address]]);
    limiter.fail(address);
    const body = parse(TrackBody, req.body);
    await analytics.track(body, req.get('user-agent'), currentUser(res)?.id ?? null);
    res.status(204).end();
  });

  return router;
}
