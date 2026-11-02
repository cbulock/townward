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
/** Sign-in methods the server has configured. */
export interface AuthProviders {
  readonly github: boolean;
}

export interface MeResponse {
  readonly user: ApiUser | null;
  readonly providers: AuthProviders;
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
  /** 429 only: seconds until the client may try again. */
  readonly retryAfter?: number;
}

/** Usage events (docs/specs/analytics.md). */
export const EVENT_KINDS = ['visit', 'city_start'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Small event details: flat strings, numbers and booleans only. */
export type EventProps = Readonly<Record<string, string | number | boolean>>;

export interface TrackRequest {
  readonly kind: EventKind;
  /** Random ID kept in the browser, for unique visitors. */
  readonly visitor: string;
  readonly path: string;
  /** Host of the referring page, e.g. "t.co". */
  readonly referrer?: string;
  readonly utmSource?: string;
  readonly utmMedium?: string;
  readonly utmCampaign?: string;
  /** IANA timezone, e.g. "Asia/Kolkata". */
  readonly timezone?: string;
  /** Browser language, e.g. "en-IN". */
  readonly language?: string;
  /** "1440x900". */
  readonly screen?: string;
  readonly props?: EventProps;
}
