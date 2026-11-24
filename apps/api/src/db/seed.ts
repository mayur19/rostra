import {
  WARD_TEMPLATES,
  addDays,
  employeeCreateSchema,
  expandTemplates,
  generateWardProblem,
  isoWeekday,
  localDateKey,
} from '@rostra/shared';
import type { Logger } from 'pino';
import { hashPassword } from '../security/password.js';
import { insertEmployee } from '../modules/employees/employees.repository.js';
import { withTransaction, type Db } from './pool.js';

export const DEMO_TIMEZONE = 'America/New_York';
export const DEMO_USERS = [
  { email: 'owner@rostra.test', name: 'Olivia Owner', role: 'owner' },
  { email: 'scheduler@rostra.test', name: 'Sasha Scheduler', role: 'scheduler' },
  { email: 'manager@rostra.test', name: 'Malik Manager', role: 'manager' },
] as const;
/** Development-only credential, documented in README; never used outside local seeds. */
export const DEMO_PASSWORD = 'rostra-demo-password';

const SKILLS = [
  { code: 'RN', name: 'Registered Nurse' },
  { code: 'CNA', name: 'Certified Nursing Assistant' },
  { code: 'CHARGE', name: 'Charge Nurse' },
];

/** Monday of the week after `now` in the demo zone. */
export function nextMonday(now: number = Date.now()): string {
  const today = localDateKey(now, DEMO_TIMEZONE);
  return addDays(today, 8 - isoWeekday(today));
}

export async function seed(db: Db, logger: Logger): Promise<void> {
  const weekStart = nextMonday();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const ward = generateWardProblem({ seed: 7, employees: 20, weekStart, timezone: DEMO_TIMEZONE });

  await withTransaction(db, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      'INSERT INTO organizations (name, timezone) VALUES ($1, $2) RETURNING id',
      ['St. Jude General - Ward 4B', DEMO_TIMEZONE],
    );
    const orgId = (rows[0] as { id: string }).id;
    let ownerId = '';
    for (const user of DEMO_USERS) {
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO users (organization_id, email, name, password_hash, role)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [orgId, user.email, user.name, passwordHash, user.role],
      );
      if (user.role === 'owner') ownerId = (inserted.rows[0] as { id: string }).id;
    }
    const skillIds = new Map<string, string>();
    for (const skill of SKILLS) {
      const inserted = await tx.query<{ id: string }>(
        'INSERT INTO skills (organization_id, code, name) VALUES ($1, $2, $3) RETURNING id',
        [orgId, skill.code, skill.name],
      );
      skillIds.set(skill.code, (inserted.rows[0] as { id: string }).id);
    }
    for (const e of ward.employees) {
      await insertEmployee(tx, orgId, employeeCreateSchema.parse({ ...e, email: null }));
    }
    const roster = await tx.query<{ id: string }>(
      `INSERT INTO rosters (organization_id, name, week_start, timezone, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [orgId, `Ward 4B week of ${weekStart}`, weekStart, DEMO_TIMEZONE, ownerId],
    );
    const rosterId = (roster.rows[0] as { id: string }).id;
    for (const shift of expandTemplates(weekStart, DEMO_TIMEZONE, WARD_TEMPLATES)) {
      await tx.query(
        `INSERT INTO shifts (roster_id, skill_id, label, starts_at, ends_at, headcount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [rosterId, skillIds.get(shift.skill), shift.label, shift.start, shift.end, shift.headcount],
      );
    }
  });
  logger.info({ weekStart, employees: ward.employees.length }, 'seeded demo ward');
}
