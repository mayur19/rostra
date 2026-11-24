import type { CompiledProblem } from './problem.js';
import type { Rng } from './rng.js';
import type { SearchState } from './state.js';

export interface AnnealOptions {
  readonly iterations: number;
  readonly initialTemperature: number;
  readonly finalTemperature: number;
  /** Probability of a reassign move; the remainder are swap moves. */
  readonly reassignProbability: number;
}

export interface AnnealStats {
  readonly iterations: number;
  readonly accepted: number;
  readonly improvements: number;
  readonly bestTotal: number;
}

const UNASSIGN_PROBABILITY = 0.03;
const ELIGIBLE_PROBABILITY = 0.92;

interface Move {
  readonly slots: readonly number[];
  readonly previous: readonly number[];
}

function pickEmployee(problem: CompiledProblem, shiftIndex: number, rng: Rng): number {
  const roll = rng.next();
  if (roll < UNASSIGN_PROBABILITY) return -1;
  const eligible = problem.eligible[shiftIndex] ?? [];
  if (roll < ELIGIBLE_PROBABILITY && eligible.length > 0) {
    return eligible[rng.int(eligible.length)] ?? -1;
  }
  return rng.int(problem.employees.length);
}

function reassignMove(
  problem: CompiledProblem,
  state: SearchState,
  movable: readonly number[],
  rng: Rng,
): Move | null {
  const slot = movable[rng.int(movable.length)] ?? -1;
  const shiftIndex = problem.slots[slot]?.shiftIndex ?? -1;
  const current = state.employeeOf(slot);
  const candidate = pickEmployee(problem, shiftIndex, rng);
  if (candidate === current) return null;
  state.assign(slot, candidate);
  return { slots: [slot], previous: [current] };
}

function swapMove(
  problem: CompiledProblem,
  state: SearchState,
  movable: readonly number[],
  rng: Rng,
): Move | null {
  const a = movable[rng.int(movable.length)] ?? -1;
  const b = movable[rng.int(movable.length)] ?? -1;
  const ea = state.employeeOf(a);
  const eb = state.employeeOf(b);
  if (ea === eb || problem.slots[a]?.shiftIndex === problem.slots[b]?.shiftIndex) return null;
  state.assign(a, eb);
  state.assign(b, ea);
  return { slots: [a, b], previous: [ea, eb] };
}

function undo(state: SearchState, move: Move): void {
  for (let i = move.slots.length - 1; i >= 0; i -= 1) {
    state.assign(move.slots[i] ?? -1, move.previous[i] ?? -1);
  }
}

/**
 * Simulated annealing over reassign and swap moves with a geometric cooling schedule.
 * Hard penalties are scaled by HARD_MULTIPLIER, so moves that add a hard violation are
 * effectively never accepted while moves that remove one always are. Returns the best
 * assignment seen; the run is fully determined by the RNG seed and iteration budget.
 */
export function anneal(
  problem: CompiledProblem,
  state: SearchState,
  rng: Rng,
  options: AnnealOptions,
): { best: Int32Array; stats: AnnealStats } {
  const movable = problem.slots.filter((s) => s.pinnedEmployee < 0).map((s) => s.index);
  let best = state.snapshot();
  let bestTotal = state.total();
  let current = bestTotal;
  let accepted = 0;
  let improvements = 0;
  if (movable.length === 0 || options.iterations <= 0) {
    return { best, stats: { iterations: 0, accepted, improvements, bestTotal } };
  }
  const ratio = options.finalTemperature / options.initialTemperature;

  for (let i = 0; i < options.iterations; i += 1) {
    const temperature = options.initialTemperature * Math.pow(ratio, i / options.iterations);
    const move =
      rng.next() < options.reassignProbability
        ? reassignMove(problem, state, movable, rng)
        : swapMove(problem, state, movable, rng);
    if (!move) continue;
    const next = state.total();
    const delta = next - current;
    if (delta <= 0 || rng.next() < Math.exp(-delta / temperature)) {
      current = next;
      accepted += 1;
      if (next < bestTotal) {
        bestTotal = next;
        best = state.snapshot();
        improvements += 1;
      }
    } else {
      undo(state, move);
    }
  }
  return { best, stats: { iterations: options.iterations, accepted, improvements, bestTotal } };
}
