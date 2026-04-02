import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { GUIDE_REGISTRY } from '../../../../src/cli/commands/guides.js';

describe('guide flags', () => {
  const cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');
  const distGuidesDir = join(process.cwd(), 'dist', 'cli', 'guides');
  let tempDir: string;

  function runCli(command: string): string {
    return execSync(`node ${cliPath} ${command}`, {
      encoding: 'utf-8',
    });
  }

  beforeEach(() => {
    tempDir = join(tmpdir(), `octie-guides-${uuidv4()}`);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors.
    }
  });

  it('prints markdown-backed content for every registered guide flag', () => {
    const expectedTitles = new Map<string, string>([
      ['--right-way-to-form-tasks', 'Right Way To Form Tasks'],
      ['--right-way-to-manage-dependencies', 'Right Way To Manage Dependencies'],
      ['--right-way-to-find-work', 'Right Way To Find Work'],
      ['--right-way-to-review-and-approve', 'Right Way To Review And Approve'],
      ['--right-way-to-refine-tasks', 'Right Way To Refine Tasks'],
      ['--right-way-to-use-notes-and-files', 'Right Way To Use Notes And Files'],
      ['--right-way-to-create-subtask-handoff', 'Right Way To Create Subtask Handoff'],
    ]);

    for (const guide of GUIDE_REGISTRY) {
      const output = runCli(guide.flag);
      expect(output).toContain(expectedTitles.get(guide.flag));
    }
  });

  it('lists every guide flag in root help output', () => {
    const output = runCli('--help');

    for (const guide of GUIDE_REGISTRY) {
      expect(output).toContain(guide.flag);
    }
  });

  it('falls back to src guide markdown when dist guide assets are missing', () => {
    const backupDir = `${distGuidesDir}-backup`;

    try {
      if (existsSync(backupDir)) {
        rmSync(backupDir, { recursive: true, force: true });
      }

      renameSync(distGuidesDir, backupDir);

      const output = runCli('--right-way-to-form-tasks');
      expect(output).toContain('Right Way To Form Tasks');
    } finally {
      if (existsSync(backupDir)) {
        renameSync(backupDir, distGuidesDir);
      }
    }
  });

  it('does not hijack option values that happen to equal a guide flag', () => {
    mkdirSync(tempDir, { recursive: true });
    runCli(`init --project "${tempDir}" --name "guide-notes-test"`);

    const output = runCli(
      `--project "${tempDir}" create ` +
      `--title "Create guide note task" ` +
      `--description "Create a task whose notes intentionally contain a guide flag token so argument parsing does not short-circuit the command." ` +
      `--success-criterion "Task is created successfully" ` +
      `--deliverable "notes.txt" ` +
      `--notes "--right-way-to-find-work"`,
    );

    expect(output).toContain('Task created');
    expect(output).not.toContain('Right Way To Find Work');
  });
});
