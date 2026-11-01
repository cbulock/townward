/**
 * Shapes of the save server's HTTP API (docs/specs/saving.md), shared by the client
 * (src/save/) and the server (server/). Keep this file free of imports.
 */

export const API_LIMITS = {
  passwordMin: 8,
  passwordMax: 200,
  cityNameMax: 64,
  savesPerUser: 30,
  /** Request body limit; a huge 256×256 city is well under 2 MB. */
  bodyBytes: 8 * 1024 * 1024,
} as const;

export interface ApiUser {
  readonly id: number;
  readonly email: string;
}

/** A city in a list: everything but its data. */
export interface SaveMeta {
  readonly id: number;
  readonly name: string;
  readonly population: number;
  readonly funds: number;
  readonly day: number;
  readonly size: number;
  readonly preset: string;
  readonly seed: number;
  /** ms since the epoch. */
  readonly updatedAt: number;
}

/** What the client sends with a save; the server adds id and updatedAt. */
export type SaveMetaInput = Omit<SaveMeta, 'id' | 'updatedAt'>;

export interface AuthResponse {
  readonly user: ApiUser;
}
export interface MeResponse {
  readonly user: ApiUser | null;
}
export interface SaveListResponse {
  readonly saves: readonly SaveMeta[];
}
export interface SaveWriteRequest {
  readonly meta: SaveMetaInput;
  readonly data: unknown;
}
export interface SaveWriteResponse {
  readonly meta: SaveMeta;
}
export interface SaveLoadResponse {
  readonly meta: SaveMeta;
  readonly data: unknown;
}
export interface ApiErrorBody {
  readonly error: string;
}
