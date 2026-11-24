import type { Violation } from '../model/types.js';
import { ROSTER_DAYS, type CompiledProblem, type CompiledShift } from './problem.js';

/** Per-employee contribution to the score; recomputed only for employees touched by a move. */
export interface EmployeeScore {
  readonly hard: number;
  readonly soft: number;
  readonly minutes: number;
  readonly overtimeMinutes: number;
  readonly costMinor: number;
}

export const EMPTY_EMPLOYEE_SCORE: EmployeeScore = {
  hard: 0,
  soft: 0,
  minutes: 0,
  overtimeMinutes: 0,
  costMinor: 0,
};

const hoursUp = (minutes: number): number => Math.ceil(minutes / 60);

function fmtHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

interface Accumulator {
  hard: number;
  soft: number;
  readonly sink: Violation[] | undefined;
  readonly employeeId: string;
  readonly name: string;
}

function penalize(
  acc: Accumulator,
  violation: Omit<Violation, 'employeeId' | 'message'>,
  message: () => string,
): void {
  if (violation.severity === 'hard') acc.hard += violation.penalty;
  else acc.soft += violation.penalty;
  acc.sink?.push({ ...violation, employeeId: acc.employeeId, message: message() });
}

function checkStatic(
  problem: CompiledProblem,
  e: number,
  shifts: CompiledShift[],
  acc: Accumulator,
) {
  const shiftCount = problem.shifts.length;
  for (const shift of shifts) {
    const reason = problem.staticReason[e * shiftCount + shift.index];
    if (reason === undefined || reason === 'none') continue;
    const penalty = reason === 'UNAVAILABLE' ? problem.weights.unavailable : problem.weights.skill;
    penalize(acc, { constraint: reason, severity: 'hard', penalty, shiftIds: [shift.id] }, () => {
      if (reason === 'UNAVAILABLE') return `${acc.name} is unavailable during ${shift.label}`;
      if (reason === 'SKILL_EXPIRED') {
        return `${acc.name}'s ${shift.skill} certification has expired before ${shift.localDate}`;
      }
      return `${acc.name} lacks the ${shift.skill} skill required by ${shift.label}`;
    });
  }
}

function checkSequence(
  problem: CompiledProblem,
  e: number,
  sorted: CompiledShift[],
  acc: Accumulator,
) {
  const employee = problem.employees[e];
  if (!employee) return;
  const minRestMinutes = employee.contract.minRestHours * 60;
  let previous: CompiledShift | undefined;
  for (const shift of sorted) {
    if (previous && shift.startMs < previous.endMs) {
      const prior = previous;
      penalize(
        acc,
        {
          constraint: 'OVERLAP',
          severity: 'hard',
          penalty: problem.weights.overlap,
          shiftIds: [prior.id, shift.id],
        },
        () => `${acc.name} is double-booked on ${prior.label} and ${shift.label}`,
      );
    } else if (previous) {
      const restMinutes = (shift.startMs - previous.endMs) / 60_000;
      if (restMinutes < minRestMinutes) {
        const prior = previous;
        const shortfall = minRestMinutes - restMinutes;
        penalize(
          acc,
          {
            constraint: 'MIN_REST',
            severity: 'hard',
            penalty: problem.weights.minRest * hoursUp(shortfall),
            shiftIds: [prior.id, shift.id],
          },
          () =>
            `${acc.name} gets ${fmtHours(restMinutes)} rest between ${prior.label} and ` +
            `${shift.label} (minimum ${employee.contract.minRestHours}h)`,
        );
      }
    }
    if (!previous || shift.endMs > previous.endMs) previous = shift;
  }
}

function checkDays(problem: CompiledProblem, e: number, shifts: CompiledShift[], acc: Accumulator) {
  const employee = problem.employees[e];
  if (!employee) return;
  const perDay = new Array<number>(ROSTER_DAYS).fill(0);
  for (const shift of shifts) perDay[shift.dayIndex] = (perDay[shift.dayIndex] ?? 0) + 1;

  perDay.forEach((count, day) => {
    const extra = count - employee.contract.maxShiftsPerDay;
    if (extra > 0) {
      penalize(
        acc,
        {
          constraint: 'MAX_SHIFTS_PER_DAY',
          severity: 'hard',
          penalty: problem.weights.maxShiftsPerDay * extra,
          shiftIds: shifts.filter((s) => s.dayIndex === day).map((s) => s.id),
        },
        () =>
          `${acc.name} works ${count} shifts on day ${day + 1} (max ${employee.contract.maxShiftsPerDay})`,
      );
    }
  });

  let run = 0;
  for (let day = 0; day <= ROSTER_DAYS; day += 1) {
    if (day < ROSTER_DAYS && (perDay[day] ?? 0) > 0) {
      run += 1;
      continue;
    }
    const extra = run - employee.contract.maxConsecutiveDays;
    if (extra > 0) {
      const length = run;
      penalize(
        acc,
        {
          constraint: 'MAX_CONSECUTIVE_DAYS',
          severity: 'hard',
          penalty: problem.weights.maxConsecutiveDays * extra,
          shiftIds: [],
        },
        () =>
          `${acc.name} works ${length} consecutive days (max ${employee.contract.maxConsecutiveDays})`,
      );
    }
    run = 0;
  }

  const workedOff = new Set(
    shifts.filter((s) => employee.preferredDaysOff.has(s.isoWeekday)).map((s) => s.localDate),
  );
  for (const date of workedOff) {
    penalize(
      acc,
      {
        constraint: 'DAY_OFF_PREFERENCE',
        severity: 'soft',
        penalty: problem.weights.dayOffPreference,
        shiftIds: shifts.filter((s) => s.localDate === date).map((s) => s.id),
      },
      () => `${acc.name} prefers ${date} off`,
    );
  }
}

function checkHours(
  problem: CompiledProblem,
  e: number,
  shifts: CompiledShift[],
  acc: Accumulator,
) {
  const employee = problem.employees[e];
  if (!employee) return { minutes: 0, overtimeMinutes: 0 };
  const { contract } = employee;
  const minutes = shifts.reduce((sum, s) => sum + s.minutes, 0);
  const over = minutes - contract.maxHoursPerWeek * 60;
  if (over > 0) {
    penalize(
      acc,
      {
        constraint: 'MAX_HOURS',
        severity: 'hard',
        penalty: problem.weights.maxHours * hoursUp(over),
        shiftIds: [],
      },
      () => `${acc.name} is scheduled ${fmtHours(minutes)} (max ${contract.maxHoursPerWeek}h)`,
    );
  }
  const under = contract.minHoursPerWeek * 60 - minutes;
  if (under > 0) {
    penalize(
      acc,
      {
        constraint: 'MIN_HOURS',
        severity: 'soft',
        penalty: problem.weights.minHours * hoursUp(under),
        shiftIds: [],
      },
      () =>
        `${acc.name} is scheduled ${fmtHours(minutes)} (contracted minimum ${contract.minHoursPerWeek}h)`,
    );
  }
  const overtimeMinutes = Math.max(0, minutes - contract.overtimeAfterHours * 60);
  if (overtimeMinutes > 0) {
    penalize(
      acc,
      {
        constraint: 'OVERTIME',
        severity: 'soft',
        penalty: problem.weights.overtime * hoursUp(overtimeMinutes),
        shiftIds: [],
      },
      () => `${acc.name} has ${fmtHours(overtimeMinutes)} overtime`,
    );
  }
  if (employee.avoidNights) {
    for (const shift of shifts.filter((s) => s.isNight)) {
      penalize(
        acc,
        {
          constraint: 'AVOID_NIGHTS',
          severity: 'soft',
          penalty: problem.weights.avoidNights,
          shiftIds: [shift.id],
        },
        () => `${acc.name} prefers not to work nights (${shift.label})`,
      );
    }
  }
  return { minutes, overtimeMinutes };
}

/**
 * Scores every employee-local rule for one employee given the slots they hold.
 * When `sink` is supplied, human-readable violations are appended to it.
 */
export function scoreEmployee(
  problem: CompiledProblem,
  employeeIndex: number,
  slotIndexes: readonly number[],
  sink?: Violation[],
): EmployeeScore {
  const employee = problem.employees[employeeIndex];
  if (!employee) return EMPTY_EMPLOYEE_SCORE;
  const shifts = slotIndexes
    .map((slot) => problem.shifts[problem.slots[slot]?.shiftIndex ?? -1])
    .filter((s): s is CompiledShift => s !== undefined)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.index - b.index);
  const acc: Accumulator = {
    hard: 0,
    soft: 0,
    sink,
    employeeId: employee.id,
    name: employee.name,
  };
  checkStatic(problem, employeeIndex, shifts, acc);
  checkSequence(problem, employeeIndex, shifts, acc);
  checkDays(problem, employeeIndex, shifts, acc);
  const { minutes, overtimeMinutes } = checkHours(problem, employeeIndex, shifts, acc);
  const rate = employee.hourlyRateMinor;
  const costMinor = Math.round((rate * minutes) / 60 + (0.5 * rate * overtimeMinutes) / 60);
  return { hard: acc.hard, soft: acc.soft, minutes, overtimeMinutes, costMinor };
}
