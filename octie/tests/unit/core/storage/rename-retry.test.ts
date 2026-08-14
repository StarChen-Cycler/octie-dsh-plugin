/**
 * Tests for renameWithRetry (transient Windows EPERM/EBUSY absorption).
 */

import { describe, it, expect } from 'vitest';
import { renameWithRetry } from '../../../../src/core/storage/atomic-write.js';

function transientErr(code: string, times: number) {
  let calls = 0;
  return async () => {
    calls += 1;
    if (calls <= times) {
      const err = new Error('lock held') as Error & { code: string };
      err.code = code;
      throw err;
    }
  };
}

describe('renameWithRetry', () => {
  it('succeeds on the first attempt without retrying', async () => {
    let calls = 0;
    const attempts = await renameWithRetry(async () => { calls += 1; });
    expect(attempts).toBe(1);
    expect(calls).toBe(1);
  });

  it('absorbs transient EPERM and succeeds after retries', async () => {
    const attempts = await renameWithRetry(transientErr('EPERM', 2));
    expect(attempts).toBe(3);
  });

  it('absorbs transient EBUSY and succeeds after retries', async () => {
    const attempts = await renameWithRetry(transientErr('EBUSY', 1));
    expect(attempts).toBe(2);
  });

  it('gives up after maxRetries persistent EPERM', async () => {
    await expect(renameWithRetry(transientErr('EPERM', 99), { maxRetries: 5, baseDelayMs: 1 }))
      .rejects.toThrow(/lock held/);
  });

  it('fails fast on non-transient errors without retrying', async () => {
    let calls = 0;
    await expect(renameWithRetry(async () => {
      calls += 1;
      const err = new Error('ENOENT') as Error & { code: string };
      err.code = 'ENOENT';
      throw err;
    })).rejects.toThrow(/ENOENT/);
    expect(calls).toBe(1);
  });
});
