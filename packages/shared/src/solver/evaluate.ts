import type {
  AssignmentInput,
  EmployeeSummary,
  Evaluation,
  ProblemInput,
  Violation,
} from '../model/types.js';
import { scoreEmployee } from './employee-score.js';
import { aggregateFairness, fairnessPenalty, varianceOf } from './fairness.js';
import { ProblemValidationError, compileProblem, type CompiledProblem } from './problem.js';

/** Slot -> employee index (-1 = unfilled). */
export type SlotAssignment = ArrayLike<number>;

export function groupByEmployee(problem: CompiledProblem, assignment: SlotAssignment): number[][] {
  const groups = problem.employees.map((): number[] => []);
  for (let slot = 0; slot < problem.slots.length; slot += 1) {
    const employee = assignment[slot] ?? -1;
    if (employee >= 0) groups[employee]?.push(slot);
  }
  return groups;
}

function unfilledViolations(problem: CompiledProblem, assignment: SlotAssignment): Violation[] {
  const missingByShift = new Map<number, number>();
  for (const slot of problem.slots) {
    if ((assignment[slot.index] ?? -1) < 0) {
      missingByShift.set(slot.shiftIndex, (missingByShift.get(slot.shiftIndex) ?? 0) + 1);
    }
  }
  return [...missingByShift.entries()].map(([shiftIndex, missing]) => {
    const shift = problem.shifts[shiftIndex];
    return {
      constraint: 'UNFILLED_SLOT' as const,
      severity: 'hard' as const,
      penalty: problem.weights.unfilled * missing,
      employeeId: null,
      shiftIds: shift ? [shift.id] : [],
      message:
        `${shift?.label ?? 'Shift'} needs ${missing} more ${shift?.skill ?? ''} staff`.trim(),
    };
  });
}

function byImportance(a: Violation, b: Violation): number {
  if (a.severity !== b.severity) return a.severity === 'hard' ? -1 : 1;
  return b.penalty - a.penalty || a.constraint.localeCompare(b.constraint);
}

/** Full, explainable evaluation of a slot assignment. */
export function evaluateSolution(problem: CompiledProblem, assignment: SlotAssignment): Evaluation {
  const violations: Violation[] = unfilledViolations(problem, assignment);
  const groups = groupByEmployee(problem, assignment);
  const scores = groups.map((slots, e) => scoreEmployee(problem, e, slots, violations));

  const aggregate = aggregateFairness(
    problem,
    scores.map((s) => s.minutes),
  );
  const fairness = fairnessPenalty(problem, aggregate);
  const stdDev = Math.sqrt(varianceOf(aggregate));
  if (fairness > 0) {
    violations.push({
      constraint: 'FAIRNESS',
      severity: 'soft',
      penalty: fairness,
      employeeId: null,
      shiftIds: [],
      message: `Utilization varies across staff (std dev ${(stdDev * 100).toFixed(0)}%)`,
    });
  }

  const hard = violations.filter((v) => v.severity === 'hard').reduce((n, v) => n + v.penalty, 0);
  const soft = violations.filter((v) => v.severity === 'soft').reduce((n, v) => n + v.penalty, 0);
  const employees: EmployeeSummary[] = scores.map((s, e) => ({
    employeeId: problem.employees[e]?.id ?? '',
    shifts: groups[e]?.length ?? 0,
    hours: s.minutes / 60,
    overtimeHours: s.overtimeMinutes / 60,
    costMinor: s.costMinor,
  }));
  const slotsFilled = problem.slots.filter((slot) => (assignment[slot.index] ?? -1) >= 0).length;

  return {
    score: { hard, soft },
    feasible: hard === 0,
    violations: [...violations].sort(byImportance),
    employees,
    metrics: {
      slotsTotal: problem.slots.length,
      slotsFilled,
      coverageRatio: problem.slots.length === 0 ? 1 : slotsFilled / problem.slots.length,
      totalHours: scores.reduce((n, s) => n + s.minutes, 0) / 60,
      laborCostMinor: scores.reduce((n, s) => n + s.costMinor, 0),
      utilizationStdDev: stdDev,
    },
  };
}

/** Maps explicit (shift, employee) pairs onto slots, honouring headcount. */
export function toSlotAssignment(
  problem: CompiledProblem,
  assignments: readonly AssignmentInput[],
): Int32Array {
  const result = new Int32Array(problem.slots.length).fill(-1);
  const issues: string[] = [];
  const freeSlots = new Map<number, number[]>();
  for (const slot of problem.slots) {
    const list = freeSlots.get(slot.shiftIndex) ?? [];
    list.push(slot.index);
    freeSlots.set(slot.shiftIndex, list);
  }
  for (const a of assignments) {
    const shiftIndex = problem.shiftIndexById.get(a.shiftId);
    const employeeIndex = problem.employeeIndexById.get(a.employeeId);
    if (shiftIndex === undefined) issues.push(`unknown shift ${a.shiftId}`);
    if (employeeIndex === undefined) issues.push(`unknown employee ${a.employeeId}`);
    if (shiftIndex === undefined || employeeIndex === undefined) continue;
    const slot = freeSlots.get(shiftIndex)?.shift();
    if (slot === undefined) {
      issues.push(`shift ${a.shiftId} has more assignments than its headcount`);
      continue;
    }
    result[slot] = employeeIndex;
  }
  if (issues.length > 0) throw new ProblemValidationError(issues);
  return result;
}

export function fromSlotAssignment(
  problem: CompiledProblem,
  assignment: SlotAssignment,
): AssignmentInput[] {
  const result: AssignmentInput[] = [];
  for (const slot of problem.slots) {
    const employee = problem.employees[assignment[slot.index] ?? -1];
    const shift = problem.shifts[slot.shiftIndex];
    if (employee && shift) result.push({ shiftId: shift.id, employeeId: employee.id });
  }
  return result;
}

/** Convenience for manual edits: evaluate a proposed set of assignments. */
export function evaluateAssignments(
  input: ProblemInput,
  assignments: readonly AssignmentInput[],
): Evaluation {
  const problem = compileProblem(input);
  return evaluateSolution(problem, toSlotAssignment(problem, assignments));
}
