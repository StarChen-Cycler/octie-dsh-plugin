/**
 * SSE Events Route — Server-Sent Events for auto-refresh
 *
 * Provides a GET /api/events endpoint that streams refresh events
 * to all connected web UI clients when project.json changes on disk.
 *
 * @module web/routes/events
 */

import type { Request, Response, Router } from 'express';

/**
 * Broadcast function type — call this to push a named SSE event to all connected clients
 */
export type SseBroadcast = (event: string, data?: string) => void;

/**
 * Register SSE events routes and return a broadcast function
 * @param router - Express Router instance
 * @returns broadcast function to push events to connected clients
 */
export function registerEventsRoutes(router: Router): SseBroadcast {
  const clients = new Set<Response>();

  router.get('/api/events', (_req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial connection event
    res.write('event: connected\ndata: {}\n\n');

    // Register client
    clients.add(res);

    // Heartbeat every 15s to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 15000);

    // Cleanup on connection close
    res.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
  });

  return (event: string, data: string = '') => {
    const payload = typeof data === 'string' && data.length > 0
      ? `event: ${event}\ndata: ${data}\n\n`
      : `event: ${event}\ndata:\n\n`;
    for (const client of clients) {
      client.write(payload);
    }
  };
}
