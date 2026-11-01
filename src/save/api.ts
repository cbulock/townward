import type {
  ApiErrorBody,
  ApiUser,
  AuthResponse,
  MeResponse,
  SaveListResponse,
  SaveLoadResponse,
  SaveMeta,
  SaveWriteRequest,
  SaveWriteResponse,
} from '../shared/api';

/** Typed client for the save server (docs/specs/saving.md, "Server"). */

export class ApiError extends Error {
  /** HTTP status, or 0 when the server couldn't be reached. */
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isErrorBody(v: unknown): v is ApiErrorBody {
  return typeof v === 'object' && v !== null && 'error' in v && typeof v.error === 'string';
}

/**
 * Small bodies go out with `keepalive`, so a save started as the tab closes still arrives
 * (browsers cap keepalive bodies at 64 KB).
 */
const KEEPALIVE_MAX = 60_000;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const text = body === undefined ? undefined : JSON.stringify(body);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: text === undefined ? undefined : { 'content-type': 'application/json' },
      body: text,
      credentials: 'same-origin',
      keepalive: text !== undefined && text.length < KEEPALIVE_MAX,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server");
  }
  if (res.status === 204) return undefined as T; // only used with T = void
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, isErrorBody(json) ? json.error : `Server error (${res.status})`);
  // Our own server's responses, typed by src/shared/api.ts. Save data is validated separately (parseSave).
  return json as T;
}

export const api = {
  me: () => request<MeResponse>('GET', '/auth/me').then((r) => r.user),
  signup: (email: string, password: string): Promise<ApiUser> =>
    request<AuthResponse>('POST', '/auth/signup', { email, password }).then((r) => r.user),
  login: (email: string, password: string): Promise<ApiUser> =>
    request<AuthResponse>('POST', '/auth/login', { email, password }).then((r) => r.user),
  logout: () => request<void>('POST', '/auth/logout'),

  listSaves: () => request<SaveListResponse>('GET', '/saves').then((r) => r.saves),
  loadSave: (id: number) => request<SaveLoadResponse>('GET', `/saves/${id}`),
  createSave: (body: SaveWriteRequest): Promise<SaveMeta> => request<SaveWriteResponse>('POST', '/saves', body).then((r) => r.meta),
  updateSave: (id: number, body: SaveWriteRequest): Promise<SaveMeta> =>
    request<SaveWriteResponse>('PUT', `/saves/${id}`, body).then((r) => r.meta),
  deleteSave: (id: number) => request<void>('DELETE', `/saves/${id}`),
};
