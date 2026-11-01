import { z } from 'zod';
import { EVENT_KINDS } from '../../../src/shared/api.ts';

/** A short optional text field: trimmed, capped, empty becomes absent. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const TrackBody = z.object({
  kind: z.enum(EVENT_KINDS),
  visitor: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Bad visitor id'),
  path: z.string().max(200),
  referrer: text(200),
  utmSource: text(100),
  utmMedium: text(100),
  utmCampaign: text(100),
  timezone: text(64),
  language: text(35),
  screen: z
    .string()
    .regex(/^\d{2,5}x\d{2,5}$/)
    .optional(),
  // At most 12 small values: enough for event details, too little to abuse as storage.
  props: z
    .record(z.string().max(32), z.union([z.string().max(100), z.number().finite(), z.boolean()]))
    .refine((p) => Object.keys(p).length <= 12, 'Too many props')
    .optional(),
});
