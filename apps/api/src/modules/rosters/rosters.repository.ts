import type { Queryable } from '../../db/pool.js';

export interface RosterDto {
  readonly id: string;
  readonly name: string;
  readonly weekStart: string;
  readonly timezone: string;
  readonly status: 'draft' | 'published' | 'archived';
  readonly version: number;
  readonly shiftCount: number;
  readonly createdAt: string;
}

export interface ShiftDto {
  readonly id: string;
  readonly label: string;
  readonly start: string;
  readonly end: string;
  readonly skill: string;
  readonly headcount: number;
}

export interface AssignmentDto {
  readonly shiftId: string;
  readonly employeeId: string;
  readonly pinned: boolean;
  readonly source: 'solver' | 'manual';
}

export interface SolverRunDto {
  readonly id: string;
  readonly seed: number;
  readonly iterations: number;
  readonly hardScore: number;
  readonly softScore: number;
  readonly greedyHard: number;
  readonly greedySoft: number;
  readonly coverageRatio: number;
  readonly elapsedMs: number;
  readonly createdAt: string;
}

const ISO = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;
const ROSTER_COLUMNS = `r.id, r.name, to_char(r.week_start, 'YYYY-MM-DD') AS "weekStart", r.timezone,
  r.status, r.version, r.created_at AS "createdAt",
  (SELECT count(*)::int FROM shifts s WHERE s.roster_id = r.id) AS "shiftCount"`;

export async function listRosters(db: Queryable, organizationId: string): Promise<RosterDto[]> {
  const { rows } = await db.query<RosterDto>(
    `SELECT ${ROSTER_COLUMNS} FROM rosters r WHERE r.organization_id = $1
      ORDER BY r.week_start DESC, r.created_at DESC LIMIT 200`,
    [organizationId],
  );
  return rows;
}

export async function findRoster(
  db: Queryable,
  organizationId: string,
  id: string,
  options: { forUpdate?: boolean } = {},
): Promise<RosterDto | null> {
  const lock = options.forUpdate ? 'FOR UPDATE OF r' : '';
  const { rows } = await db.query<RosterDto>(
    `SELECT ${ROSTER_COLUMNS} FROM rosters r WHERE r.organization_id = $1 AND r.id = $2 ${lock}`,
    [organizationId, id],
  );
  return rows[0] ?? null;
}

export async function insertRoster(
  db: Queryable,
  organizationId: string,
  userId: string,
  roster: { name: string; weekStart: string; timezone: string },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO rosters (organization_id, name, week_start, timezone, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [organizationId, roster.name, roster.weekStart, roster.timezone, userId],
  );
  return (rows[0] as { id: string }).id;
}

export async function bumpRosterVersion(db: Queryable, rosterId: string): Promise<void> {
  await db.query('UPDATE rosters SET version = version + 1, updated_at = now() WHERE id = $1', [
    rosterId,
  ]);
}

export async function listShifts(db: Queryable, rosterId: string): Promise<ShiftDto[]> {
  const { rows } = await db.query<ShiftDto>(
    `SELECT s.id, s.label, to_char(s.starts_at AT TIME ZONE 'UTC', ${ISO}) AS start,
            to_char(s.ends_at AT TIME ZONE 'UTC', ${ISO}) AS "end", k.code AS skill, s.headcount
       FROM shifts s JOIN skills k ON k.id = s.skill_id
      WHERE s.roster_id = $1 ORDER BY s.starts_at, s.label, s.id`,
    [rosterId],
  );
  return rows;
}

export async function insertShift(
  db: Queryable,
  rosterId: string,
  skillId: string,
  shift: { label: string; start: string; end: string; headcount: number },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO shifts (roster_id, skill_id, label, starts_at, ends_at, headcount)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [rosterId, skillId, shift.label, shift.start, shift.end, shift.headcount],
  );
  return (rows[0] as { id: string }).id;
}

export async function deleteShift(
  db: Queryable,
  rosterId: string,
  shiftId: string,
): Promise<boolean> {
  const result = await db.query('DELETE FROM shifts WHERE roster_id = $1 AND id = $2', [
    rosterId,
    shiftId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function listAssignments(db: Queryable, rosterId: string): Promise<AssignmentDto[]> {
  const { rows } = await db.query<AssignmentDto>(
    `SELECT a.shift_id AS "shiftId", a.employee_id AS "employeeId", a.pinned, a.source
       FROM assignments a JOIN shifts s ON s.id = a.shift_id
      WHERE s.roster_id = $1 ORDER BY s.starts_at, a.created_at, a.id`,
    [rosterId],
  );
  return rows;
}

export async function deleteAssignments(
  db: Queryable,
  rosterId: string,
  options: { keepPinned: boolean },
): Promise<void> {
  await db.query(
    `DELETE FROM assignments a USING shifts s
      WHERE s.id = a.shift_id AND s.roster_id = $1 AND ($2::boolean IS FALSE OR a.pinned IS FALSE)`,
    [rosterId, options.keepPinned],
  );
}

export async function insertAssignments(
  db: Queryable,
  rows: readonly {
    shiftId: string;
    employeeId: string;
    pinned: boolean;
    source: 'solver' | 'manual';
    solverRunId: string | null;
  }[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.query(
    `INSERT INTO assignments (shift_id, employee_id, pinned, source, solver_run_id)
     SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::boolean[], $4::text[], $5::uuid[])`,
    [
      rows.map((r) => r.shiftId),
      rows.map((r) => r.employeeId),
      rows.map((r) => r.pinned),
      rows.map((r) => r.source),
      rows.map((r) => r.solverRunId),
    ],
  );
}

const SOLVER_RUN_COLUMNS = `id, seed, iterations, hard_score AS "hardScore", soft_score AS "softScore",
  greedy_hard AS "greedyHard", greedy_soft AS "greedySoft", coverage_ratio::float8 AS "coverageRatio",
  elapsed_ms AS "elapsedMs", created_at AS "createdAt"`;

export async function insertSolverRun(
  db: Queryable,
  run: Omit<SolverRunDto, 'id' | 'createdAt'> & {
    rosterId: string;
    requestedBy: string;
    stats: object;
  },
): Promise<SolverRunDto> {
  const { rows } = await db.query<SolverRunDto>(
    `INSERT INTO solver_runs (roster_id, requested_by, seed, iterations, hard_score, soft_score,
       greedy_hard, greedy_soft, coverage_ratio, elapsed_ms, stats)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${SOLVER_RUN_COLUMNS}`,
    [
      run.rosterId,
      run.requestedBy,
      run.seed,
      run.iterations,
      run.hardScore,
      run.softScore,
      run.greedyHard,
      run.greedySoft,
      run.coverageRatio,
      run.elapsedMs,
      JSON.stringify(run.stats),
    ],
  );
  return rows[0] as SolverRunDto;
}

export async function listSolverRuns(db: Queryable, rosterId: string): Promise<SolverRunDto[]> {
  const { rows } = await db.query<SolverRunDto>(
    `SELECT ${SOLVER_RUN_COLUMNS} FROM solver_runs WHERE roster_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [rosterId],
  );
  return rows;
}
