import type { CompiledProblem } from './problem.js';
import { shuffled, type Rng } from './rng.js';
import type { SearchState } from './state.js';

/**
 * Most-constrained-first greedy construction.
 *
 * Slots are ordered by how few employees can legally work them (ties: earliest start),
 * then each slot takes the candidate with the lowest resulting total score, or stays
 * empty when every candidate would make the score worse. Candidate order is shuffled
 * with the seeded RNG so ties break reproducibly. O(S * E * k log k).
 */
export function constructGreedy(problem: CompiledProblem, state: SearchState, rng: Rng): void {
  const order = problem.slots
    .filter((slot) => slot.pinnedEmployee < 0 && state.employeeOf(slot.index) < 0)
    .map((slot) => ({
      slot: slot.index,
      eligible: problem.eligible[slot.shiftIndex]?.length ?? 0,
      start: problem.shifts[slot.shiftIndex]?.startMs ?? 0,
    }))
    .sort((a, b) => a.eligible - b.eligible || a.start - b.start || a.slot - b.slot);

  for (const { slot } of order) {
    const shiftIndex = problem.slots[slot]?.shiftIndex ?? -1;
    const candidates = shuffled(rng, problem.eligible[shiftIndex] ?? []);
    let best = -1;
    let bestTotal = state.total();
    for (const employee of candidates) {
      state.assign(slot, employee);
      const total = state.total();
      if (total < bestTotal) {
        best = employee;
        bestTotal = total;
      }
      state.assign(slot, -1);
    }
    if (best >= 0) state.assign(slot, best);
  }
}
