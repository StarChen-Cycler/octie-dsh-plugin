/**
 * Service: immutable snapshot history.
 */

import { TaskStorage } from '../core/storage/file-store.js';
import type { SnapshotHistoryEntry } from '../types/index.js';

export async function listSnapshots(projectPath: string): Promise<SnapshotHistoryEntry[]> {
  const storage = new TaskStorage({ projectDir: projectPath });
  return await storage.listHistory();
}

export async function restoreSnapshot(
  projectPath: string,
  snapshotId: string,
): Promise<{ snapshotId: string }> {
  const storage = new TaskStorage({ projectDir: projectPath });
  const entries = await storage.listHistory();
  const entry = entries.find(item => item.snapshot_id === snapshotId);
  if (!entry) throw new Error(`Snapshot not found: ${snapshotId}`);
  await storage.restoreSnapshot(snapshotId, { sourceCommand: 'octie-dsh' });
  return { snapshotId };
}
