/**
 * Registry command - maintain the global project registry.
 */
import { Command } from 'commander';
import { pruneStaleProjects } from '../../core/registry/index.js';
import { success, info, error } from '../utils/helpers.js';
import chalk from 'chalk';
export const registryCommand = new Command('registry')
    .description('Inspect and maintain the global project registry');
registryCommand
    .command('prune')
    .description('Remove registry entries whose project paths no longer exist')
    .addHelpText('after', `
Behavior:
  • Scans ~/.octie/projects.json for entries whose path is gone
  • Removes them and persists the registry only when something was removed
  • Real projects (existing paths) are never touched

Examples:
  $ octie registry prune
  ✓ Pruned 407 stale entrie(s)
    test-project#90 -> C:\\Users\\...\\Temp\\octie-test-...
  Registry now has 44 project(s)
`)
    .action(async () => {
    try {
        const result = pruneStaleProjects();
        success(`Pruned ${result.removed.length} stale entrie(s)`);
        for (const entry of result.removed) {
            info(`${chalk.cyan(entry.key)} -> ${entry.path}`);
        }
        info(`Registry now has ${result.kept} project(s)`);
        process.exit(0);
    }
    catch (err) {
        if (err instanceof Error) {
            error(err.message);
        }
        else {
            error('Failed to prune registry');
        }
        process.exit(1);
    }
});
//# sourceMappingURL=registry.js.map