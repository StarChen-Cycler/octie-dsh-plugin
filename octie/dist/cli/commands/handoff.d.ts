/**
 * Handoff commands - loose subproject handoff workflows.
 */
import { Command } from 'commander';
export declare class HandoffRollbackError extends Error {
    readonly originalError: Error;
    readonly rollbackError: Error;
    constructor(originalError: unknown, rollbackError: unknown);
}
export declare function combineHandoffFailure(originalError: unknown, rollbackError: unknown): HandoffRollbackError;
export declare const handoffCommand: Command;
//# sourceMappingURL=handoff.d.ts.map