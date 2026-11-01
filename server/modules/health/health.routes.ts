import { Router } from 'express';
import type { Db } from '../../db/db.ts';

/**
 * /api/health for load balancers and uptime checks: 200 when the server can reach Postgres,
 * 503 when it can't.
 */
export function healthRoutes(db: Db): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: 'Database unavailable' });
    }
  });
  return router;
}
