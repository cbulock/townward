import type { z } from 'zod';
import type { AnalyticsRepository } from './analytics.repository.ts';
import type { TrackBody } from './analytics.schemas.ts';
import { readUserAgent } from './userAgent.ts';

/** Records usage events (docs/specs/analytics.md). */
export class AnalyticsService {
  private readonly repo: AnalyticsRepository;

  constructor(repo: AnalyticsRepository) {
    this.repo = repo;
  }

  async track(body: z.output<typeof TrackBody>, userAgent: string | undefined, userId: number | null): Promise<void> {
    await this.repo.insert({
      kind: body.kind,
      visitor: body.visitor,
      userId,
      path: body.path,
      referrer: body.referrer ?? null,
      utmSource: body.utmSource ?? null,
      utmMedium: body.utmMedium ?? null,
      utmCampaign: body.utmCampaign ?? null,
      client: readUserAgent(userAgent),
      timezone: body.timezone ?? null,
      language: body.language ?? null,
      screen: body.screen ?? null,
      props: body.props ? JSON.stringify(body.props) : null,
    });
  }
}
