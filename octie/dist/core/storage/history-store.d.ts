/**
 * Immutable snapshot history storage for Octie projects.
 *
 * Stores full project.json snapshots and an append-only metadata log.
 */
import type { TaskGraphStore } from '../graph/index.js';
import type { ProjectFile, SnapshotGraphHealth, SnapshotHistoryEntry } from '../../types/index.js';
import { AtomicFileWriter } from './atomic-write.js';
export interface SnapshotWriteContext {
    reason?: string;
    sourceCommand?: string;
    restoredFromSnapshotId?: string;
    forceSnapshot?: boolean;
}
export declare function inferSnapshotWriteContext(rawArgs?: string[]): SnapshotWriteContext;
export declare function computeGraphHealth(graph: TaskGraphStore): SnapshotGraphHealth;
export declare class ProjectHistoryStore {
    private readonly _octieDirPath;
    private readonly _writer;
    private readonly _snapshotRetention;
    constructor(octieDirPath: string, writer: AtomicFileWriter, snapshotRetention: number);
    get historyDirPath(): string;
    get snapshotsDirPath(): string;
    get historyFilePath(): string;
    ensureHistoryDirs(): Promise<void>;
    createSnapshot(projectFile: ProjectFile, graph: TaskGraphStore, context?: SnapshotWriteContext): Promise<SnapshotHistoryEntry>;
    listSnapshots(): Promise<SnapshotHistoryEntry[]>;
    loadSnapshot(snapshotId: string): Promise<{
        entry: SnapshotHistoryEntry;
        projectFile: ProjectFile;
    }>;
    private _pruneSnapshots;
}
//# sourceMappingURL=history-store.d.ts.map