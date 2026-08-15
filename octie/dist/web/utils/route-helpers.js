/**
 * Shared route helper utilities
 *
 * Extracted from graph.ts, tasks.ts, and projects.ts to eliminate duplication.
 *
 * @module web/utils/route-helpers
 */
import { ERROR_SUGGESTIONS } from '../../types/index.js';
/**
 * Async error handler wrapper
 * Catches async errors and passes them to Express error handling
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res)).catch(next);
    };
}
/**
 * Send successful API response
 */
export function sendSuccess(res, data, status = 200) {
    res.status(status).json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
    });
}
/**
 * Send error API response
 */
export function sendError(res, code, message, status = 400, details, suggestion) {
    res.status(status).json({
        success: false,
        error: {
            code,
            message,
            suggestion: suggestion ?? ERROR_SUGGESTIONS[code],
            details,
        },
        timestamp: new Date().toISOString(),
    });
}
/**
 * Extract project path from query params
 */
export function getProjectPath(req) {
    const authorizedPath = req.octieProjectPath;
    if (authorizedPath) {
        return authorizedPath;
    }
    const project = req.query.project;
    return typeof project === 'string' ? project : undefined;
}
//# sourceMappingURL=route-helpers.js.map