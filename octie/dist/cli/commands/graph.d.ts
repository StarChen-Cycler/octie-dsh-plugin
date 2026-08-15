/**
 * Graph command - Graph analysis and validation operations
 */
import { Command } from 'commander';
/**
 * Create the graph command
 */
export declare const graphCommand: Command;
/**
 * Walk upstream blockers recursively, collecting from root to target
 * @internal exported for testing
 */
export declare function walkUpstream(graph: import('../../core/graph/index.js').TaskGraphStore, taskId: string, depth?: number, visited?: Set<string>): {
    id: string;
    depth: number;
}[];
/**
 * Walk downstream dependents recursively
 * @internal exported for testing
 */
export declare function walkDownstream(graph: import('../../core/graph/index.js').TaskGraphStore, taskId: string, depth?: number, visited?: Set<string>): {
    id: string;
    depth: number;
}[];
//# sourceMappingURL=graph.d.ts.map