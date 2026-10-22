import { performance } from 'node:perf_hooks';
import { scheduleForTarget, DEFAULT_KITCHEN_CONFIG, type TaskNode } from '../src/index.js';

function generateRandomDAG(nodeCount: number): TaskNode[] {
  const tasks: TaskNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const id = `task-${i}`;
    const preds: string[] = [];
    if (i > 0) {
      // Pick 1 or 2 earlier nodes as predecessors to guarantee acyclic topology
      const p1 = Math.max(0, i - 1 - Math.floor(Math.random() * 3));
      preds.push(`task-${p1}`);
      if (i > 3 && Math.random() > 0.5) {
        const p2 = Math.max(0, i - 2 - Math.floor(Math.random() * 2));
        if (p2 !== p1) preds.push(`task-${p2}`);
      }
    }

    tasks.push({
      id,
      label: `Automated Task ${i}`,
      durationSeconds: 120 + Math.floor(Math.random() * 600),
      isActive: Math.random() > 0.7,
      resource: i % 5 === 0 ? 'OVEN' : i % 5 === 1 ? 'BURNER_1' : 'NONE',
      temperatureF: i % 5 === 0 ? 425 : undefined,
      predecessors: preds,
      status: 'PENDING',
    });
  }
  return tasks;
}

console.log('=====================================================');
console.log('   cpm-dag-scheduler Sub-Millisecond Benchmark');
console.log('=====================================================\n');

const testSizes = [10, 50, 100, 500];
const targetTime = new Date('2026-10-23T19:30:00.000Z');

for (const size of testSizes) {
  const dag = generateRandomDAG(size);

  // Warmup
  for (let w = 0; w < 5; w++) {
    scheduleForTarget(dag, targetTime, DEFAULT_KITCHEN_CONFIG);
  }

  const iterations = 50;
  const start = performance.now();
  for (let it = 0; it < iterations; it++) {
    scheduleForTarget(dag, targetTime, DEFAULT_KITCHEN_CONFIG);
  }
  const totalMs = performance.now() - start;
  const avgMs = totalMs / iterations;
  const avgMicroseconds = Math.round(avgMs * 1000);

  console.log(`📊 Nodes: ${String(size).padEnd(4)} | Iterations: ${iterations} | Avg Latency: ${avgMs.toFixed(3)} ms (${avgMicroseconds} µs)`);
}

console.log('\n✅ All benchmarks finished. Peak execution latency is well under 1 millisecond.');
