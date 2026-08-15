/**
 * Import command - Import project data from file
 */
import { Command } from 'commander';
import type { TaskStatus, TaskPriority, SuccessCriterion, Deliverable } from '../../types/index.js';
/**
 * Parsed markdown task structure
 */
interface ParsedMarkdownTask {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    success_criteria: SuccessCriterion[];
    deliverables: Deliverable[];
    blockers: string[];
    dependencies: string;
    sub_items: string[];
    related_files: string[];
    notes: string;
    c7_verified: Array<{
        library_id: string;
        verified_at: string;
        notes?: string;
    }>;
    completed: boolean;
}
/**
 * Parse markdown content into task array
 *
 * Supports format:
 * ## [x] Task Title
 * **ID**: `task-id` | **Status**: in_progress | **Priority**: top
 *
 * ### Description
 * Task description here...
 *
 * ### Success Criteria
 * - [x] Criterion 1
 * - [ ] Criterion 2
 *
 * ### Deliverables
 * - [ ] Deliverable 1 → `file.ts`
 *
 * ### Blockers
 * - #blocker-task-id
 *
 * ### Notes
 * Additional notes...
 */
export declare function parseMarkdownTasks(content: string): ParsedMarkdownTask[];
/**
 * Create the import command
 */
export declare const importCommand: Command;
export {};
//# sourceMappingURL=import.d.ts.map