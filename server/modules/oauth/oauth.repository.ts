import type { ApiUser } from '../../../src/shared/api.ts';
import { queryOne, type Queryable } from '../../db/db.ts';

/** Links between OAuth provider accounts and our users. */
export class OAuthRepository {
  private readonly db: Queryable;

  constructor(db: Queryable) {
    this.db = db;
  }

  userFor(provider: string, providerUserId: string): Promise<ApiUser | null> {
    return queryOne<ApiUser>(
      this.db,
      'SELECT u.id, u.email FROM oauth_accounts o JOIN users u ON u.id = o.user_id WHERE o.provider = $1 AND o.provider_user_id = $2',
      [provider, providerUserId],
    );
  }

  userByEmail(email: string): Promise<ApiUser | null> {
    return queryOne<ApiUser>(this.db, 'SELECT id, email FROM users WHERE email = $1', [email]);
  }

  /** A new account with no password (it signs in through the provider). */
  async createUser(email: string): Promise<ApiUser> {
    const row = await queryOne<ApiUser>(this.db, 'INSERT INTO users (email, pass_hash) VALUES ($1, NULL) RETURNING id, email', [email]);
    if (!row) throw new Error('user insert returned nothing');
    return row;
  }

  async link(provider: string, providerUserId: string, userId: number): Promise<void> {
    await this.db.query('INSERT INTO oauth_accounts (provider, provider_user_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
      provider,
      providerUserId,
      userId,
    ]);
  }
}
