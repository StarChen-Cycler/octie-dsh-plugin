/**
 * Update command - Update an existing task
 */

import { Command, Option } from 'commander';
import { getProjectPath, loadGraph, saveGraph, success, error, info, parseMultipleIds } from '../utils/helpers.js';
import chalk from 'chalk';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TaskNode } from '../../core/models/task-node.js';
import { wouldCreateCycle } from '../../core/graph/algorithms.js';
import { normalizeGitBashPath } from './shared-helpers.js';

/**
 * Resolve a short UUID to a full criterion ID within a task
 * @param task - The task containing success criteria
 * @param idOrPrefix - Full UUID or short prefix
 * @returns Full UUID if found, or throws error
 */
function resolveCriterionId(task: TaskNode, idOrPrefix: string): string {
  // First try exact match
  const exactMatch = task.success_criteria.find(c => c.id === idOrPrefix);
  if (exactMatch) return exactMatch.id;

  // Try prefix match (case-insensitive)
  const lowerPrefix = idOrPrefix.toLowerCase();
  const matches = task.success_criteria.filter(c =>
    c.id.toLowerCase().startsWith(lowerPrefix)
  );

  if (matches.length === 0) {
    throw new Error(`Success criterion with ID '${idOrPrefix}' not found.`);
  }

  if (matches.length > 1) {
    const matchIds = matches.map(c => c.id.substring(0, 8)).join(', ');
    throw new Error(`Ambiguous criterion ID '${idOrPrefix}'. Matches: ${matchIds}`);
  }

  return matches[0]!.id;
}

/**
 * Resolve a short UUID to a full deliverable ID within a task
 * @param task - The task containing deliverables
 * @param idOrPrefix - Full UUID or short prefix
 * @returns Full UUID if found, or throws error
 */
function resolveDeliverableId(task: TaskNode, idOrPrefix: string): string {
  // First try exact match
  const exactMatch = task.deliverables.find(d => d.id === idOrPrefix);
  if (exactMatch) return exactMatch.id;

  // Try prefix match (case-insensitive)
  const lowerPrefix = idOrPrefix.toLowerCase();
  const matches = task.deliverables.filter(d =>
    d.id.toLowerCase().startsWith(lowerPrefix)
  );

  if (matches.length === 0) {
    throw new Error(`Deliverable with ID '${idOrPrefix}' not found.`);
  }

  if (matches.length > 1) {
    const matchIds = matches.map(d => d.id.substring(0, 8)).join(', ');
    throw new Error(`Ambiguous deliverable ID '${idOrPrefix}'. Matches: ${matchIds}`);
  }

  return matches[0]!.id;
}

/**
 * Resolve a short UUID to a full need_fix ID within a task
 * @param task - The task containing need_fix items
 * @param idOrPrefix - Full UUID or short prefix
 * @returns Full UUID if found, or throws error
 */
function resolveNeedFixId(task: TaskNode, idOrPrefix: string): string {
  // First try exact match
  const exactMatch = task.need_fix.find(f => f.id === idOrPrefix);
  if (exactMatch) return exactMatch.id;

  // Try prefix match (case-insensitive)
  const lowerPrefix = idOrPrefix.toLowerCase();
  const matches = task.need_fix.filter(f =>
    f.id.toLowerCase().startsWith(lowerPrefix)
  );

  if (matches.length === 0) {
    throw new Error(`Need_fix item with ID '${idOrPrefix}' not found.`);
  }

  if (matches.length > 1) {
    const matchIds = matches.map(f => f.id.substring(0, 8)).join(', ');
    throw new Error(`Ambiguous need_fix ID '${idOrPrefix}'. Matches: ${matchIds}`);
  }

  return matches[0]!.id;
}

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
  .option('--remove-criterion <id>', 'Remove a success criterion by ID (NOTE: cannot remove completed items)')
  .option('--blockers <ids>', 'Add blocker(s) (requires --dependencies)')
  .option('--unblock <id>', 'Remove a blocker (removes graph edge)')
  .option('--dependencies <text>', 'Set/update dependencies explanation (required with --blockers)')
  .addOption(
    new Option('--dependency-explanation <text>')
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
      const graph = await loadGraph(projectPath);

      const task = graph.getNodeByIdOrPrefix(id);
      if (!task) {
        error(`Task not found: ${id}`);
        process.exit(1);
      }

      let updated = false;

      // Update priority
      if (options.priority) {
        task.setPriority(options.priority);
        updated = true;
      }

      // Add deliverable(s) - supports multiple values
      const deliverables = options.addDeliverable || [];
      for (const text of deliverables) {
        task.addDeliverable({
          id: randomUUID(),
          text: text,
          completed: false,
        });
        updated = true;
      }

      // Complete deliverable(s) - now supports multiple IDs with short UUID support
      if (options.completeDeliverable && options.completeDeliverable.length > 0) {
        for (const deliverableIdOrPrefix of options.completeDeliverable) {
          const fullId = resolveDeliverableId(task, deliverableIdOrPrefix);
          task.completeDeliverable(fullId);
        }
        updated = true;
      }

      // Remove deliverable (supports short UUID)
      if (options.removeDeliverable) {
        const fullId = resolveDeliverableId(task, options.removeDeliverable);
        task.removeDeliverable(fullId);
        updated = true;
      }

      // Add success criterion(s) - supports multiple values
      const successCriteria = options.addSuccessCriterion || [];
      for (const text of successCriteria) {
        task.addSuccessCriterion({
          id: randomUUID(),
          text: text,
          completed: false,
        });
        updated = true;
      }

      // Complete criterion/criteria - now supports multiple IDs with short UUID support
      if (options.completeCriterion && options.completeCriterion.length > 0) {
        for (const criterionIdOrPrefix of options.completeCriterion) {
          const fullId = resolveCriterionId(task, criterionIdOrPrefix);
          task.completeCriterion(fullId);
        }
        updated = true;
      }

      // Remove criterion (supports short UUID)
      if (options.removeCriterion) {
        const fullId = resolveCriterionId(task, options.removeCriterion);
        task.removeSuccessCriterion(fullId);
        updated = true;
      }

      // Add need_fix item(s) (blocking issue) - supports multiple values
      const needFixItems = options.addNeedFix || [];
      if (needFixItems.length > 0) {
        const source = options.needFixSource || 'review';
        if (!['review', 'runtime', 'regression'].includes(source)) {
          error(`Invalid --need-fix-source: '${source}'. Must be one of: review, runtime, regression`);
          process.exit(1);
        }
        for (const text of needFixItems) {
          task.addNeedFix(text, {
            file_path: options.needFixFile,
            source: source as 'review' | 'runtime' | 'regression',
          });
        }
        updated = true;
      }

      // Complete need_fix item (supports short UUID)
      if (options.completeNeedFix) {
        const fullId = resolveNeedFixId(task, options.completeNeedFix);
        task.completeNeedFix(fullId);
        updated = true;
      }

      const dependenciesText = options.dependencies ?? options.dependencyExplanation;

      // Add blocker (twin validation: requires --dependencies)
      const blockerId = options.blockers;
      if (blockerId) {
        if (!dependenciesText) {
          error('When using --blockers, --dependencies is required (twin feature).');
          info(`Current dependencies: "${task.dependencies || '(none)'}"`);
          info('Example: --blockers abc123 --dependencies "Needs API spec from abc123"');
          process.exit(1);
        }
        // Resolve short UUID to full UUID
        const blockerTask = graph.getNodeByIdOrPrefix(blockerId);
        if (!blockerTask) {
          error(`Task with ID '${blockerId}' not found`);
          process.exit(1);
        }
        // Check for self-blocking
        if (blockerTask.id === task.id) {
          error('A task cannot block itself.');
          process.exit(1);
        }
        // Check if adding this blocker would create a cycle
        if (wouldCreateCycle(graph, blockerTask.id, task.id)) {
          error(`Adding blocker '${blockerTask.id.substring(0, 8)}' would create a cycle.`);
          info('Cycles are not allowed in the task graph. Use "octie graph cycles" to see existing cycles.');
          process.exit(1);
        }
        task.addBlocker(blockerTask.id);
        graph.addEdge(blockerTask.id, task.id);
        // Update dependencies explanation (append to existing)
        const existingDeps = task.dependencies || '';
        task.setDependencies(existingDeps ? `${existingDeps}\n${dependenciesText}` : dependenciesText);
        updated = true;
      }

      // Remove blocker
      if (options.unblock) {
        // Resolve short UUID to full UUID
        const unblockTask = graph.getNodeByIdOrPrefix(options.unblock);
        if (!unblockTask) {
          error(`Task with ID '${options.unblock}' not found`);
          process.exit(1);
        }
        task.removeBlocker(unblockTask.id);
        graph.removeEdge(unblockTask.id, task.id);
        // If no more blockers, clear dependencies automatically
        if (task.blockers.length === 0) {
          task.clearDependencies();
          info('No more blockers - dependencies explanation cleared automatically.');
        }
        updated = true;
      }

      // Set/update dependencies explanation
      if (dependenciesText && !options.blockers) {
        // Standalone dependency explanation update (must have blockers)
        if (task.blockers.length === 0) {
          error('Cannot set dependencies explanation without blockers.');
          info('Use --blockers to add a blocker first, or provide both --blockers and --dependencies together.');
          process.exit(1);
        }
        task.setDependencies(dependenciesText);
        updated = true;
      }

      // Clear dependencies (for explicit clearing when last blocker removed)
      if (options.clearDependencies) {
        task.clearDependencies();
        updated = true;
      }

      // Add related file(s) - supports multiple values
      const relatedFiles = options.addRelatedFile || [];
      for (const file of relatedFiles) {
        task.addRelatedFile(file);
        updated = true;
      }

      // Remove related file
      if (options.removeRelatedFile) {
        task.removeRelatedFile(options.removeRelatedFile);
        updated = true;
      }

      // Add C7 verification(s) - supports multiple values
      const c7Entries = options.verifyC7 || [];
      for (const entry of c7Entries) {
        const cleanEntry = normalizeGitBashPath(entry);

        // Now parse the library-id:notes format
        const colonIndex = cleanEntry.indexOf(':');
        if (colonIndex === -1) {
          task.addC7Verification({
            library_id: cleanEntry.trim(),
            verified_at: new Date().toISOString(),
          });
        } else {
          task.addC7Verification({
            library_id: cleanEntry.substring(0, colonIndex).trim(),
            verified_at: new Date().toISOString(),
            notes: cleanEntry.substring(colonIndex + 1).trim(),
          });
        }
        updated = true;
      }

      // Remove C7 verification
      if (options.removeC7Verified) {
        const libraryId = normalizeGitBashPath(options.removeC7Verified as string);
        task.removeC7Verification(libraryId);
        updated = true;
      }

      // Append notes (supports multiple --notes flags)
      if (options.notes && options.notes.length > 0) {
        for (const note of options.notes) {
          task.appendNotes(note);
        }
        updated = true;
      }

      // Append notes from file
      if (options.notesFile) {
        const notesPath = resolve(options.notesFile);
        if (!existsSync(notesPath)) {
          error(`Notes file not found: ${notesPath}`);
          process.exit(1);
        }
        try {
          const fileContent = readFileSync(notesPath, 'utf-8').trim();
          task.appendNotes(fileContent);
          updated = true;
        } catch (err) {
          error(`Failed to read notes file: ${err instanceof Error ? err.message : 'Unknown error'}`);
          process.exit(1);
        }
      }

      if (!updated) {
        error('No updates specified');
        process.exit(1);
      }

      // Update in graph
      graph.updateNode(task);

      // Propagate status changes through the graph starting from this task
      // This handles blocker changes and their effects on dependent tasks
      const propagateResult = graph.propagateStatus(task.id);

      // Save
      await saveGraph(projectPath, graph);

      success(`Task updated: ${chalk.cyan(id)}`);

      // Report if any dependent tasks were affected by propagation
      if (propagateResult.updatedTasks.length > 0) {
        info(chalk.cyan(`  Propagated to ${propagateResult.updatedTasks.length} dependent task(s)`));
      }

      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to update task');
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
  console.log(chalk.yellow('  Example:'));
  console.log('    octie update abc --add-need-fix "Null pointer in edge case" \\');
  console.log('      --need-fix-source review --need-fix-file "src/auth.ts"');
  console.log('');
  console.log(chalk.bold('Blockers & Dependencies (Twin Feature):'));
  console.log(chalk.cyan('  --blockers <id>') + ': Add a blocker (creates graph edge).');
  console.log('                   REQUIRES --dependencies (twin validation).');
  console.log('                   Prevents self-blocking and cycle creation.');
  console.log('');
  console.log(chalk.cyan('  --unblock <id>') + ': Remove a blocker (removes graph edge).');
  console.log('                  If last blocker removed, dependencies auto-cleared.');
  console.log('');
  console.log(chalk.cyan('  --dependencies <text>') + ': Set/update dependencies explanation.');
  console.log('                             Required with --blockers.');
  console.log('                             Legacy alias: --dependency-explanation');
  console.log('');
  console.log(chalk.cyan('  --clear-dependencies') + ': Explicitly clear dependencies explanation.');
  console.log('');
  console.log(chalk.yellow('  Examples:'));
  console.log('    Add blocker with explanation:');
  console.log('      octie update abc --blockers xyz --dependencies "Needs xyz output"');
  console.log('');
  console.log('    Update existing dependencies text:');
  console.log('      octie update abc --dependencies "Updated reason"');
  console.log('');
  console.log('    Remove blocker (auto-clears if last one):');
  console.log('      octie update abc --unblock xyz');
  console.log('');
  console.log(chalk.red('  Error Conditions:'));
  console.log('    --blockers without --dependencies → Error');
  console.log('    Self-blocking (task blocks itself) → Error');
  console.log('    Would create cycle → Error');
  console.log('    Cannot uncomplete/remove completed items → Error');
  console.log('');
  console.log(chalk.bold('Short UUID Support:'));
  console.log('  All ID parameters support short UUIDs (first 7-8 characters).');
  console.log('  Example: octie update abc1234 --complete-criterion xyz5678');
});
