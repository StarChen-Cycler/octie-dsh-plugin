/**
 * Root Guard - Auto-registration hook for Octie CLI
 *
 * Runs before every command to verify and register the current project
 * in the global registry if it contains a valid .octie/project.json file.
 *
 * @module core/registry/root-guard
 */
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
export declare function extractProjectPathFromArgs(args: string[], basePath?: string): string | undefined;
/**
 * Verify and register the current project if valid
 *
 * This function should be called at the start of every CLI command
 * to ensure the current project is tracked in the global registry.
 *
 * @param projectPath - Optional explicit project path (uses cwd if not provided)
 * @returns True if project was registered/verified, false if not a valid project
 */
export declare function verifyAndRegisterProject(projectPath?: string): boolean;
//# sourceMappingURL=root-guard.d.ts.map