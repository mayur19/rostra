import { HARD_MULTIPLIER } from '../model/constraints.js';
import { scoreEmployee, type EmployeeScore } from './employee-score.js';
import {
  aggregateFairness,
  fairnessPenalty,
  utilization,
  type FairnessAggregate,
} from './fairness.js';
import type { CompiledProblem } from './problem.js';

/**
 * Incremental search state. This is the one deliberately mutable structure in the
 * domain package (see ADR-0007): a move touches at most two employees, so only their
 * scores and the O(1) fairness aggregate are recomputed. It never escapes the solver;
 * callers receive immutable results.
 */
export class SearchState {
  readonly assignment: Int32Array;
  private readonly employeeSlots: number[][];
  private readonly employeeScores: EmployeeScore[];
  private unfilled: number;
  private employeeHard = 0;
  private employeeSoft = 0;
  private fairness: { count: number; sum: number; sumSquares: number };

  constructor(
    private readonly problem: CompiledProblem,
    initial: ArrayLike<number>,
  ) {
    this.assignment = Int32Array.from({ length: problem.slots.length }, (_, i) => initial[i] ?? -1);
    this.employeeSlots = problem.employees.map((): number[] => []);
    this.unfilled = 0;
    for (let slot = 0; slot < this.assignment.length; slot += 1) {
      const e = this.assignment[slot] ?? -1;
      if (e >= 0) this.employeeSlots[e]?.push(slot);
      else this.unfilled += 1;
    }
    this.employeeScores = this.employeeSlots.map((slots, e) => scoreEmployee(problem, e, slots));
    for (const s of this.employeeScores) {
      this.employeeHard += s.hard;
      this.employeeSoft += s.soft;
    }
    const aggregate: FairnessAggregate = aggregateFairness(
      problem,
      this.employeeScores.map((s) => s.minutes),
    );
    this.fairness = { ...aggregate };
  }

  hard(): number {
    return this.employeeHard + this.unfilled * this.problem.weights.unfilled;
  }

  soft(): number {
    return this.employeeSoft + fairnessPenalty(this.problem, this.fairness);
  }

  /** Lexicographic score collapsed to one comparable number (lower is better). */
  total(): number {
    return this.hard() * HARD_MULTIPLIER + this.soft();
  }

  employeeOf(slot: number): number {
    return this.assignment[slot] ?? -1;
  }

  /** Moves `slot` to `employee` (-1 to unassign) and updates the cached score. */
  assign(slot: number, employee: number): void {
    const previous = this.assignment[slot] ?? -1;
    if (previous === employee) return;
    this.assignment[slot] = employee;
    if (previous >= 0) {
      const list = this.employeeSlots[previous] ?? [];
      const at = list.indexOf(slot);
      if (at >= 0) list.splice(at, 1);
      this.rescore(previous);
    } else {
      this.unfilled -= 1;
    }
    if (employee >= 0) {
      this.employeeSlots[employee]?.push(slot);
      this.rescore(employee);
    } else {
      this.unfilled += 1;
    }
  }

  private rescore(employee: number): void {
    const before = this.employeeScores[employee];
    if (!before) return;
    const after = scoreEmployee(this.problem, employee, this.employeeSlots[employee] ?? []);
    this.employeeScores[employee] = after;
    this.employeeHard += after.hard - before.hard;
    this.employeeSoft += after.soft - before.soft;
    const oldRatio = utilization(this.problem, employee, before.minutes);
    const newRatio = utilization(this.problem, employee, after.minutes);
    if (oldRatio !== null && newRatio !== null) {
      this.fairness.sum += newRatio - oldRatio;
      this.fairness.sumSquares += newRatio * newRatio - oldRatio * oldRatio;
    }
  }

  snapshot(): Int32Array {
    return Int32Array.from(this.assignment);
  }
}
