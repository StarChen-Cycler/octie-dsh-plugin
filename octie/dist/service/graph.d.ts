/**
 * Service: graph operations and analysis.
 * Wire / merge / delete mutate the DAG; stats/validate read it.
 * All functions persist before returning; failures throw.
 */
import type { TaskGraphStore } from '../core/graph/index.js';
import type { GraphStats, GraphValidation, WireOpts } from './types.js';
export interface WireResult {
    before: string[];
    after: string[];
    taskId: string;
}
export declare function wireTask(projectPath: string, taskId: string, opts: WireOpts): Promise<WireResult>;
export declare function mergePreview(projectPath: string, source: string, target: string): Promise<{
    source: {
        id: string;
        title: string;
        criteriaCount: number;
        deliverablesCount: number;
    };
    target: {
        id: string;
        title: string;
        criteriaCount: number;
        deliverablesCount: number;
    };
}>;
export declare function mergeTask(projectPath: string, source: string, target: string): Promise<{
    sourceId: string;
    targetId: string;
    affectedCount: number;
}>;
export declare function deletePreview(projectPath: string, id: string): Promise<{
    task: {
        id: string;
        title: string;
    };
    dependents: Array<{
        id: string;
        title: string;
    }>;
    blockers: Array<{
        id: string;
        title: string;
    }>;
}>;
export declare function deleteTask(projectPath: string, id: string, mode?: 'reconnect' | 'cascade' | 'simple'): Promise<{
    deletedIds: string[];
}>;
export declare function graphStructure(projectPath: string): Promise<{
    incoming: Record<string, string[]>;
    outgoing: Record<string, string[]>;
    roots: string[];
    nodes: Array<{
        id: string;
        title: string;
        status: string;
    }>;
}>;
export declare function graphStats(projectPath: string): Promise<GraphStats>;
export declare function validateGraph(projectPath: string): Promise<GraphValidation>;
export type { TaskGraphStore };
//# sourceMappingURL=graph.d.ts.map