import type { Db } from '../../db/db.ts';
import type { Client } from './userAgent.ts';

/** A usage event as stored (docs/specs/analytics.md). */
export interface EventRow {
  readonly kind: string;
  readonly visitor: string;
  readonly userId: number | null;
  readonly path: string;
  readonly referrer: string | null;
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly client: Client;
  readonly timezone: string | null;
  readonly language: string | null;
  readonly screen: string | null;
  /** JSON text. */
  readonly props: string | null;
}

export class AnalyticsRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async insert(e: EventRow): Promise<void> {
    await this.db.query(
      `INSERT INTO events (kind, visitor, user_id, path, referrer, utm_source, utm_medium, utm_campaign, browser, os, device, timezone, language, screen, props)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        e.kind,
        e.visitor,
        e.userId,
        e.path,
        e.referrer,
        e.utmSource,
        e.utmMedium,
        e.utmCampaign,
        e.client.browser,
        e.client.os,
        e.client.device,
        e.timezone,
        e.language,
        e.screen,
        e.props,
      ],
    );
  }
}
