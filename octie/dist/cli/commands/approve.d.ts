/**
 * Approve Command
 *
 * Manually approve a task that is in review.
 * This is the ONLY manual status transition in the new system:
 * in_review → completed
 *
 * The engine lives in the service layer (`approveTaskWithPropagation`);
 * this command keeps only UX: error branches, output, exit codes.
 *
 * @module cli/commands/approve
 */
import { Command } from 'commander';
/**
 * Approve a task in review
 *
 * @param taskId - Task ID or prefix to approve
 * @param options - Command options
 */
export declare function approveCommand(taskId: string, options: {
    project?: string;
}): Promise<void>;
/**
 * Register the approve command with the CLI
 */
export declare function registerApproveCommand(program: Command): void;
//# sourceMappingURL=approve.d.ts.map