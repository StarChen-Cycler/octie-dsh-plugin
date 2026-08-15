/**
 * Service: immutable snapshot history.
 */
import type { SnapshotHistoryEntry } from '../types/index.js';
export declare function listSnapshots(projectPath: string): Promise<SnapshotHistoryEntry[]>;
export declare function restoreSnapshot(projectPath: string, snapshotId: string): Promise<{
    snapshotId: string;
}>;
//# sourceMappingURL=history.d.ts.map