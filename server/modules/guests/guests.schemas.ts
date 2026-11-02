import { z } from 'zod';

/** Guest ids are 16 random bytes, base64url. */
export const GuestId = z.string().regex(/^[A-Za-z0-9_-]{22}$/);

export const HeartbeatBody = z.object({ guestId: GuestId.optional() });
