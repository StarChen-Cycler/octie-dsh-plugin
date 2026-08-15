/**
 * Wire command - Insert an existing task between two connected tasks
 *
 * Before: A → C (A blocks C)
 * After:  A → B → C (A blocks B, B blocks C)
 *
 * The engine lives in the service layer (`wireTask`); this command keeps
 * only UX: validation error branches, output, exit codes.
 */
import { Command } from 'commander';
/**
 * Create the wire command
 */
export declare const wireCommand: Command;
//# sourceMappingURL=wire.d.ts.map