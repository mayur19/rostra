import type { Queryable } from '../../db/pool.js';
import { validationFailed } from '../../http/errors.js';

export interface SkillRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export async function listSkills(db: Queryable, organizationId: string): Promise<SkillRecord[]> {
  const { rows } = await db.query<SkillRecord>(
    'SELECT id, code, name FROM skills WHERE organization_id = $1 ORDER BY code',
    [organizationId],
  );
  return rows;
}

export async function insertSkill(
  db: Queryable,
  organizationId: string,
  skill: { code: string; name: string },
): Promise<SkillRecord> {
  const { rows } = await db.query<SkillRecord>(
    'INSERT INTO skills (organization_id, code, name) VALUES ($1, $2, $3) RETURNING id, code, name',
    [organizationId, skill.code, skill.name],
  );
  return rows[0] as SkillRecord;
}

/** Resolves skill codes to ids within the tenant; unknown codes are a validation error. */
export async function resolveSkillIds(
  db: Queryable,
  organizationId: string,
  codes: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(codes)];
  if (unique.length === 0) return new Map();
  const { rows } = await db.query<{ id: string; code: string }>(
    'SELECT id, code FROM skills WHERE organization_id = $1 AND code = ANY($2::text[])',
    [organizationId, unique],
  );
  const map = new Map(rows.map((r) => [r.code, r.id] as const));
  const missing = unique.filter((code) => !map.has(code));
  if (missing.length > 0) {
    throw validationFailed(
      missing.map((code) => ({ path: 'skill', message: `Unknown skill ${code}` })),
    );
  }
  return map;
}
