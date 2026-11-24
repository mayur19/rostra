/** Domain types for the scheduling problem. All structures are read-only values. */

export type Severity = 'hard' | 'soft';

export interface SkillGrant {
  readonly skill: string;
  /** Last local date (YYYY-MM-DD) on which the certification is valid; null = no expiry. */
  readonly expiresOn: string | null;
}

export interface Contract {
  readonly minHoursPerWeek: number;
  readonly maxHoursPerWeek: number;
  /** Hours after which overtime premium applies within the roster week. */
  readonly overtimeAfterHours: number;
  readonly maxConsecutiveDays: number;
  readonly minRestHours: number;
  readonly maxShiftsPerDay: number;
}

export interface Unavailability {
  /** ISO-8601 instant (inclusive). */
  readonly start: string;
  /** ISO-8601 instant (exclusive). */
  readonly end: string;
  readonly reason: 'time_off' | 'unavailable';
}

export interface Preferences {
  /** ISO weekdays (1 = Monday ... 7 = Sunday) the employee would rather not work. */
  readonly preferredDaysOff: readonly number[];
  readonly avoidNights: boolean;
}

export interface EmployeeInput {
  readonly id: string;
  readonly name: string;
  readonly hourlyRateMinor: number;
  readonly skills: readonly SkillGrant[];
  readonly contract: Contract;
  readonly unavailability: readonly Unavailability[];
  readonly preferences: Preferences;
}

export interface ShiftInput {
  readonly id: string;
  readonly label: string;
  /** ISO-8601 instant. */
  readonly start: string;
  /** ISO-8601 instant, strictly after start. */
  readonly end: string;
  readonly skill: string;
  readonly headcount: number;
}

export interface AssignmentInput {
  readonly shiftId: string;
  readonly employeeId: string;
}

export interface ConstraintWeights {
  readonly unfilled: number;
  readonly skill: number;
  readonly unavailable: number;
  readonly overlap: number;
  readonly minRest: number;
  readonly maxHours: number;
  readonly maxConsecutiveDays: number;
  readonly maxShiftsPerDay: number;
  readonly minHours: number;
  readonly dayOffPreference: number;
  readonly avoidNights: number;
  readonly overtime: number;
  readonly fairness: number;
}

export interface ProblemInput {
  readonly timezone: string;
  /** First local day (YYYY-MM-DD) of the seven-day roster period. */
  readonly weekStart: string;
  readonly employees: readonly EmployeeInput[];
  readonly shifts: readonly ShiftInput[];
  /** Assignments the solver must keep as-is (manual edits locked by a scheduler). */
  readonly pinned?: readonly AssignmentInput[];
  readonly weights?: Partial<ConstraintWeights>;
}

export interface Score {
  readonly hard: number;
  readonly soft: number;
}

export interface Violation {
  readonly constraint: ConstraintId;
  readonly severity: Severity;
  readonly penalty: number;
  readonly employeeId: string | null;
  readonly shiftIds: readonly string[];
  readonly message: string;
}

export interface EmployeeSummary {
  readonly employeeId: string;
  readonly shifts: number;
  readonly hours: number;
  readonly overtimeHours: number;
  readonly costMinor: number;
}

export interface ScheduleMetrics {
  readonly slotsTotal: number;
  readonly slotsFilled: number;
  readonly coverageRatio: number;
  readonly totalHours: number;
  readonly laborCostMinor: number;
  /** Standard deviation of (assigned hours / contracted minimum) across employees. */
  readonly utilizationStdDev: number;
}

export interface Evaluation {
  readonly score: Score;
  readonly feasible: boolean;
  readonly violations: readonly Violation[];
  readonly employees: readonly EmployeeSummary[];
  readonly metrics: ScheduleMetrics;
}

export type ConstraintId =
  | 'UNFILLED_SLOT'
  | 'SKILL_MISSING'
  | 'SKILL_EXPIRED'
  | 'UNAVAILABLE'
  | 'OVERLAP'
  | 'MIN_REST'
  | 'MAX_HOURS'
  | 'MAX_CONSECUTIVE_DAYS'
  | 'MAX_SHIFTS_PER_DAY'
  | 'MIN_HOURS'
  | 'DAY_OFF_PREFERENCE'
  | 'AVOID_NIGHTS'
  | 'OVERTIME'
  | 'FAIRNESS';
