/**
 * Root Guard - Auto-registration hook for Octie CLI
 *
 * Runs before every command to verify and register the current project
 * in the global registry if it contains a valid .octie/project.json file.
 *
 * @module core/registry/root-guard
 */
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { isValidOctieProject, registerProject } from './index.js';
/**
 * Extract explicit project path from raw CLI args before Commander parses them.
 * Supports:
 * - `--project path/to/project`
 * - `--project=path/to/project`
 *
 * @param args - Raw CLI args, usually process.argv.slice(2)
 * @param basePath - Base path used to resolve relative project paths
 * @returns Resolved explicit project path, or undefined when not provided
 */
export function extractProjectPathFromArgs(args, basePath = cwd()) {
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (!arg) {
            continue;
        }
        if (arg === '--project') {
            const value = args[i + 1];
            if (value && !value.startsWith('-')) {
                return resolve(basePath, value);
            }
            continue;
        }
        if (arg.startsWith('--project=')) {
            const value = arg.substring('--project='.length);
            if (value) {
                return resolve(basePath, value);
            }
        }
    }
    return undefined;
}
/**
 * Verify and register the current project if valid
 *
 * This function should be called at the start of every CLI command
 * to ensure the current project is tracked in the global registry.
 *
 * @param projectPath - Optional explicit project path (uses cwd if not provided)
 * @returns True if project was registered/verified, false if not a valid project
 */
export function verifyAndRegisterProject(projectPath) {
    const path = projectPath || cwd();
    if (!isValidOctieProject(path)) {
        return false;
    }
    const result = registerProject(path);
    return result !== null;
}
//# sourceMappingURL=root-guard.js.map