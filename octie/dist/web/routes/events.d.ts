/**
 * SSE Events Route — Server-Sent Events for auto-refresh
 *
 * Provides a GET /api/events endpoint that streams refresh events
 * to all connected web UI clients when project.json changes on disk.
 *
 * @module web/routes/events
 */
import type { Router } from 'express';
/**
 * Broadcast function type — call this to push a named SSE event to all connected clients
 */
export type SseBroadcast = (event: string, data?: string) => void;
/**
 * Register SSE events routes and return a broadcast function
 * @param router - Express Router instance
 * @returns broadcast function to push events to connected clients
 */
export declare function registerEventsRoutes(router: Router): SseBroadcast;
//# sourceMappingURL=events.d.ts.map