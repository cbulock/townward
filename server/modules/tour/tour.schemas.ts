import { z } from 'zod';

export const TourBody = z.object({
  step: z.string().regex(/^[a-z][a-z-]{0,31}$/, 'Unknown tour step'),
  done: z.boolean(),
});
