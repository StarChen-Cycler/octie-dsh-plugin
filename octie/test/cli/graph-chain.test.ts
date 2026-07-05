/**
 * Tests for graph chain command — walkUpstream, walkDownstream
 */

import { describe, it, expect } from 'vitest';
import { walkUpstream, walkDownstream } from '../../src/cli/commands/graph.js';
import { TaskGraphStore } from '../../src/core/graph/index.js';
import { TaskNode } from '../../src/core/models/task-node.js';

function makeTask(id: string, title: string, blockers: string[] = []): TaskNode {
  return new TaskNode({
    id,
    title: `Implement ${title} feature with comprehensive testing and validation`,
    description: `This task covers the ${title} feature end-to-end, including all edge cases, error paths, and integration tests needed for a production-quality implementation.`,
    status: 'ready',
    priority: 'second',
    success_criteria: [{ id: `${id}-sc1`, text: 'All tests pass with >80% coverage', completed: false }],
    deliverables: [{ id: `${id}-d1`, text: `Source code for ${title}`, completed: false }],
    blockers,
  });
}

function buildGraph(): TaskGraphStore {
  const graph = new TaskGraphStore();
  // Linear chain: A -> B -> C -> D
  //   A is the root (no blockers)
  //   B blocked by A
  //   C blocked by B
  //   D blocked by C
  graph.addNode(makeTask('aaaaaaaa-0000-0000-0000-000000000001', 'Task A'));
  graph.addNode(makeTask('bbbbbbbb-0000-0000-0000-000000000002', 'Task B', ['aaaaaaaa-0000-0000-0000-000000000001']));
  graph.addNode(makeTask('cccccccc-0000-0000-0000-000000000003', 'Task C', ['bbbbbbbb-0000-0000-0000-000000000002']));
  graph.addNode(makeTask('dddddddd-0000-0000-0000-000000000004', 'Task D', ['cccccccc-0000-0000-0000-000000000003']));
  // Add edges
  graph.addEdge('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');
  graph.addEdge('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003');
  graph.addEdge('cccccccc-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000004');
  return graph;
}

describe('walkUpstream', () => {
  it('returns only self for root task (no blockers)', () => {
    const graph = buildGraph();
    const result = walkUpstream(graph, 'aaaaaaaa-0000-0000-0000-000000000001');
    const ids = result.map(r => r.id);
    expect(ids).toEqual(['aaaaaaaa-0000-0000-0000-000000000001']);
    expect(result[0]!.depth).toBe(0);
  });

  it('returns all blockers in order for leaf task', () => {
    const graph = buildGraph();
    const result = walkUpstream(graph, 'dddddddd-0000-0000-0000-000000000004');
    const ids = result.map(r => r.id);
    // A -> B -> C -> D, blockers walked before task
    expect(ids).toEqual([
      'aaaaaaaa-0000-0000-0000-000000000001',
      'bbbbbbbb-0000-0000-0000-000000000002',
      'cccccccc-0000-0000-0000-000000000003',
      'dddddddd-0000-0000-0000-000000000004',
    ]);
  });

  it('depth increases for each blocker level', () => {
    const graph = buildGraph();
    const result = walkUpstream(graph, 'dddddddd-0000-0000-0000-000000000004');
    const depths = result.map(r => r.depth);
    // A=3 (deepest blocker), B=2, C=1, D=0 (target)
    expect(depths).toEqual([3, 2, 1, 0]);
  });

  it('handles task with no blockers', () => {
    const graph = new TaskGraphStore();
    graph.addNode(makeTask('node1', 'Solo'));
    const result = walkUpstream(graph, 'node1');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('node1');
    expect(result[0]!.depth).toBe(0);
  });

  it('handles missing task gracefully', () => {
    const graph = buildGraph();
    const result = walkUpstream(graph, 'nonexistent-id');
    expect(result).toEqual([]);
  });

  it('avoids infinite loop on cycles', () => {
    const graph = new TaskGraphStore();
    graph.addNode(makeTask('a', 'Task A', ['b']));
    graph.addNode(makeTask('b', 'Task B', ['a']));
    graph.addEdge('b', 'a');
    graph.addEdge('a', 'b');

    // Should not hang — visited set prevents re-entry
    const result = walkUpstream(graph, 'a');
    const ids = result.map(r => r.id);
    // b first (unique blocker), then a (target)
    expect(ids).toEqual(['b', 'a']);
  });
});

describe('walkDownstream', () => {
  it('returns only self for leaf task (no dependents)', () => {
    const graph = buildGraph();
    const result = walkDownstream(graph, 'dddddddd-0000-0000-0000-000000000004');
    const ids = result.map(r => r.id);
    expect(ids).toEqual(['dddddddd-0000-0000-0000-000000000004']);
    expect(result[0]!.depth).toBe(0);
  });

  it('returns all dependents in order from root', () => {
    const graph = buildGraph();
    const result = walkDownstream(graph, 'aaaaaaaa-0000-0000-0000-000000000001');
    const ids = result.map(r => r.id);
    expect(ids).toEqual([
      'aaaaaaaa-0000-0000-0000-000000000001',
      'bbbbbbbb-0000-0000-0000-000000000002',
      'cccccccc-0000-0000-0000-000000000003',
      'dddddddd-0000-0000-0000-000000000004',
    ]);
  });

  it('depth increases for each dependent level', () => {
    const graph = buildGraph();
    const result = walkDownstream(graph, 'aaaaaaaa-0000-0000-0000-000000000001');
    const depths = result.map(r => r.depth);
    expect(depths).toEqual([0, 1, 2, 3]);
  });

  it('handles fork (one task blocks multiple)', () => {
    const graph = new TaskGraphStore();
    const root = makeTask('root', 'Root');
    graph.addNode(root);
    graph.addNode(makeTask('child1', 'Child 1', ['root']));
    graph.addNode(makeTask('child2', 'Child 2', ['root']));
    graph.addEdge('root', 'child1');
    graph.addEdge('root', 'child2');

    const result = walkDownstream(graph, 'root');
    const ids = result.map(r => r.id);
    expect(ids).toContain('root');
    expect(ids).toContain('child1');
    expect(ids).toContain('child2');
    expect(ids.length).toBe(3);
  });

  it('handles missing task gracefully', () => {
    const graph = buildGraph();
    const result = walkDownstream(graph, 'nope');
    expect(result).toEqual([]);
  });

  it('avoids infinite loop on cycles', () => {
    const graph = new TaskGraphStore();
    graph.addNode(makeTask('a', 'Task A', ['b']));
    graph.addNode(makeTask('b', 'Task B', ['a']));
    graph.addEdge('b', 'a');
    graph.addEdge('a', 'b');

    const result = walkDownstream(graph, 'a');
    const ids = result.map(r => r.id);
    expect(ids.length).toBeLessThanOrEqual(2); // a + b, or just a
  });
});
