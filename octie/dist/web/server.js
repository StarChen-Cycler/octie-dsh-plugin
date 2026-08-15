/**
 * Web Server for Octie Task Management System
 *
 * Provides Express.js server with REST API for task operations.
 * Includes CORS, JSON parsing, error handling, request logging, and graceful shutdown.
 *
 * @module web/server
 */
import express from 'express';
import { createServer as httpCreateServer } from 'node:http';
import { existsSync, watch, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TaskStorage } from '../core/storage/file-store.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { registerGraphRoutes } from './routes/graph.js';
import { registerProjectsRoutes } from './routes/projects.js';
import { registerEventsRoutes } from './routes/events.js';
import { OctieError, ERROR_SUGGESTIONS } from '../types/index.js';
import { loadRegistry } from '../core/registry/index.js';
import { ZodError } from 'zod';
// Get the directory of this module for static file paths
const __dirname = dirname(fileURLToPath(import.meta.url));
// ponytail: single-file IPC — server writes its URL here, CLI reads it so
// cache invalidation works regardless of port. If multiple servers run, last wins.
const LAST_SERVER_URL_FILE = join(homedir(), '.octie', '.last-server-url');
function readPackageVersion() {
    const packagePath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    return typeof packageJson.version === 'string' ? packageJson.version : 'unknown';
}
/** Runtime API version, always read from the package manifest. */
export const API_VERSION = readPackageVersion();
/**
 * Web Server class
 *
 * Manages Express server lifecycle and middleware configuration.
 */
export class WebServer {
    _app;
    _server = null;
    _port;
    _host;
    _projectPath;
    _storage;
    _graph = null;
    _shuttingDown = false;
    _fsWatcher = null;
    _sseBroadcast = null;
    _apiToken;
    _shutdownHandlersRegistered = false;
    _graphCacheClearers = [];
    /**
     * Create a new WebServer instance
     * @param projectPath - Path to Octie project directory
     * @param options - Server configuration options
     */
    constructor(projectPath, options = {}) {
        this._projectPath = projectPath;
        this._port = options.port ?? 3456;
        // Explicit IPv4 loopback avoids Windows environments where `localhost`
        // resolves to an unusable IPv6 ::1 listener.
        this._host = options.host ?? '127.0.0.1';
        this._apiToken = options.apiToken;
        if (!this._isLoopbackHost(this._host) && !this._apiToken) {
            throw new Error('An --api-token is required when serving Octie on a non-local host.');
        }
        this._storage = new TaskStorage({ projectDir: projectPath });
        // Initialize Express app
        this._app = express();
        // Configure middleware
        this._configureMiddleware(options);
        // Configure routes
        this._configureRoutes();
        // Configure error handling
        this._configureErrorHandling();
    }
    /**
     * Configure Express middleware
     */
    _configureMiddleware(options) {
        // JSON body parser with size limit
        this._app.use(express.json({ limit: '10mb' }));
        // URL-encoded parser
        this._app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        // CORS middleware (enabled by default)
        if (options.cors === true && options.corsOrigin) {
            this._app.use(this._corsMiddleware(options.corsOrigin));
        }
        if (this._apiToken) {
            this._app.use('/api', this._apiTokenMiddleware());
        }
        // Request logging middleware (enabled by default)
        if (options.logging !== false) {
            this._app.use(this._requestLogger());
        }
        // Trust proxy for proper X-Forwarded-* headers
        this._app.set('trust proxy', true);
    }
    /**
     * CORS middleware
     */
    _corsMiddleware(allowedOrigin) {
        return (req, res, next) => {
            if (req.headers.origin !== allowedOrigin) {
                if (req.method === 'OPTIONS') {
                    res.sendStatus(403);
                    return;
                }
                next();
                return;
            }
            res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
            res.setHeader('Vary', 'Origin');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Octie-Token');
            res.setHeader('Access-Control-Max-Age', '86400');
            if (req.method === 'OPTIONS') {
                res.sendStatus(204);
                return;
            }
            next();
        };
    }
    _apiTokenMiddleware() {
        return (req, res, next) => {
            if (req.method === 'OPTIONS') {
                next();
                return;
            }
            const authorization = req.get('authorization');
            const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
            const providedToken = req.get('x-octie-token') || bearerToken;
            if (!providedToken || !this._apiToken || !this._tokensMatch(providedToken, this._apiToken)) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'A valid Octie API token is required.',
                    },
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            next();
        };
    }
    _projectAccessMiddleware() {
        return (req, res, next) => {
            const requestedProject = req.query.project;
            if (requestedProject === undefined) {
                next();
                return;
            }
            if (typeof requestedProject !== 'string' || !requestedProject) {
                res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_PROJECT_PATH', message: 'Project path must be a non-empty string.' },
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            const canonicalPath = resolve(requestedProject);
            const allowedPaths = new Set([
                resolve(this._projectPath),
                ...Object.values(loadRegistry().projects).map(project => resolve(project.path)),
            ]);
            if (!allowedPaths.has(canonicalPath)) {
                res.status(403).json({
                    success: false,
                    error: { code: 'PROJECT_ACCESS_DENIED', message: 'This project is not registered for this Octie server.' },
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            req.octieProjectPath = canonicalPath;
            next();
        };
    }
    _isLoopbackHost(host) {
        return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host.toLowerCase());
    }
    _tokensMatch(provided, expected) {
        const providedBuffer = Buffer.from(provided);
        const expectedBuffer = Buffer.from(expected);
        return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
    }
    /**
     * Request logger middleware
     */
    _requestLogger() {
        return (req, res, next) => {
            const start = Date.now();
            // Log request
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            // Log response when finished
            res.on('finish', () => {
                const duration = Date.now() - start;
                const statusColor = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
                console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${statusColor}${res.statusCode}\x1b[0m ${duration}ms`);
            });
            next();
        };
    }
    /**
     * Configure API routes
     */
    _configureRoutes() {
        // Serve the actual Octie web UI bundle only. Do not fall back to legacy
        // html reports here because they can be Vitest output rather than the app.
        const possibleWebUiPaths = [
            join(__dirname, '../web-ui'), // packaged build: dist/web-ui
            join(__dirname, '../../web-ui/dist'), // local repo fallback
        ];
        let webUiPath = null;
        for (const path of possibleWebUiPaths) {
            if (existsSync(path)) {
                webUiPath = path;
                break;
            }
        }
        if (webUiPath) {
            // Serve static files from web UI directory
            this._app.use(express.static(webUiPath));
        }
        else {
            // Fallback: redirect root to API if no web UI found
            this._app.get('/', (_req, res) => {
                res.redirect('/api');
            });
        }
        // Serve Vitest / coverage HTML separately at /test so it never replaces
        // the main application UI at the root route.
        const possibleTestPaths = [
            join(process.cwd(), 'html'), // caller cwd html (vitest output)
            join(__dirname, '../../html'), // package root html
        ];
        for (const testPath of possibleTestPaths) {
            if (existsSync(testPath) && existsSync(join(testPath, 'index.html'))) {
                this._app.use('/test', express.static(testPath));
                break;
            }
        }
        // Project query paths are only allowed for the served project or a registered project.
        this._app.use('/api', this._projectAccessMiddleware());
        // Health check endpoint
        this._app.get('/health', (_req, res) => {
            res.json({
                success: true,
                data: {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                },
                timestamp: new Date().toISOString(),
            });
        });
        // API info endpoint
        this._app.get('/api', (_req, res) => {
            res.json({
                success: true,
                data: {
                    name: 'Octie API',
                    version: API_VERSION,
                    description: 'Graph-based task management system API',
                    endpoints: {
                        health: 'GET /health',
                        tasks: 'GET /api/tasks, POST /api/tasks, GET /api/tasks/:id, PUT /api/tasks/:id, DELETE /api/tasks/:id, POST /api/tasks/:id/merge',
                        graph: 'GET /api/graph, GET /api/graph/topology, POST /api/graph/validate, GET /api/graph/cycles, GET /api/graph/critical-path',
                        stats: 'GET /api/stats',
                        events: 'GET /api/events (SSE auto-refresh)',
                    },
                },
                timestamp: new Date().toISOString(),
            });
        });
        // Project metadata endpoint
        this._app.get('/api/project', async (_req, res) => {
            try {
                if (!this._graph) {
                    this._graph = await this._storage.load();
                }
                const metadata = this._graph.metadata;
                res.json({
                    success: true,
                    data: metadata,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load project metadata';
                res.status(500).json({
                    success: false,
                    error: {
                        code: 'PROJECT_LOAD_ERROR',
                        message,
                    },
                    timestamp: new Date().toISOString(),
                });
            }
        });
        // Register task routes
        const { clearCache: clearTaskCache } = registerTaskRoutes(this._app, () => this._graph, async (graph) => {
            if (graph)
                await this._storage.save(graph);
        }, () => this._sseBroadcast?.('refresh'));
        // Register graph routes
        const { clearCache: clearGraphCache } = registerGraphRoutes(this._app, () => this._graph);
        // Store cache clearers for fs.watch cache invalidation
        this._graphCacheClearers = [clearTaskCache, clearGraphCache];
        // Register projects routes (global registry)
        registerProjectsRoutes(this._app);
        // Register SSE events route (auto-refresh for web UI)
        this._sseBroadcast = registerEventsRoutes(this._app);
        // 404 handler for unmatched routes
        this._app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: `Endpoint not found: ${req.method} ${req.path}`,
                    suggestion: 'Check the API documentation at /api for available endpoints.',
                },
                timestamp: new Date().toISOString(),
            });
        });
    }
    /**
     * Configure error handling middleware
     */
    _configureErrorHandling() {
        // Global error handler with proper status code mapping
        this._app.use((err, _req, res, _next) => {
            console.error(`[${new Date().toISOString()}] Error:`, err.message);
            // Handle Zod validation errors
            if (err instanceof ZodError) {
                const formattedErrors = err.errors.map(e => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Request validation failed',
                        details: formattedErrors,
                        suggestion: 'Check the request body format and ensure all required fields are provided with valid values.',
                    },
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            // Handle OctieError with proper status code and suggestion
            if (err instanceof OctieError) {
                res.status(err.statusCode).json({
                    success: false,
                    error: {
                        code: err.code,
                        message: err.message,
                        suggestion: err.suggestion,
                    },
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            // Handle generic errors
            const statusCode = 500;
            const code = 'INTERNAL_ERROR';
            const message = err.message || 'An unexpected error occurred';
            res.status(statusCode).json({
                success: false,
                error: {
                    code,
                    message,
                    suggestion: ERROR_SUGGESTIONS[code],
                    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
                },
                timestamp: new Date().toISOString(),
            });
        });
    }
    /**
     * Setup graceful shutdown handlers
     */
    _setupShutdownHandlers() {
        if (this._shutdownHandlersRegistered) {
            return;
        }
        this._shutdownHandlersRegistered = true;
        const shutdown = async (signal) => {
            if (this._shuttingDown) {
                console.log('Force shutdown detected, exiting immediately');
                process.exit(1);
            }
            this._shuttingDown = true;
            console.log(`\n${signal} received, shutting down gracefully...`);
            if (this._server) {
                // Stop accepting new connections
                this._server.close(() => {
                    console.log('Server closed');
                    process.exit(0);
                });
                // Force shutdown after 10 seconds
                setTimeout(() => {
                    console.error('Forced shutdown after timeout');
                    process.exit(1);
                }, 10000);
            }
            else {
                process.exit(0);
            }
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    /**
     * Start the server
     * @returns Promise that resolves when server is listening
     */
    async start() {
        // Verify project exists
        if (!(await this._storage.exists())) {
            throw new Error(`No Octie project found at ${this._projectPath}`);
        }
        // Load graph
        this._graph = await this._storage.load();
        this._setupShutdownHandlers();
        // Create HTTP server
        this._server = httpCreateServer(this._app);
        // Start listening
        return new Promise((resolve, reject) => {
            if (!this._server) {
                reject(new Error('Server not initialized'));
                return;
            }
            this._server.once('error', (err) => {
                reject(err);
            });
            this._server.listen(this._port, this._host, () => {
                const url = `http://${this._host}:${this._port}`;
                console.log(`\n🚀 Octie Web Server started`);
                console.log(`📍 Project: ${this._projectPath}`);
                console.log(`🔗 URL: ${url}`);
                console.log(`📊 API: ${url}/api`);
                console.log(`\nPress Ctrl+C to stop\n`);
                // Write server URL so CLI cache invalidation works regardless of port
                try {
                    writeFileSync(LAST_SERVER_URL_FILE, url, 'utf-8');
                }
                catch { /* best-effort */ }
                // Start file watcher for auto-refresh via SSE
                const projectFile = this._storage.projectFilePath;
                if (existsSync(projectFile)) {
                    let debounceTimer = null;
                    this._fsWatcher = watch(projectFile, (_eventType) => {
                        if (debounceTimer)
                            clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(async () => {
                            // Reload the server's own graph instance from disk
                            try {
                                this._graph = await this._storage.load();
                            }
                            catch { /* keep stale if load fails */ }
                            // Invalidate route-level caches so next request loads fresh data
                            for (const clearer of this._graphCacheClearers) {
                                clearer(this._projectPath);
                            }
                            if (this._sseBroadcast) {
                                this._sseBroadcast('refresh');
                            }
                        }, 200);
                    });
                    console.log(`👁️  Watching: ${projectFile} for auto-refresh\n`);
                }
                resolve();
            });
        });
    }
    /**
     * Stop the server
     * @returns Promise that resolves when server is closed
     */
    async stop() {
        if (this._fsWatcher) {
            await this._fsWatcher.close();
            this._fsWatcher = null;
        }
        // Clean up server URL file
        try {
            unlinkSync(LAST_SERVER_URL_FILE);
        }
        catch { /* best-effort */ }
        if (!this._server) {
            return;
        }
        return new Promise((resolve) => {
            if (!this._server) {
                resolve();
                return;
            }
            this._server.close(() => {
                this._server = null;
                console.log('Server stopped');
                resolve();
            });
        });
    }
    /**
     * Get the Express app instance (useful for testing)
     */
    get app() {
        return this._app;
    }
    /**
     * Get the server URL
     */
    get url() {
        return `http://${this._host}:${this._port}`;
    }
    /**
     * Check if server is running
     */
    get isRunning() {
        return this._server !== null && this._server.listening;
    }
}
/**
 * Create and start a web server
 * @param projectPath - Path to Octie project directory
 * @param options - Server configuration options
 * @returns WebServer instance
 */
export async function createServer(projectPath, options = {}) {
    const server = new WebServer(projectPath, options);
    await server.start();
    return server;
}
//# sourceMappingURL=server.js.map