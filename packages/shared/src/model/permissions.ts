/** Role-based permissions (RBAC skeleton). Roles map to fixed permission sets. */
export const ROLES = ['owner', 'admin', 'scheduler', 'manager', 'employee'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'org:manage',
  'users:manage',
  'employees:read',
  'employees:write',
  'skills:write',
  'rosters:read',
  'rosters:write',
  'rosters:solve',
  'rosters:publish',
  'timeoff:approve',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const SCHEDULER: readonly Permission[] = [
  'employees:read',
  'employees:write',
  'skills:write',
  'rosters:read',
  'rosters:write',
  'rosters:solve',
  'rosters:publish',
  'timeoff:approve',
];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS.filter((p) => p !== 'org:manage'),
  scheduler: SCHEDULER,
  manager: ['employees:read', 'rosters:read', 'timeoff:approve', 'audit:read'],
  employee: ['rosters:read'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
