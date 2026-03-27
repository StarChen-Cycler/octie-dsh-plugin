/**
 * Immutable snapshot history storage for Octie projects.
 *
 * Stores full project.json snapshots and an append-only metadata log.
 */

import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { hasCycle } from '../graph/cycle.js';
import type { TaskGraphStore } from '../graph/index.js';
import type {
  ProjectFile,
  SnapshotGraphHealth,
  SnapshotHistoryEntry,
} from '../../types/index.js';
import { FileOperationError } from '../../types/index.js';
import { AtomicFileWriter } from './atomic-write.js';

export interface SnapshotWriteContext {
  reason?: string;
  sourceCommand?: string;
  restoredFromSnapshotId?: string;
  forceSnapshot?: boolean;
}

const HISTORY_DIR_NAME = 'history';
const SNAPSHOTS_DIR_NAME = 'snapshots';
const HISTORY_FILE_NAME = 'history.ndjson';

function isGraphCommand(token: string): boolean {
  return [
    'approve',
    'batch',
    'create',
    'delete',
    'graph',
    'handoff',
    'history',
    'import',
    'init',
    'merge',
    'update',
    'wire',
  ].includes(token);
}

function commandSupportsSubcommand(token: string): boolean {
  return ['graph', 'handoff', 'history'].includes(token);
}

export function inferSnapshotWriteContext(rawArgs: string[] = process.argv.slice(2)): SnapshotWriteContext {
  const firstCommand = rawArgs.find(token => !token.startsWith('-'));
  if (!firstCommand || !isGraphCommand(firstCommand)) {
    return {
      reason: 'save',
      sourceCommand: 'storage.save',
    };
  }

  let sourceCommand = `octie ${firstCommand}`;
  let reason = firstCommand.replace(/-/g, '_');

  if (commandSupportsSubcommand(firstCommand)) {
    const firstIndex = rawArgs.indexOf(firstCommand);
    const maybeSubcommand = rawArgs[firstIndex + 1];
    if (maybeSubcommand && !maybeSubcommand.startsWith('-')) {
      sourceCommand = `octie ${firstCommand} ${maybeSubcommand}`;
      reason = `${reason}_${maybeSubcommand.replace(/-/g, '_')}`;
    }
  }

  return {
    reason,
    sourceCommand,
  };
}

function serializeProjectFile(projectFile: ProjectFile): string {
  return JSON.stringify(projectFile, null, 2);
}

function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function computeGraphHealth(graph: TaskGraphStore): SnapshotGraphHealth {
  const tasks = graph.getAllTasks();
  const edgeCount = tasks.reduce((count, task) => count + task.edges.length, 0);

  return {
    task_count: tasks.length,
    edge_count: edgeCount,
    orphan_count: graph.getOrphanTasks().length,
    root_count: graph.getRootTasks().length,
    has_cycle: hasCycle(graph),
  };
}

export class ProjectHistoryStore {
  private readonly _octieDirPath: string;
  private readonly _writer: AtomicFileWriter;

  constructor(octieDirPath: string, writer: AtomicFileWriter) {
    this._octieDirPath = octieDirPath;
    this._writer = writer;
  }

  get historyDirPath(): string {
    return join(this._octieDirPath, HISTORY_DIR_NAME);
  }

  get snapshotsDirPath(): string {
    return join(this.historyDirPath, SNAPSHOTS_DIR_NAME);
  }

  get historyFilePath(): string {
    return join(this.historyDirPath, HISTORY_FILE_NAME);
  }

  async ensureHistoryDirs(): Promise<void> {
    await this._writer.ensureDir(this.historyDirPath);
    await this._writer.ensureDir(this.snapshotsDirPath);
  }

  async createSnapshot(
    projectFile: ProjectFile,
    graph: TaskGraphStore,
    context: SnapshotWriteContext = {},
  ): Promise<SnapshotHistoryEntry> {
    await this.ensureHistoryDirs();

    const createdAt = new Date().toISOString();
    const snapshotId = randomUUID();
    const snapshotFileName = `${snapshotId}.json`;
    const snapshotPath = join(this.snapshotsDirPath, snapshotFileName);
    const snapshotFile = `history/snapshots/${snapshotFileName}`;
    const content = serializeProjectFile(projectFile);
    const entry: SnapshotHistoryEntry = {
      snapshot_id: snapshotId,
      created_at: createdAt,
      reason: context.reason || 'save',
      source_command: context.sourceCommand || 'storage.save',
      live_file_hash: computeContentHash(content),
      snapshot_file: snapshotFile,
      ...computeGraphHealth(graph),
    };

    if (context.restoredFromSnapshotId) {
      entry.restored_from_snapshot_id = context.restoredFromSnapshotId;
    }

    try {
      await this._writer.write(snapshotPath, projectFile, { createBackup: false });
      await this._writer.append(this.historyFilePath, `${JSON.stringify(entry)}\n`);
    } catch (error) {
      throw new FileOperationError(
        `Failed to record snapshot history: ${error instanceof Error ? error.message : String(error)}`,
        this.historyFilePath,
      );
    }

    return entry;
  }

  async listSnapshots(): Promise<SnapshotHistoryEntry[]> {
    if (!await this._writer.exists(this.historyFilePath)) {
      return [];
    }

    try {
      const content = await this._writer.read(this.historyFilePath);
      return content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => JSON.parse(line) as SnapshotHistoryEntry)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    } catch (error) {
      throw new FileOperationError(
        `Failed to read snapshot history: ${error instanceof Error ? error.message : String(error)}`,
        this.historyFilePath,
      );
    }
  }

  async loadSnapshot(snapshotId: string): Promise<{ entry: SnapshotHistoryEntry; projectFile: ProjectFile }> {
    const entries = await this.listSnapshots();
    const entry = entries.find(item => item.snapshot_id === snapshotId);
    if (!entry) {
      throw new FileOperationError(`Snapshot not found: ${snapshotId}`, this.historyFilePath);
    }

    const snapshotPath = join(this._octieDirPath, entry.snapshot_file);
    const projectFile = await this._writer.readJSON<ProjectFile>(snapshotPath);
    return { entry, projectFile };
  }
}
