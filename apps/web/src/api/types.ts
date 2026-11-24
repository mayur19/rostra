import type { Evaluation, SkillGrant } from '@rostra/shared';

export interface Me {
  readonly user: { id: string; email: string; name: string; role: string };
  readonly organization: { id: string; name: string; timezone: string };
  readonly permissions: readonly string[];
}

export interface Roster {
  readonly id: string;
  readonly name: string;
  readonly weekStart: string;
  readonly timezone: string;
  readonly status: string;
  readonly version: number;
  readonly shiftCount: number;
}

export interface Shift {
  readonly id: string;
  readonly label: string;
  readonly start: string;
  readonly end: string;
  readonly skill: string;
  readonly headcount: number;
}

export interface Assignment {
  readonly shiftId: string;
  readonly employeeId: string;
  readonly pinned: boolean;
  readonly source: 'solver' | 'manual';
}

export interface ScheduleEmployee {
  readonly id: string;
  readonly name: string;
  readonly skills: readonly SkillGrant[];
  readonly contract: { minHoursPerWeek: number; maxHoursPerWeek: number };
}

export interface Schedule {
  readonly roster: Roster;
  readonly shifts: readonly Shift[];
  readonly employees: readonly ScheduleEmployee[];
  readonly assignments: readonly Assignment[];
  readonly evaluation: Evaluation;
}

export interface SolverRun {
  readonly id: string;
  readonly seed: number;
  readonly iterations: number;
  readonly hardScore: number;
  readonly softScore: number;
  readonly greedyHard: number;
  readonly greedySoft: number;
  readonly elapsedMs: number;
}

export interface Employee {
  readonly id: string;
  readonly name: string;
  readonly hourlyRateMinor: number;
  readonly contract: {
    minHoursPerWeek: number;
    maxHoursPerWeek: number;
    minRestHours: number;
    maxConsecutiveDays: number;
  };
  readonly skills: readonly SkillGrant[];
}
