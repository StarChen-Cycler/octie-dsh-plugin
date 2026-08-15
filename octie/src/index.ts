/**
 * Octie - Graph-based task management system
 *
 * Main entry point for the library.
 */

export { TaskGraphStore } from './core/graph/index.js';
export { TaskNode } from './core/models/task-node.js';
export { TaskStorage } from './core/storage/file-store.js';
// Project activity signal (project.json mtime): the DSH plugin and web API
// rank project lists by it so recently task-updated projects surface first.
export { getProjectLastUpdated } from './core/registry/index.js';
export * from './types/index.js';
// DSH-agnostic service layer (the engine behind the octie-dsh bundle):
export * from './service/index.js';
