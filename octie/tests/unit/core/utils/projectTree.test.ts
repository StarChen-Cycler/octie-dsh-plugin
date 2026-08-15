import { describe, it, expect } from 'vitest';
import { mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { buildProjectTree, type ProjectNode, type ProjectTreeEntry } from '../../../../src/core/utils/projectTree.js';
import { getProjectLastUpdated } from '../../../../src/core/registry/index.js';

function makeProject(path: string, name: string, lastUpdated?: string): ProjectTreeEntry {
  return {
    path,
    name,
    ...(lastUpdated === undefined ? {} : { lastUpdated }),
    registeredAt: '2026-01-01T00:00:00.000Z',
    lastAccessed: '2026-01-01T00:00:00.000Z',
    taskCount: 0,
    exists: true,
    statusCounts: { ready: 0, in_progress: 0, in_review: 0, completed: 0, blocked: 0 },
    priorityCounts: { top: 0, second: 0, later: 0 },
  };
}

describe('buildProjectTree', () => {
  it('returns an empty array when no projects are provided', () => {
    expect(buildProjectTree([])).toEqual([]);
  });

  it('treats unrelated projects as roots', () => {
    const projects = [
      makeProject('/home/user/alpha', 'alpha'),
      makeProject('/home/user/beta', 'beta'),
    ];

    const tree = buildProjectTree(projects);

    expect(tree).toHaveLength(2);
    expect(tree.map((n) => n.project.name)).toEqual(['alpha', 'beta']);
    expect(tree.every((n) => n.depth === 0)).toBe(true);
    expect(tree.every((n) => n.children.length === 0)).toBe(true);
  });

  it('nests subprojects under their parent by path prefix', () => {
    const projects = [
      makeProject('/home/user/root', 'root'),
      makeProject('/home/user/root/.octie/subprojects/child', 'child'),
    ];

    const tree = buildProjectTree(projects);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.project.name).toBe('root');
    expect(tree[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.project.name).toBe('child');
    expect(tree[0]!.children[0]!.depth).toBe(1);
  });

  it('handles deeply nested subprojects', () => {
    const projects = [
      makeProject('/home/user/root', 'root'),
      makeProject('/home/user/root/.octie/subprojects/level1', 'level1'),
      makeProject('/home/user/root/.octie/subprojects/level1/.octie/subprojects/level2', 'level2'),
    ];

    const tree = buildProjectTree(projects);

    expect(tree[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.project.name).toBe('level1');
    expect(tree[0]!.children[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.children[0]!.project.name).toBe('level2');
    expect(tree[0]!.children[0]!.children[0]!.depth).toBe(2);
  });

  it('matches immediate parent, not sibling with shared prefix', () => {
    const projects = [
      makeProject('/home/user/root-a', 'root-a'),
      makeProject('/home/user/root-ab', 'root-ab'),
      makeProject('/home/user/root-a/.octie/subprojects/child', 'child'),
    ];

    const tree = buildProjectTree(projects);

    const rootA = tree.find((n) => n.project.name === 'root-a');
    const rootAB = tree.find((n) => n.project.name === 'root-ab');

    expect(rootA).toBeDefined();
    expect(rootAB).toBeDefined();
    expect(rootA!.children).toHaveLength(1);
    expect(rootA!.children[0]!.project.name).toBe('child');
    expect(rootAB!.children).toHaveLength(0);
  });

  it('sorts projects and children alphabetically by name when no lastUpdated is present', () => {
    const projects = [
      makeProject('/home/user/zebra', 'zebra'),
      makeProject('/home/user/alpha', 'alpha'),
      makeProject('/home/user/zebra/.octie/subprojects/banana', 'banana'),
      makeProject('/home/user/zebra/.octie/subprojects/apple', 'apple'),
    ];

    const tree = buildProjectTree(projects);

    expect(tree.map((n) => n.project.name)).toEqual(['alpha', 'zebra']);
    expect(tree[1]!.children.map((n) => n.project.name)).toEqual(['apple', 'banana']);
  });

  it('ranks roots by the latest task update, newest first', () => {
    const projects = [
      makeProject('/home/user/zebra', 'zebra', '2026-08-10T00:00:00.000Z'),
      makeProject('/home/user/alpha', 'alpha', '2026-08-14T00:00:00.000Z'),
      makeProject('/home/user/mid', 'mid', '2026-08-12T00:00:00.000Z'),
    ];

    const tree = buildProjectTree(projects);

    expect(tree.map((n) => n.project.name)).toEqual(['alpha', 'mid', 'zebra']);
  });

  it('promotes a parent whose subproject was recently task-updated', () => {
    const projects = [
      makeProject('/home/user/root', 'root', '2026-08-01T00:00:00.000Z'),
      makeProject('/home/user/root/.octie/subprojects/child', 'child', '2026-08-15T00:00:00.000Z'),
      makeProject('/home/user/active-root', 'active-root', '2026-08-10T00:00:00.000Z'),
    ];

    const tree = buildProjectTree(projects);

    // The root's subtree max (child: 08-15) beats active-root (08-10).
    expect(tree.map((n) => n.project.name)).toEqual(['root', 'active-root']);
    expect(tree[0]!.children.map((n) => n.project.name)).toEqual(['child']);
  });

  it('sorts children within a parent by activity, name as tiebreaker', () => {
    const projects = [
      makeProject('/home/user/root', 'root', '2026-08-01T00:00:00.000Z'),
      makeProject('/home/user/root/.octie/subprojects/old', 'old', '2026-08-01T00:00:00.000Z'),
      makeProject('/home/user/root/.octie/subprojects/fresh', 'fresh', '2026-08-03T00:00:00.000Z'),
      makeProject('/home/user/root/.octie/subprojects/tie-a', 'tie-a', '2026-08-02T00:00:00.000Z'),
      makeProject('/home/user/root/.octie/subprojects/tie-b', 'tie-b', '2026-08-02T00:00:00.000Z'),
    ];

    const tree = buildProjectTree(projects);

    expect(tree[0]!.children.map((n) => n.project.name))
      .toEqual(['fresh', 'tie-a', 'tie-b', 'old']);
  });

  it('sorts projects without lastUpdated after ones that have it', () => {
    const projects = [
      makeProject('/home/user/never', 'never'), // no lastUpdated
      makeProject('/home/user/ancient', 'ancient', '2026-01-01T00:00:00.000Z'),
    ];

    const tree = buildProjectTree(projects);

    expect(tree.map((n) => n.project.name)).toEqual(['ancient', 'never']);
  });

  it('handles Windows-style backslash paths', () => {
    const projects = [
      makeProject('C:\\Users\\root', 'root'),
      makeProject('C:\\Users\\root\\.octie\\subprojects\\child', 'child'),
    ];

    const tree = buildProjectTree(projects);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.project.name).toBe('child');
  });

  it('does not treat siblings as children when one path contains the other as substring', () => {
    const projects = [
      makeProject('/home/user/root', 'root'),
      makeProject('/home/user/root-backup', 'root-backup'),
    ];

    const tree = buildProjectTree(projects);

    expect(tree).toHaveLength(2);
    expect(tree.every((n) => n.children.length === 0)).toBe(true);
  });

  it('does not nest projects that merely share a common ancestor directory', () => {
    const projects = [
      makeProject('/home/user/parent-folder', 'parent-folder'),
      makeProject('/home/user/parent-folder/foo/project-a', 'project-a'),
      makeProject('/home/user/parent-folder/bar/project-b', 'project-b'),
    ];

    const tree = buildProjectTree(projects);

    expect(tree).toHaveLength(3);
    expect(tree.every((n) => n.children.length === 0)).toBe(true);
  });

  it('does not nest a project inside a sibling with a shared name prefix', () => {
    const projects = [
      makeProject('/home/user/google-xprize-ai-planner-repo', 'google-xprize-ai-planner'),
      makeProject('/home/user/google-xprize-ai-planner-repo-rewrite', 'google-xprize-ai-planner-rewrite'),
      makeProject('/home/user/google-xprize-ai-planner-repo-rewrite/.octie/subprojects/frontend-visual-rewrite', 'frontend-visual-rewrite'),
    ];

    const tree = buildProjectTree(projects);

    expect(tree).toHaveLength(2);
    const rewriteRoot = tree.find(
      (n) => n.project.path === '/home/user/google-xprize-ai-planner-repo-rewrite',
    );
    expect(rewriteRoot).toBeDefined();
    expect(rewriteRoot!.children).toHaveLength(1);
    expect(rewriteRoot!.children[0]!.project.name).toBe('frontend-visual-rewrite');
  });
});

describe('getProjectLastUpdated', () => {
  it('returns the project.json mtime as an ISO timestamp', () => {
    const dir = join(tmpdir(), `octie-tree-test-${uuidv4()}`);
    try {
      const octieDir = join(dir, '.octie');
      mkdirSync(octieDir, { recursive: true });
      const projectFile = join(octieDir, 'project.json');
      writeFileSync(projectFile, '{}\n');

      const expected = new Date(Date.UTC(2026, 7, 15, 8, 30, 0));
      utimesSync(projectFile, expected, expected);

      expect(getProjectLastUpdated(dir)).toBe('2026-08-15T08:30:00.000Z');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null when the project file is missing', () => {
    const dir = join(tmpdir(), `octie-tree-test-${uuidv4()}`);
    try {
      mkdirSync(dir, { recursive: true });
      expect(getProjectLastUpdated(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
