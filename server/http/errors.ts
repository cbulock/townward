import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorBody } from '../../src/shared/api.ts';

/**
 * Handlers and services throw HttpError for anything the client should see; the error
 * middleware turns it into `{ error }` JSON. Anything else is logged and becomes a 500.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message = 'Please log in') => new HttpError(401, message);
export const forbidden = (message: string) => new HttpError(403, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
export const tooManyRequests = () => new HttpError(429, 'Too many attempts. Try again in a few minutes.');

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
  const body: ApiErrorBody = { error: messageFor(err, status) };
  res.status(status).json(body);
};

export const notFoundHandler: RequestHandler = () => {
  throw notFound();
};
