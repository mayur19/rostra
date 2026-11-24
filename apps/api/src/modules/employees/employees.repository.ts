import type { EmployeeCreateInput, Preferences, SkillGrant, Unavailability } from '@rostra/shared';
import type { Queryable } from '../../db/pool.js';
import { resolveSkillIds } from '../skills/skills.repository.js';

export interface EmployeeDto {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly hourlyRateMinor: number;
  readonly contract: {
    readonly minHoursPerWeek: number;
    readonly maxHoursPerWeek: number;
    readonly overtimeAfterHours: number;
    readonly maxConsecutiveDays: number;
    readonly minRestHours: number;
    readonly maxShiftsPerDay: number;
  };
  readonly skills: readonly SkillGrant[];
  readonly unavailability: readonly Unavailability[];
  readonly preferences: Preferences;
  readonly version: number;
}

interface EmployeeRow {
  id: string;
  name: string;
  email: string | null;
  hourly_rate_minor: number;
  min_hours_per_week: string;
  max_hours_per_week: string;
  overtime_after_hours: string;
  max_consecutive_days: number;
  min_rest_hours: string;
  max_shifts_per_day: number;
  preferred_days_off: number[];
  avoid_nights: boolean;
  version: number;
  skills: { skill: string; expiresOn: string | null }[];
  unavailability: { start: string; end: string; reason: Unavailability['reason'] }[];
}

const SELECT_EMPLOYEE = `
  SELECT e.id, e.name, e.email, e.hourly_rate_minor, e.min_hours_per_week, e.max_hours_per_week,
         e.overtime_after_hours, e.max_consecutive_days, e.min_rest_hours, e.max_shifts_per_day,
         e.preferred_days_off, e.avoid_nights, e.version,
         COALESCE((SELECT json_agg(json_build_object('skill', s.code, 'expiresOn', to_char(es.expires_on, 'YYYY-MM-DD'))
                                ORDER BY s.code)
                     FROM employee_skills es JOIN skills s ON s.id = es.skill_id
                    WHERE es.employee_id = e.id), '[]'::json) AS skills,
         COALESCE((SELECT json_agg(json_build_object(
                             'start', to_char(lower(u.period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                             'end', to_char(upper(u.period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                             'reason', u.reason) ORDER BY lower(u.period))
                     FROM employee_unavailability u WHERE u.employee_id = e.id), '[]'::json) AS unavailability
    FROM employees e`;

function toDto(row: EmployeeRow): EmployeeDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    hourlyRateMinor: Number(row.hourly_rate_minor),
    contract: {
      minHoursPerWeek: Number(row.min_hours_per_week),
      maxHoursPerWeek: Number(row.max_hours_per_week),
      overtimeAfterHours: Number(row.overtime_after_hours),
      maxConsecutiveDays: row.max_consecutive_days,
      minRestHours: Number(row.min_rest_hours),
      maxShiftsPerDay: row.max_shifts_per_day,
    },
    skills: row.skills,
    unavailability: row.unavailability,
    preferences: { preferredDaysOff: row.preferred_days_off, avoidNights: row.avoid_nights },
    version: row.version,
  };
}

export async function listEmployees(
  db: Queryable,
  organizationId: string,
  page: { limit: number; offset: number },
): Promise<{ items: EmployeeDto[]; total: number }> {
  const [{ rows }, count] = await Promise.all([
    db.query<EmployeeRow>(
      `${SELECT_EMPLOYEE} WHERE e.organization_id = $1 AND e.archived_at IS NULL
        ORDER BY e.name, e.id LIMIT $2 OFFSET $3`,
      [organizationId, page.limit, page.offset],
    ),
    db.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM employees WHERE organization_id = $1 AND archived_at IS NULL',
      [organizationId],
    ),
  ]);
  return { items: rows.map(toDto), total: count.rows[0]?.total ?? 0 };
}

/** All active employees of a tenant, used to build solver problems. */
export async function listAllEmployees(
  db: Queryable,
  organizationId: string,
): Promise<EmployeeDto[]> {
  const { rows } = await db.query<EmployeeRow>(
    `${SELECT_EMPLOYEE} WHERE e.organization_id = $1 AND e.archived_at IS NULL ORDER BY e.name, e.id`,
    [organizationId],
  );
  return rows.map(toDto);
}

export async function findEmployee(
  db: Queryable,
  organizationId: string,
  id: string,
): Promise<EmployeeDto | null> {
  const { rows } = await db.query<EmployeeRow>(
    `${SELECT_EMPLOYEE} WHERE e.organization_id = $1 AND e.id = $2 AND e.archived_at IS NULL`,
    [organizationId, id],
  );
  return rows[0] ? toDto(rows[0]) : null;
}

async function replaceSkills(
  db: Queryable,
  organizationId: string,
  employeeId: string,
  skills: readonly SkillGrant[],
): Promise<void> {
  const ids = await resolveSkillIds(
    db,
    organizationId,
    skills.map((s) => s.skill),
  );
  await db.query('DELETE FROM employee_skills WHERE employee_id = $1', [employeeId]);
  for (const grant of skills) {
    await db.query(
      `INSERT INTO employee_skills (employee_id, skill_id, expires_on) VALUES ($1, $2, $3)
       ON CONFLICT (employee_id, skill_id) DO UPDATE SET expires_on = EXCLUDED.expires_on`,
      [employeeId, ids.get(grant.skill), grant.expiresOn],
    );
  }
}

async function replaceUnavailability(
  db: Queryable,
  employeeId: string,
  periods: readonly Unavailability[],
): Promise<void> {
  await db.query('DELETE FROM employee_unavailability WHERE employee_id = $1', [employeeId]);
  for (const period of periods) {
    await db.query(
      `INSERT INTO employee_unavailability (employee_id, period, reason)
       VALUES ($1, tstzrange($2::timestamptz, $3::timestamptz, '[)'), $4)`,
      [employeeId, period.start, period.end, period.reason],
    );
  }
}

export async function insertEmployee(
  db: Queryable,
  organizationId: string,
  input: EmployeeCreateInput,
): Promise<string> {
  const c = input.contract;
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO employees (organization_id, name, email, hourly_rate_minor, min_hours_per_week,
       max_hours_per_week, overtime_after_hours, max_consecutive_days, min_rest_hours,
       max_shifts_per_day, preferred_days_off, avoid_nights)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [
      organizationId,
      input.name,
      input.email,
      input.hourlyRateMinor,
      c.minHoursPerWeek,
      c.maxHoursPerWeek,
      c.overtimeAfterHours,
      c.maxConsecutiveDays,
      c.minRestHours,
      c.maxShiftsPerDay,
      input.preferences.preferredDaysOff,
      input.preferences.avoidNights,
    ],
  );
  const id = (rows[0] as { id: string }).id;
  await replaceSkills(db, organizationId, id, input.skills);
  await replaceUnavailability(db, id, input.unavailability);
  return id;
}

/** Applies a merged (already complete) employee state and bumps the version. */
export async function updateEmployee(
  db: Queryable,
  organizationId: string,
  id: string,
  next: EmployeeCreateInput,
): Promise<void> {
  const c = next.contract;
  await db.query(
    `UPDATE employees SET name = $3, email = $4, hourly_rate_minor = $5, min_hours_per_week = $6,
       max_hours_per_week = $7, overtime_after_hours = $8, max_consecutive_days = $9,
       min_rest_hours = $10, max_shifts_per_day = $11, preferred_days_off = $12,
       avoid_nights = $13, version = version + 1, updated_at = now()
     WHERE organization_id = $1 AND id = $2`,
    [
      organizationId,
      id,
      next.name,
      next.email,
      next.hourlyRateMinor,
      c.minHoursPerWeek,
      c.maxHoursPerWeek,
      c.overtimeAfterHours,
      c.maxConsecutiveDays,
      c.minRestHours,
      c.maxShiftsPerDay,
      next.preferences.preferredDaysOff,
      next.preferences.avoidNights,
    ],
  );
  await replaceSkills(db, organizationId, id, next.skills);
  await replaceUnavailability(db, id, next.unavailability);
}
