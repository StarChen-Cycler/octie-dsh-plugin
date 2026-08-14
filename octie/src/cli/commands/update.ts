/**
 * Update command - Update an existing task
 *
 * The engine lives in the service layer (`updateTaskWithPropagation`);
 * this command keeps only UX: option parsing, error branches, output.
 */

import { Command, Option } from 'commander';
import { getProjectPath, success, error, info, parseMultipleIds } from '../utils/helpers.js';
import { CliPreparationError, updateTaskWithPropagation } from '../../service/index.js';
import type { UpdateTaskPatch } from '../../service/types.js';
import chalk from 'chalk';

/**
 * Create the update command
 */
export const updateCommand = new Command('update')
  .description('Update an existing task')
  .argument('<id>', 'Task ID to update (full UUID or first 7-8 characters)')
  .addOption(
    new Option('--priority <priority>', 'Task priority')
      .choices(['top', 'second', 'later'])
  )
  .addOption(
    new Option(
      '--add-deliverable <text>',
      'Add a deliverable (can be specified multiple times)'
    )
      .argParser((value: string, previous: string[]) => [...(previous || []), value])
  )
  .option('--complete-deliverable <id>', 'Mark deliverable(s) as complete (supports: id, short-uuid, id1,id2, "id1","id2")', parseMultipleIds, [])
  .option('--remove-deliverable <id>', 'Remove a deliverable by ID (NOTE: cannot remove completed items)')
  .addOption(
    new Option(
      '--add-success-criterion <text>',
      'Add a success criterion (can be specified multiple times)'
    )
      .argParser((value: string, previous: string[]) => [...(previous || []), value])
  )
  .option('--complete-criterion <id>', 'Mark success criterion(s) as complete (supports: id, short-uuid, id1,id2, "id1","id2")', parseMultipleIds, [])
  .option('--evidence <text>', 'Evidence recorded for the criterion/criteria completed via --complete-criterion in this call (optional)')
  .option('--remove-criterion <id>', 'Remove a success criterion by ID (NOTE: cannot remove completed items)')
  .option('--blockers <id>', 'Add one blocker per call (requires --dependency-explanation; repeat the command for each additional blocker)', parseMultipleIds, [])
  .option('--unblock <id>', 'Remove a blocker (removes graph edge)')
  .option('--dependency-explanation <text>', 'Set/update dependencies explanation (required with --blockers)')
  .addOption(
    new Option('--dependencies <text>')
      .hideHelp()
  )
  .option('--clear-dependencies', 'Clear dependencies explanation (for removing last blocker)')
  .addOption(
    new Option(
      '--add-related-file <path>',
      'Add a related file path (can be specified multiple times)'
    )
      .argParser((value: string, previous: string[]) => [...(previous || []), value])
  )
  .option('--remove-related-file <path>', 'Remove a related file path')
  .addOption(
    new Option(
      '--verify-c7 <library:notes>',
      'Add C7 library verification (can be specified multiple times, format: library-id or library-id:notes)'
    )
      .argParser((value: string, previous: string[]) => [...(previous || []), value])
  )
  .option('--remove-c7-verified <library>', 'Remove a C7 verification by library ID')
  .addOption(
    new Option(
      '--add-need-fix <text>',
      'Add a need_fix item (blocking issue, can be specified multiple times). Use --need-fix-source to specify source.'
    )
      .argParser((value: string, previous: string[]) => [...(previous || []), value])
  )
  .addOption(
    new Option('--need-fix-source <source>', 'Source of need_fix')
      .choices(['review', 'runtime', 'regression'])
      .default('review')
  )
  .option('--need-fix-file <path>', 'Optional file path for need_fix item')
  .option('--complete-need-fix <id>', 'Mark need_fix item as resolved (supports short UUID)')
  .addOption(
    new Option(
      '--notes <text>',
      'Append to notes (can be specified multiple times)'
    )
      .argParser((value: string, previous: string[]) => [...(previous || []), value])
      .default([])
  )
  .option('--notes-file <path>', 'Read notes from file and append (multi-line notes support)')
  .action(async (id, options, command) => {
    try {
      // Get global options
      const globalOpts = command.parent?.opts() || {};
      const projectPath = await getProjectPath(globalOpts.project);

      // Multi-blocker guard (CLI parsing rule, mirrors previous behavior)
      const blockerIds: string[] = options.blockers || [];
      if (blockerIds.length > 1) {
        error('--blockers accepts one task ID per call. Add blockers one at a time, each with its own --dependency-explanation.');
        info(`Received ${blockerIds.length} IDs: ${blockerIds.join(', ')}`);
        info('Example: octie update abc123 --blockers def456 --dependency-explanation "Needs the API spec from def456"');
        process.exit(1);
      }

      const dependenciesText: string | undefined = options.dependencyExplanation ?? options.dependencies;
      const patch: UpdateTaskPatch = {
        priority: options.priority,
        addDeliverables: options.addDeliverable,
        completeDeliverables: options.completeDeliverable,
        removeDeliverables: options.removeDeliverable ? [options.removeDeliverable] : undefined,
        addSuccessCriteria: options.addSuccessCriterion,
        completeCriteria: options.completeCriterion,
        removeCriteria: options.removeCriterion ? [options.removeCriterion] : undefined,
        evidence: options.evidence,
        addNeedFix: (options.addNeedFix || []).map((text: string) => ({
          text,
          source: options.needFixSource,
          file: options.needFixFile,
        })),
        completeNeedFix: options.completeNeedFix ? [options.completeNeedFix] : undefined,
        blockers: blockerIds.length === 1
          ? { id: blockerIds[0]!, explanation: dependenciesText ?? '' }
          : undefined,
        unblock: options.unblock,
        clearDependencies: options.clearDependencies,
        dependencies: blockerIds.length === 1 ? undefined : dependenciesText,
        addRelatedFiles: options.addRelatedFile,
        removeRelatedFiles: options.removeRelatedFile ? [options.removeRelatedFile] : undefined,
        c7Verified: options.verifyC7,
        removeC7Verified: options.removeC7Verified ? [options.removeC7Verified] : undefined,
        notes: options.notes,
        notesFile: options.notesFile,
      };

      const { propagatedCount, infoMessages } = await updateTaskWithPropagation(projectPath, id, patch);

      // Success-path info lines (e.g. unblock auto-cleared dependencies)
      for (const message of infoMessages) {
        info(message);
      }

      success(`Task updated: ${chalk.cyan(id)}`);

      // Report if any dependent tasks were affected by propagation
      if (propagatedCount > 0) {
        info(chalk.cyan(`  Propagated to ${propagatedCount} dependent task(s)`));
      }

      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to update task');
      }
      if (err instanceof CliPreparationError) {
        for (const message of err.infoMessages) {
          info(message);
        }
      }
      process.exit(1);
    }
  });

// Add help text to explain blockers vs dependencies
updateCommand.on('--help', () => {
  console.log('');
  console.log(chalk.bold('Status System:'));
  console.log('  Status is AUTOMATICALLY calculated from task state.');
  console.log('  Use \'octie approve <id>\' to transition from in_review to completed.');
  console.log('');
  console.log(chalk.cyan('  Automatic Transitions:'));
  console.log('    • Any item checked → in_progress');
  console.log('    • All items complete → in_review');
  console.log('    • Blocker added → blocked');
  console.log('    • All blockers completed → in_progress (if items checked) or ready (if not)');
  console.log('');
  console.log(chalk.cyan('  Manual Transition (via \'octie approve\' command only):'));
  console.log('    • in_review → completed');
  console.log('');
  console.log(chalk.bold('Need Fix Items (Blocking Issues):'));
  console.log(chalk.cyan('  --add-need-fix <text>') + ': Add a blocking issue found during work.');
  console.log('    Sources: review (code review), runtime (testing), regression (after completion).');
  console.log('    Status automatically changes to in_progress when need_fix is added.');
  console.log('');
  console.log(chalk.cyan('  --complete-need-fix <id>') + ': Mark issue as resolved.');
  console.log('    Supports short UUID (first 7-8 chars).');
  console.log('');
  console.log(chalk.bold('Criterion Evidence (Optional):'));
  console.log(chalk.cyan('  --evidence <text>') + ': Record evidence when completing success criteria.');
  console.log('    Requires --complete-criterion in the same command.');
  console.log('    Applies to all criteria completed in that call (use separate calls for per-criterion evidence).');
  console.log('');
  console.log(chalk.yellow('  Example:'));
  console.log('    octie update abc --complete-criterion def456 --evidence "0.86 ms median, n=810"');
  console.log('');
  console.log(chalk.yellow('  Example:'));
  console.log('    octie update abc --add-need-fix "Null pointer in edge case" \\');
  console.log('      --need-fix-source review --need-fix-file "src/auth.ts"');
  console.log('');
  console.log(chalk.bold('Blockers & Dependencies (Twin Feature):'));
  console.log(chalk.cyan('  --blockers <id>') + ': Add a blocker (creates graph edge).');
  console.log('                   REQUIRES --dependency-explanation (twin validation).');
  console.log('                   ONE blocker per call; repeat the command per blocker');
  console.log('                   so each gets its own explanation.');
  console.log('                   Prevents self-blocking and cycle creation.');
  console.log('');
  console.log(chalk.cyan('  --unblock <id>') + ': Remove a blocker (removes graph edge).');
  console.log('                  If last blocker removed, dependencies auto-cleared.');
  console.log('');
  console.log(chalk.cyan('  --dependency-explanation <text>') + ': Set/update dependencies explanation.');
  console.log('                             Required with --blockers.');
  console.log('                             Alias: --dependencies');
  console.log('');
  console.log(chalk.cyan('  --clear-dependencies') + ': Explicitly clear dependencies explanation.');
  console.log('');
  console.log(chalk.yellow('  Examples:'));
  console.log('    Add blocker with explanation:');
  console.log('      octie update abc --blockers xyz --dependency-explanation "Needs xyz output"');
  console.log('');
  console.log('    Update existing dependencies text:');
  console.log('      octie update abc --dependency-explanation "Updated reason"');
  console.log('');
  console.log('    Remove blocker (auto-clears if last one):');
  console.log('      octie update abc --unblock xyz');
  console.log('');
  console.log(chalk.red('  Error Conditions:'));
  console.log('    --blockers without --dependency-explanation → Error');
  console.log('    Multiple --blockers IDs in one call (comma form or repeated flags) → Error');
  console.log('    Self-blocking (task blocks itself) → Error');
  console.log('    Would create cycle → Error');
  console.log('    Cannot uncomplete/remove completed items → Error');
  console.log('');
  console.log(chalk.bold('Short UUID Support:'));
  console.log('  All ID parameters support short UUIDs (first 7-8 characters).');
  console.log('  Example: octie update abc1234 --complete-criterion xyz5678');
});
