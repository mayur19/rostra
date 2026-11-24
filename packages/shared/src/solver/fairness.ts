import type { CompiledProblem } from './problem.js';

/**
 * Fairness is measured as the variance of utilization (assigned minutes divided by
 * contracted minimum minutes) across employees with a non-zero minimum.
 */
export interface FairnessAggregate {
  readonly count: number;
  readonly sum: number;
  readonly sumSquares: number;
}

export function utilization(
  problem: CompiledProblem,
  employee: number,
  minutes: number,
): number | null {
  const minHours = problem.employees[employee]?.contract.minHoursPerWeek ?? 0;
  return minHours > 0 ? minutes / (minHours * 60) : null;
}

export function aggregateFairness(
  problem: CompiledProblem,
  minutesByEmployee: ArrayLike<number>,
): FairnessAggregate {
  let count = 0;
  let sum = 0;
  let sumSquares = 0;
  for (let e = 0; e < problem.employees.length; e += 1) {
    const ratio = utilization(problem, e, minutesByEmployee[e] ?? 0);
    if (ratio === null) continue;
    count += 1;
    sum += ratio;
    sumSquares += ratio * ratio;
  }
  return { count, sum, sumSquares };
}

export function varianceOf(aggregate: FairnessAggregate): number {
  if (aggregate.count < 2) return 0;
  const mean = aggregate.sum / aggregate.count;
  return Math.max(0, aggregate.sumSquares / aggregate.count - mean * mean);
}

export function fairnessPenalty(problem: CompiledProblem, aggregate: FairnessAggregate): number {
  return Math.round(problem.weights.fairness * varianceOf(aggregate));
}
