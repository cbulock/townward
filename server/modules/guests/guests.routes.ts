import { Router } from 'express';
import type { GuestHeartbeatResponse } from '../../../src/shared/api.ts';
import { currentUser, readCookie } from '../../http/middleware.ts';
import { checkLimits, RateLimiter } from '../../http/rateLimit.ts';
import { parse } from '../../http/validate.ts';
import { addressOf } from '../auth/auth.limits.ts';
import { fingerprint } from './fingerprint.ts';
import { GuestId, HeartbeatBody } from './guests.schemas.ts';
import type { GuestsService } from './guests.service.ts';

export const GUEST_COOKIE = 'cb_guest';
/** Browsers cap cookie lifetimes at 400 days. */
const COOKIE_DAYS = 400;

/** /api/guest: the guest trial clock (D-083). */
export function guestsRoutes(
  guests: GuestsService,
  secureCookies: boolean,
  // Generous: a school or office shares one address, and each player beats twice a minute.
  limiter = new RateLimiter({ max: 1200, windowMs: 10 * 60_000 }),
): Router {
  const router = Router();

  router.post('/heartbeat', async (req, res) => {
    const address = addressOf(req);
    checkLimits(res, [[limiter, address]]);
    limiter.fail(address);
    const body = parse(HeartbeatBody, req.body);
    const cookie = GuestId.safeParse(readCookie(req, GUEST_COOKIE));
    const id = cookie.success ? cookie.data : (body.guestId ?? null);

    const user = currentUser(res);
    if (user) {
      if (id) await guests.claim(id, user.id);
      const member: GuestHeartbeatResponse = { kind: 'member' };
      res.json(member);
      return;
    }

    const status = await guests.heartbeat(id, fingerprint(guests.rules.secret, address, req.get('user-agent')));
    res.cookie(GUEST_COOKIE, status.guestId, { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/api', maxAge: COOKIE_DAYS * 86_400_000 });
    const out: GuestHeartbeatResponse = { kind: 'guest', ...status, nudgeMinutes: guests.rules.nudgeMinutes, limitMinutes: guests.rules.limitMinutes };
    res.json(out);
  });

  return router;
}
