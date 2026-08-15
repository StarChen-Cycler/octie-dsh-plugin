/**
 * Web Server for Octie Task Management System
 *
 * Provides Express.js server with REST API for task operations.
 * Includes CORS, JSON parsing, error handling, request logging, and graceful shutdown.
 *
 * @module web/server
 */
import express from 'express';
/** Runtime API version, always read from the package manifest. */
export declare const API_VERSION: string;
/**
 * Web server configuration options
 */
export interface ServerOptions {
    /** Port to run server on (default: 3456) */
    port?: number;
    /** Host to bind to (default: '127.0.0.1') */
    host?: string;
    /** Open browser automatically (default: false) */
    open?: boolean;
    /** Enable CORS only for the explicit corsOrigin (default: false) */
    cors?: boolean;
    /** Explicit browser origin permitted to call this API cross-origin */
    corsOrigin?: string;
    /** Required for all API requests when binding to a non-loopback host */
    apiToken?: string;
    /** Enable request logging (default: true) */
    logging?: boolean;
}
/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
    /** Indicates success of the request */
    success: boolean;
    /** Response data on success */
    data?: T;
    /** Error details on failure */
    error?: {
        /** Error code for programmatic handling */
        code: string;
        /** Human-readable error message */
        message: string;
        /** Suggestion for how to resolve the error */
        suggestion?: string;
        /** Additional error details */
        details?: unknown;
    };
    /** ISO 8601 timestamp of response */
    timestamp: string;
}
/**
 * Web Server class
 *
 * Manages Express server lifecycle and middleware configuration.
 */
export declare class WebServer {
    private _app;
    private _server;
    private _port;
    private _host;
    private _projectPath;
    private _storage;
    private _graph;
    private _shuttingDown;
    private _fsWatcher;
    private _sseBroadcast;
    private _apiToken?;
    private _shutdownHandlersRegistered;
    private _graphCacheClearers;
    /**
     * Create a new WebServer instance
     * @param projectPath - Path to Octie project directory
     * @param options - Server configuration options
     */
    constructor(projectPath: string, options?: ServerOptions);
    /**
     * Configure Express middleware
     */
    private _configureMiddleware;
    /**
     * CORS middleware
     */
    private _corsMiddleware;
    private _apiTokenMiddleware;
    private _projectAccessMiddleware;
    private _isLoopbackHost;
    private _tokensMatch;
    /**
     * Request logger middleware
     */
    private _requestLogger;
    /**
     * Configure API routes
     */
    private _configureRoutes;
    /**
     * Configure error handling middleware
     */
    private _configureErrorHandling;
    /**
     * Setup graceful shutdown handlers
     */
    private _setupShutdownHandlers;
    /**
     * Start the server
     * @returns Promise that resolves when server is listening
     */
    start(): Promise<void>;
    /**
     * Stop the server
     * @returns Promise that resolves when server is closed
     */
    stop(): Promise<void>;
    /**
     * Get the Express app instance (useful for testing)
     */
    get app(): express.Express;
    /**
     * Get the server URL
     */
    get url(): string;
    /**
     * Check if server is running
     */
    get isRunning(): boolean;
}
/**
 * Create and start a web server
 * @param projectPath - Path to Octie project directory
 * @param options - Server configuration options
 * @returns WebServer instance
 */
export declare function createServer(projectPath: string, options?: ServerOptions): Promise<WebServer>;
//# sourceMappingURL=server.d.ts.map