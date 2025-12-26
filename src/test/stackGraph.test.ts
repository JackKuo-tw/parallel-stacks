import * as assert from 'assert';
import { buildGraph, ThreadData, GraphNode, StackFrame } from '../stackGraph';

// Mock types
// We need to export buildGraph from stackGraph.ts into a testable unit or mock customRequest.
// Ideally, stackGraph.ts should export 'buildGraph' for testing.
// Let's assume we modify stackGraph.ts to export buildGraph.

// For now, I'll access it via a public export if I modify stackGraph.ts, or copy the logic.
// Better: update stackGraph.ts to export buildGraph.

suite('Stack Graph Test Suite', () => {
    test('Groups identical stacks', () => {
        // Create two threads with identical stacks
        // Thread 1: main -> foo -> bar
        // Thread 2: main -> foo -> bar
        // Should result in: main -> foo -> bar (1 path, both threads)

        const t1: ThreadData = {
            id: 1,
            name: 'Thread 1',
            frames: [
                { id: 10, name: 'main', line: 1, column: 1, source: { path: 'main.cpp' } },
                { id: 11, name: 'foo', line: 10, column: 1, source: { path: 'main.cpp' } },
                { id: 12, name: 'bar', line: 20, column: 1, source: { path: 'main.cpp' } }
            ] as any[]
        };

        const t2: ThreadData = {
            id: 2,
            name: 'Thread 2',
            frames: [
                { id: 20, name: 'main', line: 1, column: 1, source: { path: 'main.cpp' } },
                { id: 21, name: 'foo', line: 10, column: 1, source: { path: 'main.cpp' } },
                { id: 22, name: 'bar', line: 20, column: 1, source: { path: 'main.cpp' } }
            ] as any[]
        };

        const graph = buildGraph([t1, t2]);

        // Expect 1 root node 'main'
        assert.strictEqual(graph.length, 1, 'Should have 1 root node');
        assert.strictEqual(graph[0].frame.name, 'main', 'Root should be main');
        assert.deepStrictEqual(graph[0].threadIds.sort(), [1, 2], 'Root should have both threads');

        // Expect 1 child 'foo'
        assert.strictEqual(graph[0].children.length, 1, 'Should have 1 child');
        assert.strictEqual(graph[0].children[0].frame.name, 'foo', 'Child should be foo');

        // Expect 1 child 'bar'
        assert.strictEqual(graph[0].children[0].children.length, 1, 'Should have 1 grandchild');
        assert.strictEqual(graph[0].children[0].children[0].frame.name, 'bar', 'Grandchild should be bar');
    });

    test('Splits divergent stacks', () => {
        // Thread 1: A -> B
        // Thread 2: A -> C
        const t1: ThreadData = {
            id: 1, name: 'T1',
            frames: [
                { name: 'A', line: 1, column: 1, source: { path: 'f' } },
                { name: 'B', line: 2, column: 1, source: { path: 'f' } }
            ] as any[]
        };
        const t2: ThreadData = {
            id: 2, name: 'T2',
            frames: [
                { name: 'A', line: 1, column: 1, source: { path: 'f' } },
                { name: 'C', line: 3, column: 1, source: { path: 'f' } }
            ] as any[]
        };

        const graph = buildGraph([t1, t2]);
        assert.strictEqual(graph.length, 1, 'Root A');
        assert.strictEqual(graph[0].children.length, 2, 'A should have 2 children (B and C)');
    });
});
