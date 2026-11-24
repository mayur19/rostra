/* Benchmark: npm run bench. Prints solve time and score for growing ward sizes. */
import { generateWardProblem } from './fixtures.js';
import { solve } from './solve.js';

const sizes = [
  { employees: 20, scale: 1 },
  { employees: 40, scale: 2 },
  { employees: 80, scale: 4 },
  { employees: 160, scale: 8 },
];

for (const size of sizes) {
  const problem = generateWardProblem({
    seed: 7,
    employees: size.employees,
    demandScale: size.scale,
  });
  const result = solve(problem, { seed: 42, iterations: 50_000 });
  const slots = result.evaluation.metrics.slotsTotal;
  process.stdout.write(
    `${String(size.employees).padStart(4)} employees ${String(slots).padStart(4)} slots  ` +
      `${String(result.stats.elapsedMs).padStart(6)} ms  ` +
      `greedy ${result.stats.greedyScore.hard}h/${result.stats.greedyScore.soft}s -> ` +
      `final ${result.evaluation.score.hard}h/${result.evaluation.score.soft}s  ` +
      `coverage ${(result.evaluation.metrics.coverageRatio * 100).toFixed(1)}%\n`,
  );
}
