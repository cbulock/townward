import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorBody } from '../../src/shared/api.ts';

/**
 * Handlers and services throw HttpError for anything the client should see; the error
 * middleware turns it into `{ error }` JSON. Anything else is logged and becomes a 500.
 */
export class HttpError extends Error {
  readonly status: number;
  /** For 429: seconds until the client may try again (also sent as Retry-After). */
  readonly retryAfter?: number;

  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message = 'Please log in') => new HttpError(401, message);
export const forbidden = (message: string) => new HttpError(403, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
export function tooManyRequests(retryAfterSeconds: number): HttpError {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return new HttpError(429, `Too many attempts. Try again in ${minutes <= 1 ? 'a minute' : `${minutes} minutes`}.`, retryAfterSeconds);
}

/** Errors from express.json carry a `status` (413 too large, 400 bad JSON). */
function statusOf(err: unknown): number | null {
  if (err instanceof HttpError) return err.status;
  if (typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number') return err.status;
  return null;
}

function messageFor(err: unknown, status: number): string {
  if (err instanceof HttpError) return err.message;
  if (status === 413) return 'City is too large to save';
  if (status < 500) return 'Invalid request';
  return 'Server error';
}

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) return next(err);
  const status = statusOf(err) ?? 500;
  if (status >= 500) console.error(err);
  const retryAfter = err instanceof HttpError ? err.retryAfter : undefined;
  const body: ApiErrorBody = retryAfter === undefined ? { error: messageFor(err, status) } : { error: messageFor(err, status), retryAfter };
  res.status(status).json(body);
};

export const notFoundHandler: RequestHandler = () => {
  throw notFound();
};
