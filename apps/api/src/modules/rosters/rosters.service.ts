import {
  ROSTER_DAYS,
  daysBetween,
  evaluateAssignments,
  localDateKey,
  solve,
  type AssignmentInput,
  type Evaluation,
  type ProblemInput,
  type ShiftCreateInput,
  type SolveRequest,
} from '@rostra/shared';
import { withTransaction, type Queryable } from '../../db/pool.js';
import type { AppDeps, AuthContext } from '../../http/context.js';
import { conflict, notFound, validationFailed } from '../../http/errors.js';
import { recordAudit } from '../audit/audit.service.js';
import { listAllEmployees, type EmployeeDto } from '../employees/employees.repository.js';
import { resolveSkillIds } from '../skills/skills.repository.js';
import * as repo from './rosters.repository.js';

export interface ScheduleView {
  readonly roster: repo.RosterDto;
  readonly shifts: readonly repo.ShiftDto[];
  readonly employees: readonly Pick<EmployeeDto, 'id' | 'name' | 'skills' | 'contract'>[];
  readonly assignments: readonly repo.AssignmentDto[];
  readonly evaluation: Evaluation;
}

export async function requireRoster(
  db: Queryable,
  auth: AuthContext,
  rosterId: string,
  options: { forUpdate?: boolean } = {},
): Promise<repo.RosterDto> {
  const roster = await repo.findRoster(db, auth.organizationId, rosterId, options);
  if (!roster) throw notFound('Roster');
  return roster;
}

function requireDraft(roster: repo.RosterDto): void {
  if (roster.status !== 'draft')
    throw conflict(`Roster is ${roster.status}; only drafts can change`);
}

function toProblem(
  roster: repo.RosterDto,
  shifts: readonly repo.ShiftDto[],
  employees: readonly EmployeeDto[],
  pinned: readonly AssignmentInput[],
): ProblemInput {
  return {
    timezone: roster.timezone,
    weekStart: roster.weekStart,
    shifts,
    pinned,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      hourlyRateMinor: e.hourlyRateMinor,
      skills: e.skills,
      contract: e.contract,
      unavailability: e.unavailability,
      preferences: e.preferences,
    })),
  };
}

async function loadContext(db: Queryable, auth: AuthContext, roster: repo.RosterDto) {
  const [shifts, employees, assignments] = await Promise.all([
    repo.listShifts(db, roster.id),
    listAllEmployees(db, auth.organizationId),
    repo.listAssignments(db, roster.id),
  ]);
  return { shifts, employees, assignments };
}

export async function getSchedule(
  db: Queryable,
  auth: AuthContext,
  rosterId: string,
): Promise<ScheduleView> {
  const roster = await requireRoster(db, auth, rosterId);
  const { shifts, employees, assignments } = await loadContext(db, auth, roster);
  return {
    roster,
    shifts,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      skills: e.skills,
      contract: e.contract,
    })),
    assignments,
    evaluation: evaluateAssignments(toProblem(roster, shifts, employees, []), assignments),
  };
}

export async function addShift(
  deps: AppDeps,
  auth: AuthContext,
  rosterId: string,
  input: ShiftCreateInput,
  requestId: string,
): Promise<repo.ShiftDto> {
  return withTransaction(deps.db, async (tx) => {
    const roster = await requireRoster(tx, auth, rosterId, { forUpdate: true });
    requireDraft(roster);
    const day = daysBetween(
      roster.weekStart,
      localDateKey(Date.parse(input.start), roster.timezone),
    );
    if (day < 0 || day >= ROSTER_DAYS) {
      throw validationFailed([
        { path: 'start', message: 'Shift must start within the roster week' },
      ]);
    }
    const skills = await resolveSkillIds(tx, auth.organizationId, [input.skill]);
    const id = await repo.insertShift(tx, roster.id, skills.get(input.skill) as string, input);
    await repo.bumpRosterVersion(tx, roster.id);
    await recordAudit(tx, {
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action: 'shift.created',
      entityType: 'shift',
      entityId: id,
      requestId,
      details: { rosterId: roster.id },
    });
    const shifts = await repo.listShifts(tx, roster.id);
    return shifts.find((s) => s.id === id) as repo.ShiftDto;
  });
}

export async function removeShift(
  deps: AppDeps,
  auth: AuthContext,
  rosterId: string,
  shiftId: string,
  requestId: string,
): Promise<void> {
  await withTransaction(deps.db, async (tx) => {
    const roster = await requireRoster(tx, auth, rosterId, { forUpdate: true });
    requireDraft(roster);
    if (!(await repo.deleteShift(tx, roster.id, shiftId))) throw notFound('Shift');
    await repo.bumpRosterVersion(tx, roster.id);
    await recordAudit(tx, {
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action: 'shift.deleted',
      entityType: 'shift',
      entityId: shiftId,
      requestId,
      details: { rosterId: roster.id },
    });
  });
}

/**
 * Runs the solver synchronously while holding the roster row lock, so concurrent solves
 * or edits of the same roster serialize instead of interleaving assignment writes.
 */
export async function solveRoster(
  deps: AppDeps,
  auth: AuthContext,
  rosterId: string,
  request: SolveRequest,
  requestId: string,
): Promise<{ run: repo.SolverRunDto; schedule: ScheduleView }> {
  const iterations = Math.min(request.iterations, deps.config.SOLVER_MAX_ITERATIONS);
  const run = await withTransaction(deps.db, async (tx) => {
    const roster = await requireRoster(tx, auth, rosterId, { forUpdate: true });
    requireDraft(roster);
    const { shifts, employees, assignments } = await loadContext(tx, auth, roster);
    const pinned = request.keepPinned ? assignments.filter((a) => a.pinned) : [];
    const result = solve(toProblem(roster, shifts, employees, pinned), {
      seed: request.seed,
      iterations,
    });

    const solverRun = await repo.insertSolverRun(tx, {
      rosterId: roster.id,
      requestedBy: auth.userId,
      seed: request.seed,
      iterations: result.stats.iterations,
      hardScore: result.evaluation.score.hard,
      softScore: result.evaluation.score.soft,
      greedyHard: result.stats.greedyScore.hard,
      greedySoft: result.stats.greedyScore.soft,
      coverageRatio: result.evaluation.metrics.coverageRatio,
      elapsedMs: result.stats.elapsedMs,
      stats: { accepted: result.stats.accepted, improvements: result.stats.improvements },
    });
    await repo.deleteAssignments(tx, roster.id, { keepPinned: request.keepPinned });
    const pinnedKeys = new Set(pinned.map((p) => `${p.shiftId}|${p.employeeId}`));
    await repo.insertAssignments(
      tx,
      result.assignments
        .filter((a) => !pinnedKeys.has(`${a.shiftId}|${a.employeeId}`))
        .map((a) => ({
          ...a,
          pinned: false,
          source: 'solver' as const,
          solverRunId: solverRun.id,
        })),
    );
    await repo.bumpRosterVersion(tx, roster.id);
    await recordAudit(tx, {
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action: 'roster.solved',
      entityType: 'roster',
      entityId: roster.id,
      requestId,
      details: {
        solverRunId: solverRun.id,
        seed: request.seed,
        iterations,
        score: result.evaluation.score,
      },
    });
    return solverRun;
  });
  return { run, schedule: await getSchedule(deps.db, auth, rosterId) };
}

export async function evaluateProposal(
  db: Queryable,
  auth: AuthContext,
  rosterId: string,
  proposal: readonly AssignmentInput[],
): Promise<Evaluation> {
  const roster = await requireRoster(db, auth, rosterId);
  const { shifts, employees } = await loadContext(db, auth, roster);
  return evaluateAssignments(toProblem(roster, shifts, employees, []), proposal);
}

function assertUnique(assignments: readonly AssignmentInput[]): void {
  const seen = new Set<string>();
  for (const a of assignments) {
    const key = `${a.shiftId}|${a.employeeId}`;
    if (seen.has(key)) {
      throw validationFailed([
        { path: 'assignments', message: `Employee assigned twice to shift ${a.shiftId}` },
      ]);
    }
    seen.add(key);
  }
}

/** Replaces the roster's assignments with a manually edited set (pins preserved per row). */
export async function replaceAssignments(
  deps: AppDeps,
  auth: AuthContext,
  rosterId: string,
  assignments: readonly (AssignmentInput & { pinned: boolean })[],
  requestId: string,
): Promise<ScheduleView> {
  assertUnique(assignments);
  await withTransaction(deps.db, async (tx) => {
    const roster = await requireRoster(tx, auth, rosterId, { forUpdate: true });
    requireDraft(roster);
    const { shifts, employees } = await loadContext(tx, auth, roster);
    // Validates ids and headcount; throws ProblemValidationError (422) on bad input.
    evaluateAssignments(toProblem(roster, shifts, employees, []), assignments);
    await repo.deleteAssignments(tx, roster.id, { keepPinned: false });
    await repo.insertAssignments(
      tx,
      assignments.map((a) => ({ ...a, source: 'manual' as const, solverRunId: null })),
    );
    await repo.bumpRosterVersion(tx, roster.id);
    await recordAudit(tx, {
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action: 'roster.assignments_replaced',
      entityType: 'roster',
      entityId: roster.id,
      requestId,
      details: { count: assignments.length, pinned: assignments.filter((a) => a.pinned).length },
    });
  });
  return getSchedule(deps.db, auth, rosterId);
}
