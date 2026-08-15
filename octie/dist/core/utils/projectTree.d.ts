/**
 * Project tree utilities for hierarchical sidebar rendering.
 *
 * Builds a parent/child tree from a flat list of registered projects by
 * inferring containment from filesystem paths. A project is considered a
 * child of another project only when it lives inside the parent's
 * `.octie/subprojects/` directory. Mere directory-prefix overlap (e.g. two
 * unrelated projects under the same drive/root folder) must NOT create a
 * parent/child relationship.
 *
 * This module stays dependency-free on purpose: it is also compiled into the
 * browser web-ui, so it must not import Node builtins. The filesystem-based
 * activity signal (getProjectLastUpdated) lives in core/registry instead.
 */
/**
 * Minimal project shape needed for tree construction. The full RegistryProject
 * from the backend extends this with additional fields.
 */
export interface ProjectTreeEntry {
    path: string;
    name: string;
    /** ISO timestamp of the last task-graph change (project.json mtime). */
    lastUpdated?: string;
}
export interface ProjectNode<T extends ProjectTreeEntry = ProjectTreeEntry> {
    project: T;
    children: ProjectNode<T>[];
    depth: number;
}
/**
 * Build a project tree from a flat list of registered projects.
 * @param projects - Flat list of registered projects
 * @returns Root project nodes with nested children
 */
export declare function buildProjectTree<T extends ProjectTreeEntry>(projects: T[]): ProjectNode<T>[];
//# sourceMappingURL=projectTree.d.ts.map