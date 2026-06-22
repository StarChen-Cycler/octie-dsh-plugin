/**
 * Shared route helper utilities
 *
 * Extracted from graph.ts, tasks.ts, and projects.ts to eliminate duplication.
 *
 * @module web/utils/route-helpers
 */

import type { Request, Response } from 'express';
import { ERROR_SUGGESTIONS } from '../../types/index.js';
import type { ApiResponse } from '../server.js';

/**
 * Async error handler wrapper
 * Catches async errors and passes them to Express error handling
 */
export function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err?: Error) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

/**
 * Send successful API response
 */
export function sendSuccess<T>(res: Response, data: T, status: number = 200): void {
  res.status(status).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  } satisfies ApiResponse<T>);
}

/**
 * Send error API response
 */
export function sendError(
  res: Response,
  code: string,
  message: string,
  status: number = 400,
  details?: unknown,
  suggestion?: string
): void {
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      suggestion: suggestion ?? ERROR_SUGGESTIONS[code],
      details,
    },
    timestamp: new Date().toISOString(),
  } satisfies ApiResponse);
}

/**
 * Extract project path from query params
 */
export function getProjectPath(req: Request): string | undefined {
  const project = req.query.project;
  return typeof project === 'string' ? project : undefined;
}
