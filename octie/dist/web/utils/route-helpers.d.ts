/**
 * Shared route helper utilities
 *
 * Extracted from graph.ts, tasks.ts, and projects.ts to eliminate duplication.
 *
 * @module web/utils/route-helpers
 */
import type { Request, Response } from 'express';
export interface ProjectScopedRequest extends Request {
    /** Canonical path set by the server's project access middleware. */
    octieProjectPath?: string;
}
/**
 * Async error handler wrapper
 * Catches async errors and passes them to Express error handling
 */
export declare function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): (req: Request, res: Response, next: (err?: Error) => void) => void;
/**
 * Send successful API response
 */
export declare function sendSuccess<T>(res: Response, data: T, status?: number): void;
/**
 * Send error API response
 */
export declare function sendError(res: Response, code: string, message: string, status?: number, details?: unknown, suggestion?: string): void;
/**
 * Extract project path from query params
 */
export declare function getProjectPath(req: Request): string | undefined;
//# sourceMappingURL=route-helpers.d.ts.map