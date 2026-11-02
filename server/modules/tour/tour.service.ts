import type { TourProgress } from '../../../src/shared/api.ts';
import type { TourRepository } from './tour.repository.ts';

/** First-play tour progress for a signed-in user, so it follows them between devices. */
export class TourService {
  private readonly repo: TourRepository;

  constructor(repo: TourRepository) {
    this.repo = repo;
  }

  get(userId: number): Promise<TourProgress | null> {
    return this.repo.find(userId);
  }

  /** A finished tour stays finished: an older device can't reopen it by sending a step. */
  async set(userId: number, p: TourProgress): Promise<void> {
    const current = await this.repo.find(userId);
    if (current?.done && !p.done) return;
    await this.repo.upsert(userId, p);
  }
}
