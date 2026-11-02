import type { ApiUser } from '../../../src/shared/api.ts';
import type { Db } from '../../db/db.ts';
import type { AuthService, Session } from '../auth/auth.service.ts';
import type { GithubProfile } from './github.api.ts';
import { OAuthRepository } from './oauth.repository.ts';

/**
 * Sign-in through GitHub (docs/specs/saving.md, "Accounts"):
 *   1. a GitHub account already linked signs in as its user;
 *   2. else a user with the same email GitHub has *verified* gets linked (no duplicate account);
 *   3. else a new password-less account is created.
 * Accounts without a verified email get GitHub's private noreply address, so they still work.
 */
export class OAuthService {
  private readonly db: Db;
  private readonly auth: AuthService;

  constructor(db: Db, auth: AuthService) {
    this.db = db;
    this.auth = auth;
  }

  async signInWithGithub(profile: GithubProfile): Promise<Session> {
    const user = await this.db.transaction(async (tx): Promise<ApiUser> => {
      const repo = new OAuthRepository(tx);
      const linked = await repo.userFor('github', profile.id);
      if (linked) return linked;
      const email = (profile.verifiedEmail ?? `${profile.id}+${profile.login}@users.noreply.github.com`).trim().toLowerCase();
      const user = (profile.verifiedEmail ? await repo.userByEmail(email) : null) ?? (await repo.createUser(email));
      await repo.link('github', profile.id, user.id);
      return user;
    });
    return this.auth.startSession(user);
  }
}
