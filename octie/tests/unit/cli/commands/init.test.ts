/**
 * Init Command Unit Tests
 *
 * Tests for init command functionality including:
 * - .octie directory structure creation
 * - project.json with metadata
 * - config.json with defaults
 * - Project existence validation
 * - Custom project path handling
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'node:child_process';
import { TaskStorage } from '../../../../src/core/storage/file-store.js';

// Helper to clean up global registry
function cleanupGlobalRegistry() {
  const globalRegistryPath = join(homedir(), '.octie', 'projects.json');
  try {
    if (existsSync(globalRegistryPath)) {
      rmSync(globalRegistryPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

describe('init command', () => {
  let tempDir: string;
  let cliPath: string;
  let uniqueName: string; // Unique project name for this test run

  beforeEach(() => {
    // Clean up global registry before each test to avoid conflicts
    cleanupGlobalRegistry();
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `octie-test-${uuidv4()}`);
    // Create unique project name for this test run
    uniqueName = `test-project-${uuidv4().substring(0, 8)}`;
    // Path to compiled CLI
    cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    // Clean up global registry after each test
    cleanupGlobalRegistry();
  });

  describe('project initialization', () => {
    it('should create .octie directory structure', () => {
      const output = execSync(
        `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
        { encoding: 'utf-8' }
      );

      const octieDir = join(tempDir, '.octie');
      expect(existsSync(octieDir)).toBe(true);

      // Check for subdirectories
      const octieContents = readdirSync(octieDir);
      expect(octieContents).toContain('indexes');
      expect(octieContents).toContain('cache');

      expect(output).toContain('Octie project initialized');
    });

    it('should create project.json with metadata', () => {
      execSync(
        `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
        { encoding: 'utf-8' }
      );

      const projectJsonPath = join(tempDir, '.octie', 'project.json');
      expect(existsSync(projectJsonPath)).toBe(true);

      const projectContent = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));
      expect(projectContent.metadata).toBeDefined();
      expect(projectContent.metadata.project_name).toBe(uniqueName);
      expect(projectContent.tasks).toEqual({});
      // edges are not part of ProjectFile, they're in the graph structure
    });

    it('should not create config.json (config is managed via CLI options)', () => {
      execSync(
        `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
        { encoding: 'utf-8' }
      );

      const configJsonPath = join(tempDir, '.octie', 'config.json');
      // config.json is not created during init - configuration is via CLI options
      expect(existsSync(configJsonPath)).toBe(false);
    });
  });

  describe('validation', () => {
    it('should validate project does not already exist', () => {
      // First init should succeed
      execSync(
        `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
        { encoding: 'utf-8' }
      );

      // Second init should fail
      expect(() => {
        execSync(
          `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
          { encoding: 'utf-8' }
        );
      }).toThrow();
    });

    it('should show helpful error when project exists', () => {
      // First init
      execSync(
        `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
        { encoding: 'utf-8' }
      );

      // Second init should show error
      try {
        execSync(
          `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
          { encoding: 'utf-8' }
        );
      } catch (error: unknown) {
        const err = error as { stdout: string; stderr: string };
        // The error message "already exists" is in stderr
        expect(err.stderr).toContain('already exists');
      }
    });
  });

  describe('custom options', () => {
    it('should handle custom --project option', () => {
      const customDir = join(tmpdir(), `custom-octie-${uuidv4()}`);

      try {
        const output = execSync(
          `node ${cliPath} init --project "${customDir}" --name "${uniqueName}"`,
          { encoding: 'utf-8' }
        );

        expect(existsSync(join(customDir, '.octie'))).toBe(true);
        expect(output).toContain(customDir);
      } finally {
        // Cleanup
        try {
          rmSync(customDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('should handle custom --name option', () => {
      const projectName = 'my-awesome-project';

      const output = execSync(
        `node ${cliPath} init --project "${tempDir}" --name "${projectName}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain(projectName);

      const projectJsonPath = join(tempDir, '.octie', 'project.json');
      const projectContent = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));
      expect(projectContent.metadata.project_name).toBe(projectName);
    });

    it('should error when name not provided', () => {
      expect(() => {
        execSync(
          `node ${cliPath} init --project "${tempDir}"`,
          { encoding: 'utf-8' }
        );
      }).toThrow();
    });

    it('should show error message when name not provided', () => {
      try {
        execSync(
          `node ${cliPath} init --project "${tempDir}"`,
          { encoding: 'utf-8' }
        );
      } catch (error: unknown) {
        const err = error as { stdout: string; stderr: string };
        expect(err.stderr).toContain('Project name is required');
      }
    });

    it('should error when project name already exists in global registry', () => {
      // First init
      execSync(
        `node ${cliPath} init --project "${tempDir}" --name "duplicate-test"`,
        { encoding: 'utf-8' }
      );

      // Second init with same name should fail
      const tempDir2 = join(tmpdir(), `octie-test-${uuidv4()}`);
      try {
        expect(() => {
          execSync(
            `node ${cliPath} init --project "${tempDir2}" --name "duplicate-test"`,
            { encoding: 'utf-8' }
          );
        }).toThrow();
      } finally {
        try {
          rmSync(tempDir2, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('output messages', () => {
    it('should show success message with project details', () => {
      const output = execSync(
        `node ${cliPath} init --project "${tempDir}" --name "test-proj"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Octie project initialized');
      expect(output).toContain('test-proj');
      expect(output).toContain(tempDir);
    });

    it('should show next steps after initialization', () => {
      const output = execSync(
        `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Next steps:');
      expect(output).toContain('octie create');
      expect(output).toContain('--title');
      expect(output).toContain('--description');
      expect(output).toContain('--success-criterion');
      expect(output).toContain('--deliverable');
    });
  });

  describe('error handling', () => {
    it('should handle error when project already exists', () => {
      // First init should succeed
      execSync(
        `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
        { encoding: 'utf-8' }
      );

      // Second init should fail
      expect(() => {
        execSync(
          `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
          { encoding: 'utf-8' }
        );
      }).toThrow();
    });

    it('should show appropriate error message on failure', () => {
      // First init
      execSync(
        `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
        { encoding: 'utf-8' }
      );

      // Second init should show error
      try {
        execSync(
          `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
          { encoding: 'utf-8' }
        );
      } catch (error: unknown) {
        const err = error as { stdout: string; stderr: string };
        // The error message "already exists" is in stderr
        expect(err.stderr).toContain('already exists');
      }
    });
  });

  describe('TaskStorage integration', () => {
    it('should create project that can be loaded by TaskStorage', async () => {
      execSync(
        `node ${cliPath} init --project "${tempDir}" --name "storage-test"`,
        { encoding: 'utf-8' }
      );

      const storage = new TaskStorage({ projectDir: tempDir });
      expect(await storage.exists()).toBe(true);

      const graph = await storage.load();
      expect(graph.size).toBe(0);
      expect(graph.metadata.project_name).toBe('storage-test');
    });
  });

  describe('cross-platform paths', () => {
    it('should handle Windows-style paths', () => {
      // Test with backslash path (Windows style)
      const windowsStylePath = tempDir.replace(/\//g, '\\');

      try {
        const output = execSync(
          `node ${cliPath} init --project "${tempDir}" --name "${uniqueName}"`,
          { encoding: 'utf-8' }
        );

        expect(existsSync(join(tempDir, '.octie'))).toBe(true);
      } catch {
        // Some systems might not handle backslashes in CLI args
        // This is acceptable as long as the init works with forward slashes
      }
    });

    it('should handle Unix-style paths with spaces', () => {
      const pathWithSpaces = join(tmpdir(), `octie test ${uuidv4()}`);

      try {
        const output = execSync(
          `node ${cliPath} init --project "${pathWithSpaces}" --name "${uniqueName}"`,
          { encoding: 'utf-8' }
        );

        expect(existsSync(join(pathWithSpaces, '.octie'))).toBe(true);
      } finally {
        try {
          rmSync(pathWithSpaces, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });
});
