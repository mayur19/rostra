import type { ConstraintId, ConstraintWeights, Severity } from './types.js';

export interface ConstraintDefinition {
  readonly id: ConstraintId;
  readonly severity: Severity;
  readonly title: string;
  readonly unit: string;
}

/** Catalog of every rule the evaluator knows, used for documentation and UI legends. */
export const CONSTRAINTS: readonly ConstraintDefinition[] = [
  { id: 'UNFILLED_SLOT', severity: 'hard', title: 'Shift slot left unfilled', unit: 'slot' },
  { id: 'SKILL_MISSING', severity: 'hard', title: 'Employee lacks required skill', unit: 'shift' },
  { id: 'SKILL_EXPIRED', severity: 'hard', title: 'Certification expired', unit: 'shift' },
  { id: 'UNAVAILABLE', severity: 'hard', title: 'Assigned during time off', unit: 'shift' },
  { id: 'OVERLAP', severity: 'hard', title: 'Overlapping shifts', unit: 'pair' },
  { id: 'MIN_REST', severity: 'hard', title: 'Insufficient rest between shifts', unit: 'hour' },
  { id: 'MAX_HOURS', severity: 'hard', title: 'Weekly hour limit exceeded', unit: 'hour' },
  {
    id: 'MAX_CONSECUTIVE_DAYS',
    severity: 'hard',
    title: 'Too many consecutive working days',
    unit: 'day',
  },
  { id: 'MAX_SHIFTS_PER_DAY', severity: 'hard', title: 'Too many shifts in a day', unit: 'shift' },
  { id: 'MIN_HOURS', severity: 'soft', title: 'Below contracted minimum hours', unit: 'hour' },
  { id: 'DAY_OFF_PREFERENCE', severity: 'soft', title: 'Preferred day off worked', unit: 'day' },
  { id: 'AVOID_NIGHTS', severity: 'soft', title: 'Night shift against preference', unit: 'shift' },
  { id: 'OVERTIME', severity: 'soft', title: 'Overtime hours', unit: 'hour' },
  { id: 'FAIRNESS', severity: 'soft', title: 'Uneven distribution of hours', unit: 'index' },
];

export const DEFAULT_WEIGHTS: ConstraintWeights = {
  unfilled: 10,
  skill: 10,
  unavailable: 10,
  overlap: 10,
  minRest: 2,
  maxHours: 2,
  maxConsecutiveDays: 5,
  maxShiftsPerDay: 10,
  minHours: 4,
  dayOffPreference: 15,
  avoidNights: 10,
  overtime: 6,
  fairness: 200,
};

/** Hard penalties dominate soft penalties when scores are collapsed to one number. */
export const HARD_MULTIPLIER = 1_000_000;

export function resolveWeights(
  overrides: Partial<ConstraintWeights> | undefined,
): ConstraintWeights {
  return { ...DEFAULT_WEIGHTS, ...(overrides ?? {}) };
}
