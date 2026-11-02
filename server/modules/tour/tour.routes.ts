import { Router } from 'express';
import type { TourResponse } from '../../../src/shared/api.ts';
import { requireUser } from '../../http/middleware.ts';
import { parse } from '../../http/validate.ts';
import { TourBody } from './tour.schemas.ts';
import type { TourService } from './tour.service.ts';

/** /api/tour: the signed-in user's tour progress. */
export function tourRoutes(tour: TourService): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const body: TourResponse = { progress: await tour.get(requireUser(res).id) };
    res.json(body);
  });

  router.put('/', async (req, res) => {
    const user = requireUser(res);
    await tour.set(user.id, parse(TourBody, req.body));
    res.status(204).end();
  });

  return router;
}
