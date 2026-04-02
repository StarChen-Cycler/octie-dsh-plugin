import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, chmodSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';
import { combineHandoffFailure, HandoffRollbackError } from '../../../../src/cli/commands/handoff.js';

describe('handoff command', () => {
  let tempDir: string;
  let tempHome: string;
  let cliPath: string;
  let env: NodeJS.ProcessEnv;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    tempDir = join(tmpdir(), `octie-handoff-test-${uuidv4()}`);
    tempHome = join(tmpdir(), `octie-home-${uuidv4()}`);
    mkdirSync(tempHome, { recursive: true });
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');

    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
    env = {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
    };
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;

    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors.
    }

    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors.
    }
  });

  function runCli(command: string): string {
    return execSync(`node ${cliPath} ${command}`, {
      encoding: 'utf-8',
      env,
    });
  }

  function getExecErrorText(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  it('creates a child subproject, appends handoff notes, and keeps linkage note-only', async () => {
    const parentName = `parent-${uuidv4().substring(0, 8)}`;
    const subprojectName = `child-${uuidv4().substring(0, 8)}`;
    runCli(`init --project "${tempDir}" --name "${parentName}"`);

    const output = runCli(
      `--project "${tempDir}" handoff create ` +
      `--subproject-name "${subprojectName}" ` +
      `--title "Create ${subprojectName} handoff gate" ` +
      `--description "Create a loose parent handoff that points to a child Octie project so detailed follow-on work can move into a dedicated subproject graph." ` +
      `--success-criterion "Child subproject exists at the expected path" ` +
      `--deliverable "parent handoff task record"`,
    );

    expect(output).toContain('Handoff created');

    const childProjectPath = join(tempDir, '.octie', 'subprojects', subprojectName, '.octie', 'project.json');
    expect(existsSync(childProjectPath)).toBe(true);

    const storage = new TaskStorage({ projectDir: tempDir });
    const graph = await storage.load();
    expect(graph.size).toBe(1);

    const task = graph.getAllTasks()[0];
    expect(task?.notes).toContain(`.octie/subprojects/${subprojectName}/`);
    expect(task?.notes).toContain('This is a loose contextual reference only.');
    expect(task?.notes).toContain('Create the child closeout gate manually inside the child project.');
    expect(task?.related_files).toEqual([]);
    expect(task?.sub_items).toEqual([]);

    rmSync(join(tempDir, '.octie', 'subprojects', subprojectName), { recursive: true, force: true });
    const graphAfterDelete = await storage.load();
    expect(graphAfterDelete.size).toBe(1);
    expect(graphAfterDelete.getAllTasks()[0]?.id).toBe(task?.id);
  });

  it('fails fast when the target subproject folder already exists without creating parent task state', async () => {
    const parentName = `parent-${uuidv4().substring(0, 8)}`;
    const subprojectName = `child-${uuidv4().substring(0, 8)}`;
    runCli(`init --project "${tempDir}" --name "${parentName}"`);
    mkdirSync(join(tempDir, '.octie', 'subprojects', subprojectName), { recursive: true });

    expect(() => {
      runCli(
        `--project "${tempDir}" handoff create ` +
        `--subproject-name "${subprojectName}" ` +
        `--title "Create duplicate handoff gate" ` +
        `--description "Create a second loose handoff against the same child folder to verify the command aborts before adding parent task state." ` +
        `--success-criterion "Command aborts before creating parent task state" ` +
        `--deliverable "duplicate handoff attempt record"`,
      );
    }).toThrow();

    const storage = new TaskStorage({ projectDir: tempDir });
    const graph = await storage.load();
    expect(graph.size).toBe(0);
  });

  it('rolls back the child subproject when parent task persistence fails', () => {
    const parentName = `parent-${uuidv4().substring(0, 8)}`;
    const subprojectName = `child-${uuidv4().substring(0, 8)}`;
    runCli(`init --project "${tempDir}" --name "${parentName}"`);

    const parentProjectFile = join(tempDir, '.octie', 'project.json');
    chmodSync(parentProjectFile, 0o444);

    try {
      expect(() => {
        runCli(
          `--project "${tempDir}" handoff create ` +
          `--subproject-name "${subprojectName}" ` +
          `--title "Create rollback handoff gate" ` +
          `--description "Create a loose handoff that should fail while saving the parent project so child project rollback can be verified." ` +
          `--success-criterion "Child project.json exists before parent save attempt" ` +
          `--deliverable "rollback handoff attempt record"`,
        );
      }).toThrow();

      expect(existsSync(join(tempDir, '.octie', 'subprojects', subprojectName))).toBe(false);
    } finally {
      chmodSync(parentProjectFile, 0o666);
    }
  });

  it('reports rollback cleanup as incomplete when unregisterProject cannot clear the child registry entry', () => {
    const parentName = `parent-${uuidv4().substring(0, 8)}`;
    const subprojectName = `child-${uuidv4().substring(0, 8)}`;
    runCli(`init --project "${tempDir}" --name "${parentName}"`);

    const parentProjectFile = join(tempDir, '.octie', 'project.json');
    const registryDir = join(tempHome, '.octie');
    const registryLockPath = join(registryDir, 'projects.lock');
    mkdirSync(registryDir, { recursive: true });
    writeFileSync(registryLockPath, 'locked');
    chmodSync(parentProjectFile, 0o444);

    try {
      expect(() => {
        runCli(
          `--project "${tempDir}" handoff create ` +
          `--subproject-name "${subprojectName}" ` +
          `--title "Create registry rollback handoff gate" ` +
          `--description "Create a loose handoff that should fail while saving the parent project so rollback can report an incomplete registry cleanup path." ` +
          `--success-criterion "CLI exits with code 1 when parent save fails" ` +
          `--deliverable "registry rollback handoff attempt record"`,
        );
      }).toThrow(/rollback cleanup incomplete/i);
    } finally {
      chmodSync(parentProjectFile, 0o666);
      rmSync(registryLockPath, { force: true });
    }
  });

  it('reports both original and rollback failures when directory removal also fails', () => {
    const parentName = `parent-${uuidv4().substring(0, 8)}`;
    const subprojectName = `child-${uuidv4().substring(0, 8)}`;
    runCli(`init --project "${tempDir}" --name "${parentName}"`);

    const parentProjectFile = join(tempDir, '.octie', 'project.json');
    chmodSync(parentProjectFile, 0o444);

    try {
      let errorText = '';
      try {
        execSync(
          `node ${cliPath} --project "${tempDir}" handoff create ` +
          `--subproject-name "${subprojectName}" ` +
          `--title "Create dual failure handoff gate" ` +
          `--description "Create a loose handoff that should fail while saving the parent project and also fail during rollback directory removal so both failure details are surfaced." ` +
          `--success-criterion "CLI stderr contains rollback diagnostics when parent save fails" ` +
          `--deliverable "dual failure handoff attempt record"`,
          {
            encoding: 'utf-8',
            env: {
              ...env,
              OCTIE_TEST_FORCE_HANDOFF_RM_SYNC_FAILURE: '1',
            },
            stdio: 'pipe',
          },
        );
      } catch (error) {
        errorText = getExecErrorText(error);
      }

      expect(errorText).toMatch(/Original failure:[\s\S]*Rollback failure:/);
      expect((errorText.match(/Original failure:/g) || [])).toHaveLength(1);
      expect((errorText.match(/Rollback failure:/g) || [])).toHaveLength(1);
    } finally {
      chmodSync(parentProjectFile, 0o666);
    }
  });

  it('exposes original and rollback failures through structured error data', () => {
    const originalError = new Error('original failure');
    const rollbackError = new Error('rollback failure');

    const combinedError = combineHandoffFailure(originalError, rollbackError);

    expect(combinedError).toBeInstanceOf(HandoffRollbackError);
    expect(combinedError.cause).toBe(rollbackError);
    expect(combinedError.originalError).toBe(originalError);
    expect(combinedError.rollbackError).toBe(rollbackError);
    expect((combinedError.message.match(/Original failure:/g) || [])).toHaveLength(1);
    expect((combinedError.message.match(/Rollback failure:/g) || [])).toHaveLength(1);
  });

  it('prints identical playbook text from the root and command-local guide flags', () => {
    const rootGuide = runCli('--right-way-to-create-subtask-handoff');
    const commandGuide = runCli('handoff create --right-way-to-create-subtask-handoff');

    expect(rootGuide).toBe(commandGuide);
    expect(rootGuide).toContain('Right Way To Create Subtask Handoff');
    expect(rootGuide).toContain('anchor the parent handoff task to completed baseline tasks');
    expect(rootGuide).toContain('do not approve the parent handoff task until the child closeout gate is complete');
  });
});
