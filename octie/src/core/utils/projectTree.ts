/**
 * Project tree utilities for hierarchical sidebar rendering.
 *
 * Builds a parent/child tree from a flat list of registered projects by
 * inferring containment from filesystem paths. A project is considered a
 * child of another project only when it lives inside the parent's
 * `.octie/subprojects/` directory. Mere directory-prefix overlap (e.g. two
 * unrelated projects under the same drive/root folder) must NOT create a
 * parent/child relationship.
 */

/**
 * Minimal project shape needed for tree construction. The full RegistryProject
 * from the backend extends this with additional fields.
 */
export interface ProjectTreeEntry {
  path: string;
  name: string;
}

export interface ProjectNode<T extends ProjectTreeEntry = ProjectTreeEntry> {
  project: T;
  children: ProjectNode<T>[];
  depth: number;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

function isChildPath(parentPath: string, childPath: string): boolean {
  const parent = normalizePath(parentPath);
  const child = normalizePath(childPath);
  const expectedPrefix = `${parent}/.octie/subprojects/`;
  return child !== parent && child.startsWith(expectedPrefix);
}

/**
 * Build a project tree from a flat list of registered projects.
 * @param projects - Flat list of registered projects
 * @returns Root project nodes with nested children
 */
export function buildProjectTree<T extends ProjectTreeEntry>(projects: T[]): ProjectNode<T>[] {
  const nodes = new Map<string, ProjectNode<T>>();

  for (const project of projects) {
    nodes.set(project.path, { project, children: [], depth: 0 });
  }

  const roots: ProjectNode<T>[] = [];

  for (const node of nodes.values()) {
    let parentNode: ProjectNode<T> | null = null;

    for (const candidate of nodes.values()) {
      if (candidate.project.path === node.project.path) continue;
      if (
        isChildPath(candidate.project.path, node.project.path) &&
        (!parentNode || candidate.project.path.length > parentNode.project.path.length)
      ) {
        parentNode = candidate;
      }
    }

    if (parentNode) {
      node.depth = parentNode.depth + 1;
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Stable ordering: by name, recursively.
  const sortNodes = (items: ProjectNode<T>[]) => {
    items.sort((a, b) => a.project.name.localeCompare(b.project.name));
    for (const item of items) {
      sortNodes(item.children);
    }
  };
  sortNodes(roots);

  return roots;
}
