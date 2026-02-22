/**
 * Create command - Create a new task with atomic task validation
 */

import { Command, Option } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { TaskNode } from '../../core/models/task-node.js';
import { getProjectPath, loadGraph, saveGraph, success, error, info, parseList } from '../utils/helpers.js';
import { AtomicTaskViolationError } from '../../types/index.js';
import { touchProject } from '../../core/registry/index.js';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Display atomic task policy help
 */
function displayAtomicTaskPolicy(): void {
  console.log('');
  console.log(chalk.red.bold('⚠️  ATOMIC TASK POLICY ⚠️'));
  console.log('');
  console.log(chalk.yellow('Tasks MUST be atomic - small, specific, executable, and verifiable.'));
  console.log('');
  console.log(chalk.bold('What is an Atomic Task?'));
  console.log('  • Single purpose: Does ONE thing well');
  console.log('  • Executable: Can be completed in 2-8 hours (typical) or 1-2 days (max)');
  console.log('  • Verifiable: Has quantitative success criteria');
  console.log('  • Independent: Minimizes dependencies on other tasks');
  console.log('');
  console.log(chalk.red.bold('❌ BAD Examples (too vague or too large):'));
  console.log(chalk.gray('  • "Fix authentication" (too vague - what specifically?)'));
  console.log(chalk.gray('  • "Build auth system" (too large - split into: login, signup, password reset, etc.)'));
  console.log(chalk.gray('  • "Improve performance" (not measurable - what metric?)'));
  console.log(chalk.gray('  • "Code review" (not atomic - which files? what criteria?)'));
  console.log('');
  console.log(chalk.green.bold('✅ GOOD Examples (atomic):'));
  console.log(chalk.gray('  • "Implement login endpoint with JWT" (specific, testable)'));
  console.log(chalk.gray('  • "Add bcrypt password hashing with 10 rounds" (clear, verifiable)'));
  console.log(chalk.gray('  • "Write unit tests for User model" (specific scope)'));
  console.log(chalk.gray('  • "Fix NPE in AuthService.login method" (atomic bug fix)'));
  console.log('');
  console.log(chalk.bold('Validation Rules:'));
  console.log('  • Title: 1-200 chars, must contain action verb');
  console.log('  • Description: 50-10000 chars, must be specific');
  console.log('  • Success Criteria: 1-10 items, must be quantitative');
  console.log('  • Deliverables: 1-5 items, must be specific outputs');
  console.log('');
  console.log(chalk.yellow('If your task is rejected as non-atomic:'));
  console.log('  → Split it into smaller, focused tasks');
  console.log('  → Be more specific about what will be done');
  console.log('  → Define measurable success criteria');
  console.log('  → Limit scope to 2-8 hours of work');
  console.log('');
}

/**
 * Create the create command
 */
export const createCommand = new Command('create')
  .description('Create a new atomic task in the project')
  .addOption(
    new Option('--title <string>', 'Task title (max 200 chars). Must contain action verb')
      .env('OCTIE_TASK_TITLE')
      .makeOptionMandatory(true)
  )
  .addOption(
    new Option(
      '--description <string>',
      'Detailed task description (min 50 chars, max 10000)'
    )
      .env('OCTIE_TASK_DESCRIPTION')
      .makeOptionMandatory(true)
  )
  .addOption(
    new Option(
      '--success-criterion <text>',
      'Quantitative success criterion (can be specified multiple times)'
    )
      .argParser((value: string, previous: string[]) => [...(previous || []), value])
      .env('OCTIE_SUCCESS_CRITERION')
      .makeOptionMandatory(true)
  )
  .addOption(
    new Option(
      '--deliverable <text>',
      'Specific output expected (can be specified multiple times)'
    )
      .argParser((value: string, previous: string[]) => [...(previous || []), value])
      .env('OCTIE_DELIVERABLE')
      .makeOptionMandatory(true)
  )
  .option('-p, --priority <level>', 'Task priority: top | second | later', 'second')
  .option('-b, --blockers <ids>', 'Comma-separated task IDs that block this task (creates graph edges for execution order)')
  .option('-d, --dependencies <text>', 'Explanatory text: WHY this task depends on its blockers (required if --blockers is set)')
  .addOption(
    new Option(
      '-f, --related-files <paths>',
      'File paths relevant to task (can be specified multiple times or comma-separated)'
    )
      .argParser((value: string, previous: string[]) => {
        // Support both comma-separated and multiple flag usage
        const items = value.includes(',') ? value.split(',').map(s => s.trim()) : [value.trim()];
        return [...(previous || []), ...items.filter(Boolean)];
      })
  )
  .addOption(
    new Option('-c, --c7-verified <library:notes>', 'C7 library verification (format: library-id or library-id:notes, can be specified multiple times)')
      .argParser((value: string, previous: string[]) => [...(previous || []), value])
  )
  .addOption(
    new Option(
      '-n, --notes <text>',
      'Additional context or comments (can be specified multiple times)'
    )
      .argParser((value: string, previous: string[]) => [...(previous || []), value])
  )
  .option('--notes-file <path>', 'Read notes from file (multi-line notes support)')
  .option('-i, --interactive', 'Interactive mode with prompts')
  .option('--project <path>', 'Path to Octie project directory')
  .action(async (options, command) => {
    try {
      // Display atomic task policy on --help
      if (process.argv.includes('--help') || process.argv.includes('-h')) {
        displayAtomicTaskPolicy();
        return;
      }

      // Get global options (from parent) and merge with local options
      const globalOpts = command.parent?.opts() || {};
      const projectPath = await getProjectPath(options.project || globalOpts.project);
      const graph = await loadGraph(projectPath);

      // Parse multi-value options (argParser returns arrays)
      const successCriteria = options.successCriterion || [];
      const deliverables = options.deliverable || [];

      // Validate priority - must be one of: top, second, later
      const VALID_PRIORITIES = ['top', 'second', 'later'];
      const priority = options.priority?.toLowerCase();
      if (!VALID_PRIORITIES.includes(priority)) {
        console.error(`Error: Invalid priority "${options.priority}". Must be one of: ${VALID_PRIORITIES.join(', ')}`);
        process.exit(1);
      }

      // Parse C7 verifications (format: library-id or library-id:notes)
      const c7Verifications = (options.c7Verified || []).map((entry: string) => {
              // Handle Windows Git Bash path conversion: "/path" becomes "C:/Program Files/Git/path"
              // Detect and strip the Git Bash prefix
              let cleanEntry = entry;
              const gitBashPrefix = /^[A-Za-z]:\/(\/)?Program Files\/Git\//;
              if (gitBashPrefix.test(entry)) {
                // Extract the original Unix path after "Program Files/Git/"
                const match = entry.match(/Program Files\/Git\/(.*)$/);
                if (match) {
                  cleanEntry = '/' + match[1];
                }
              }

              // Now parse the library-id:notes format
              const colonIndex = cleanEntry.indexOf(':');
              if (colonIndex === -1) {
                return {
                  library_id: cleanEntry.trim(),
                  verified_at: new Date().toISOString(),
                };
              }
              return {
                library_id: cleanEntry.substring(0, colonIndex).trim(),
                verified_at: new Date().toISOString(),
                notes: cleanEntry.substring(colonIndex + 1).trim(),
              };
            });

      // Validate required fields
      if (!options.title || options.title.trim().length === 0) {
        error('Title is required and cannot be empty');
        process.exit(1);
      }

      if (!options.description || options.description.trim().length === 0) {
        error('Description is required and cannot be empty');
        process.exit(1);
      }

      if (successCriteria.length === 0) {
        error('At least one success criterion is required (--success-criterion)');
        process.exit(1);
      }

      if (deliverables.length === 0) {
        error('At least one deliverable is required (--deliverable)');
        process.exit(1);
      }

      // Twin validation: blockers and dependencies must be provided together
      const blockers = parseList(options.blockers || '');
      const dependenciesText = (options.dependencies || '').trim();

      if (blockers.length > 0 && !dependenciesText) {
        error('When --blockers is provided, --dependencies explanation text is also required.');
        info('The twin feature requires both blockers (task IDs) and dependencies (explanation).');
        info('Example: --blockers abc123 --dependencies "Needs the API spec from abc123"');
        process.exit(1);
      }

      if (dependenciesText && blockers.length === 0) {
        error('When --dependencies is provided, --blockers task IDs are also required.');
        info('The twin feature requires both blockers (task IDs) and dependencies (explanation).');
        info('Example: --blockers abc123 --dependencies "Needs the API spec from abc123"');
        process.exit(1);
      }

      // Handle notes: support both --notes (multiple) and --notes-file
      let notes: string[] = [];
      if (options.notesFile) {
        // Read notes from file
        const notesPath = resolve(options.notesFile);
        if (!existsSync(notesPath)) {
          error(`Notes file not found: ${notesPath}`);
          process.exit(1);
        }
        try {
          const fileContent = readFileSync(notesPath, 'utf-8').trim();
          if (fileContent) {
            notes.push(fileContent);
          }
        } catch (err) {
          error(`Failed to read notes file: ${err instanceof Error ? err.message : 'Unknown error'}`);
          process.exit(1);
        }
      }
      if (options.notes && Array.isArray(options.notes)) {
        // Append all inline notes after file content
        notes = notes.concat(options.notes.map((n: string) => n.trim()).filter(Boolean));
      }
      const notesText = notes.join('\n\n');

      // Build task data
      // Use graph.generateUniqueId() to ensure first 7 characters are unique
      const taskId = graph.generateUniqueId();
      const taskData = {
        id: taskId,
        title: options.title.trim(),
        description: options.description.trim(),
        // Status is now derived by TaskNode constructor (defaults to 'ready' if no blockers)
        priority: priority as 'top' | 'second' | 'later',
        success_criteria: successCriteria.map((text: string) => ({
          id: uuidv4(),
          text: text.trim(),
          completed: false,
        })),
        deliverables: deliverables.map((text: string) => ({
          id: uuidv4(),
          text: text.trim(),
          completed: false,
        })),
        blockers: parseList(options.blockers || ''),
        dependencies: dependenciesText,
        related_files: options.relatedFiles || [],
        notes: notesText,
        c7_verified: c7Verifications,
        sub_items: [],
        edges: [],
      };

      // Create task (includes atomic validation)
      let task: TaskNode;
      try {
        task = new TaskNode(taskData);
      } catch (err) {
        if (err instanceof Error) {
          error(err.message);

          // Show specific rejection reasons for atomic task violations
          if (err instanceof AtomicTaskViolationError && err.violations.length > 0) {
            console.log('');
            console.log(chalk.yellow.bold('Specific issues found:'));
            for (const violation of err.violations) {
              console.log(chalk.red('  ✗ ') + violation);
            }
            console.log('');
            info('See atomic task policy below for guidance');
            displayAtomicTaskPolicy();
          } else if (err.message.includes('atomic') || err.message.includes('vague')) {
            console.log('');
            info('See atomic task policy above for guidance');
            displayAtomicTaskPolicy();
          }
        } else {
          error('Failed to create task');
        }
        process.exit(1);
      }

      // Validate blockers exist and resolve short UUIDs to full UUIDs
      const resolvedBlockers: string[] = [];
      const invalidBlockers: string[] = [];

      for (const blockerId of task.blockers) {
        const resolvedTask = graph.getNodeByIdOrPrefix(blockerId);
        if (resolvedTask) {
          resolvedBlockers.push(resolvedTask.id);
        } else {
          invalidBlockers.push(blockerId);
        }
      }

      if (invalidBlockers.length > 0) {
        error(`Blocker task IDs not found: ${invalidBlockers.join(', ')}`);
        process.exit(1);
      }

      // Update task blockers with resolved full UUIDs
      task.blockers = resolvedBlockers;

      // Add to graph
      graph.addNode(task);

      // Create edges from blockers to this task
      for (const blockerId of task.blockers) {
        graph.addEdge(blockerId, taskId);
      }

      // Save
      await saveGraph(projectPath, graph);

      // Update registry task count
      touchProject(projectPath);

      // Invalidate server graph cache via HTTP
      try {
        const serverUrl = process.env.OCTIE_SERVER_URL || 'http://localhost:3030';
        await fetch(`${serverUrl}/api/cache/invalidate?project=${encodeURIComponent(projectPath)}`, { method: 'POST' });
      } catch {
        // Server may not be running, ignore
      }

      // Success
      success(`Task created: ${chalk.cyan(taskId)}`);
      info(`Title: ${task.title}`);
      info(`Priority: ${chalk.yellow(task.priority)}`);

      if (task.blockers.length > 0) {
        info(`Blocked by: ${task.blockers.map(id => chalk.cyan(id)).join(', ')}`);
        if (task.dependencies) {
          info(`Dependencies: ${task.dependencies}`);
        }
      }

      console.log('');
      console.log(chalk.gray('View task:'), chalk.gray(`octie get ${taskId}`));

      process.exit(0);
    } catch (err) {
      if (err instanceof Error) {
        error(err.message);
      } else {
        error('Failed to create task');
      }
      process.exit(1);
    }
  });

// Add help text to display atomic task policy when --help is shown
createCommand.on('--help', () => {
  displayAtomicTaskPolicy();
  console.log('');
  console.log(chalk.bold('Blockers & Dependencies (Twin Feature):'));
  console.log(chalk.cyan('  --blockers (-b)') + ': Comma-separated task IDs that block this task.');
  console.log('                Creates GRAPH EDGES affecting execution order.');
  console.log('                Task A blocks Task B → A must complete before B starts.');
  console.log('');
  console.log(chalk.cyan('  --dependencies (-d)') + ': Explanatory text WHY this task depends on its blockers.');
  console.log('                  REQUIRED when --blockers is set (twin validation).');
  console.log('                  Does NOT affect execution order - pure metadata.');
  console.log('');
  console.log(chalk.yellow('  Example (both required together):'));
  console.log('    octie create --title "Build Frontend" \\');
  console.log('      --blockers abc123,def456 \\');
  console.log('      --dependencies "Needs API spec from abc123 and auth from def456"');
  console.log('');
  console.log(chalk.red('  Error if only one provided:'));
  console.log('    --blockers without --dependencies → Error: twin required');
  console.log('    --dependencies without --blockers → Error: twin required');
});
