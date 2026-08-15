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
function normalizePath(p) {
    return p.replace(/\\/g, '/').replace(/\/+$/, '');
}
function isChildPath(parentPath, childPath) {
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
export function buildProjectTree(projects) {
    const nodes = new Map();
    for (const project of projects) {
        nodes.set(project.path, { project, children: [], depth: 0 });
    }
    const roots = [];
    for (const node of nodes.values()) {
        let parentNode = null;
        for (const candidate of nodes.values()) {
            if (candidate.project.path === node.project.path)
                continue;
            if (isChildPath(candidate.project.path, node.project.path) &&
                (!parentNode || candidate.project.path.length > parentNode.project.path.length)) {
                parentNode = candidate;
            }
        }
        if (parentNode) {
            node.depth = parentNode.depth + 1;
            parentNode.children.push(node);
        }
        else {
            roots.push(node);
        }
    }
    // Activity ranking: a node ranks by the most recent task-graph change
    // anywhere in its subtree (own project.json or any descendant's), so an
    // active subproject drags its parent group toward the top. Name is the
    // tiebreaker for stable, deterministic ordering.
    const rankOf = (node) => {
        let best = node.project.lastUpdated || '';
        for (const child of node.children) {
            const childRank = rankOf(child);
            if (childRank > best)
                best = childRank;
        }
        return best;
    };
    const sortNodes = (items) => {
        items.sort((a, b) => {
            const ra = rankOf(a);
            const rb = rankOf(b);
            if (ra !== rb)
                return rb.localeCompare(ra);
            return a.project.name.localeCompare(b.project.name);
        });
        for (const item of items) {
            sortNodes(item.children);
        }
    };
    sortNodes(roots);
    return roots;
}
//# sourceMappingURL=projectTree.js.map