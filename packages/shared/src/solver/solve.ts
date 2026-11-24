import type { AssignmentInput, Evaluation, ProblemInput, Score } from '../model/types.js';
import { anneal, type AnnealOptions } from './anneal.js';
import { evaluateSolution, fromSlotAssignment, toSlotAssignment } from './evaluate.js';
import { constructGreedy } from './greedy.js';
import { compileProblem } from './problem.js';
import { createRng } from './rng.js';
import { SearchState } from './state.js';

export interface SolveOptions {
  readonly seed: number;
  readonly iterations?: number;
  readonly initialTemperature?: number;
  readonly finalTemperature?: number;
  /** Optional starting point (for example the currently saved schedule). */
  readonly warmStart?: readonly AssignmentInput[];
}

export interface SolveStats {
  readonly seed: number;
  readonly iterations: number;
  readonly accepted: number;
  readonly improvements: number;
  readonly greedyScore: Score;
  readonly finalScore: Score;
  readonly elapsedMs: number;
}

export interface SolveResult {
  readonly assignments: readonly AssignmentInput[];
  readonly evaluation: Evaluation;
  readonly stats: SolveStats;
}

export const SOLVER_DEFAULTS = {
  iterations: 20_000,
  initialTemperature: 40,
  finalTemperature: 0.05,
  reassignProbability: 0.6,
} as const;

export const MAX_ITERATIONS = 500_000;

function annealOptions(options: SolveOptions): AnnealOptions {
  return {
    iterations: Math.min(options.iterations ?? SOLVER_DEFAULTS.iterations, MAX_ITERATIONS),
    initialTemperature: options.initialTemperature ?? SOLVER_DEFAULTS.initialTemperature,
    finalTemperature: options.finalTemperature ?? SOLVER_DEFAULTS.finalTemperature,
    reassignProbability: SOLVER_DEFAULTS.reassignProbability,
  };
}

/**
 * Generates a roster: pinned slots are fixed, the rest is built greedily and then
 * improved by simulated annealing. Pure with respect to its inputs: the same problem,
 * seed and iteration budget always yield the same assignments.
 */
export function solve(input: ProblemInput, options: SolveOptions): SolveResult {
  const startedAt = performance.now();
  const problem = compileProblem(input);
  const rng = createRng(options.seed);

  const initial = options.warmStart
    ? toSlotAssignment(problem, options.warmStart)
    : new Int32Array(problem.slots.length).fill(-1);
  for (const slot of problem.slots) {
    if (slot.pinnedEmployee >= 0) initial[slot.index] = slot.pinnedEmployee;
  }

  const state = new SearchState(problem, initial);
  constructGreedy(problem, state, rng);
  const greedyScore: Score = { hard: state.hard(), soft: state.soft() };

  const { best, stats } = anneal(problem, state, rng, annealOptions(options));
  const evaluation = evaluateSolution(problem, best);

  return {
    assignments: fromSlotAssignment(problem, best),
    evaluation,
    stats: {
      seed: options.seed,
      iterations: stats.iterations,
      accepted: stats.accepted,
      improvements: stats.improvements,
      greedyScore,
      finalScore: evaluation.score,
      elapsedMs: Math.round(performance.now() - startedAt),
    },
  };
}
