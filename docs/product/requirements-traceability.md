# Requirements traceability

Maps each functional requirement to its epic, backlog ticket(s), implementing module(s),
automated tests and status. Paths are relative to the repository root.

| FR     | Epic | Ticket(s)              | Module(s)                                                                   | Test(s)                                                                     | Status  |
| ------ | ---- | ---------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------- |
| FR-001 | E1   | RO-010                 | apps/api/src/modules/auth                                                   | apps/api/test/auth.test.ts                                                  | done    |
| FR-002 | E1   | RO-011                 | apps/api/src/modules/auth, apps/api/src/security                            | apps/api/test/auth.test.ts                                                  | done    |
| FR-003 | E1   | RO-011                 | apps/api/src/modules/auth                                                   | apps/api/test/auth.test.ts                                                  | done    |
| FR-004 | E1   | RO-011                 | apps/api/src/modules/auth                                                   | apps/api/test/auth.test.ts                                                  | done    |
| FR-005 | E1   | RO-012                 | apps/api/src/http/auth.ts                                                   | apps/api/test/auth.test.ts                                                  | done    |
| FR-006 | E1   | RO-013                 | apps/api/src/security/rate-limiter.ts                                       | apps/api/test/auth.test.ts                                                  | done    |
| FR-007 | E1   | RO-014                 | packages/shared/src/model/permissions.ts, apps/api/src/http/auth.ts         | packages/shared/test/schemas.test.ts, apps/api/test/rosters.test.ts         | done    |
| FR-008 | E1   | RO-015                 | apps/api/src/modules/audit                                                  | apps/api/test/platform.test.ts                                              | done    |
| FR-009 | E1   | RO-101                 | organization (planned)                                                      | -                                                                           | pending |
| FR-010 | E1   | RO-102                 | users (planned)                                                             | -                                                                           | pending |
| FR-011 | E1   | RO-103                 | users (planned)                                                             | -                                                                           | pending |
| FR-012 | E1   | RO-104                 | auth (planned)                                                              | -                                                                           | pending |
| FR-013 | E1   | RO-105                 | auth (planned)                                                              | -                                                                           | pending |
| FR-014 | E1   | RO-106                 | auth (planned)                                                              | -                                                                           | pending |
| FR-020 | E2   | RO-024                 | apps/api/src/modules/skills                                                 | apps/api/test/employees.test.ts                                             | done    |
| FR-021 | E2   | RO-024                 | apps/api/src/modules/employees, packages/shared/src/model/schemas.ts        | apps/api/test/employees.test.ts, packages/shared/test/schemas.test.ts       | done    |
| FR-022 | E2   | RO-024                 | apps/api/src/modules/employees                                              | apps/api/test/employees.test.ts                                             | done    |
| FR-023 | E2   | RO-024                 | apps/api/src/modules/employees                                              | apps/api/test/employees.test.ts                                             | done    |
| FR-024 | E2   | RO-020, RO-021         | packages/shared/src/solver/problem.ts                                       | packages/shared/test/problem.test.ts, packages/shared/test/evaluate.test.ts | done    |
| FR-025 | E2   | RO-110                 | locations (planned)                                                         | -                                                                           | pending |
| FR-026 | E2   | RO-111                 | departments (planned)                                                       | -                                                                           | pending |
| FR-027 | E2   | RO-112                 | positions (planned)                                                         | -                                                                           | pending |
| FR-028 | E2   | RO-113                 | contracts (planned)                                                         | -                                                                           | pending |
| FR-029 | E2   | RO-120, RO-121         | employees                                                                   | -                                                                           | pending |
| FR-030 | E2   | RO-122                 | reports (planned)                                                           | -                                                                           | pending |
| FR-040 | E3   | RO-020                 | packages/shared/src/model/templates.ts, packages/shared/src/time/zoned.ts   | packages/shared/test/templates.test.ts, packages/shared/test/zoned.test.ts  | done    |
| FR-041 | E3   | RO-150, RO-151         | shift-templates (planned)                                                   | -                                                                           | pending |
| FR-042 | E3   | RO-141                 | forecasting (planned)                                                       | -                                                                           | pending |
| FR-043 | E3   | RO-140                 | forecasting (planned)                                                       | -                                                                           | pending |
| FR-044 | E3   | RO-142                 | coverage (planned)                                                          | -                                                                           | pending |
| FR-045 | E3   | RO-143                 | coverage (planned)                                                          | -                                                                           | pending |
| FR-050 | E4   | RO-025                 | apps/api/src/modules/rosters                                                | apps/api/test/rosters.test.ts                                               | done    |
| FR-051 | E4   | RO-025                 | apps/api/src/modules/rosters                                                | apps/api/test/rosters.test.ts                                               | done    |
| FR-052 | E4   | RO-022, RO-026         | packages/shared/src/solver, apps/api/src/modules/rosters/rosters.service.ts | packages/shared/test/solve.test.ts, apps/api/test/rosters.test.ts           | done    |
| FR-053 | E4   | RO-022                 | packages/shared/src/solver/rng.ts, solve.ts                                 | packages/shared/test/solve.test.ts, packages/shared/test/rng.test.ts        | done    |
| FR-054 | E4   | RO-021                 | packages/shared/src/solver/employee-score.ts, evaluate.ts                   | packages/shared/test/evaluate.test.ts                                       | done    |
| FR-055 | E4   | RO-021                 | packages/shared/src/solver/employee-score.ts, fairness.ts                   | packages/shared/test/evaluate.test.ts                                       | done    |
| FR-056 | E4   | RO-021                 | packages/shared/src/solver/evaluate.ts                                      | packages/shared/test/evaluate.test.ts                                       | done    |
| FR-057 | E4   | RO-022, RO-026         | packages/shared/src/solver/problem.ts, rosters.service.ts                   | packages/shared/test/solve.test.ts, apps/api/test/rosters.test.ts           | done    |
| FR-058 | E4   | RO-026                 | apps/api/src/modules/rosters                                                | apps/api/test/rosters.test.ts                                               | done    |
| FR-059 | E4   | RO-026                 | packages/shared/src/model/constraints.ts, rosters.routes.ts                 | packages/shared/test/evaluate.test.ts, apps/api/test/rosters.test.ts        | done    |
| FR-060 | E4   | RO-160                 | solver-jobs (planned)                                                       | -                                                                           | pending |
| FR-061 | E4   | RO-161                 | rosters (planned)                                                           | -                                                                           | pending |
| FR-062 | E4   | RO-162, RO-166         | labor-rules (planned)                                                       | -                                                                           | pending |
| FR-063 | E4   | RO-163                 | solver                                                                      | -                                                                           | pending |
| FR-064 | E4   | RO-165                 | solver settings (planned)                                                   | -                                                                           | pending |
| FR-070 | E5   | RO-026, RO-028         | rosters.service.ts, apps/web/src                                            | apps/api/test/rosters.test.ts, apps/web/test                                | done    |
| FR-071 | E5   | RO-026                 | rosters.service.ts                                                          | apps/api/test/rosters.test.ts                                               | done    |
| FR-072 | E5   | RO-026                 | rosters.service.ts                                                          | apps/api/test/rosters.test.ts                                               | done    |
| FR-073 | E5   | RO-170, RO-171         | publishing, notifications (planned)                                         | -                                                                           | pending |
| FR-074 | E5   | RO-172                 | apps/web                                                                    | -                                                                           | pending |
| FR-075 | E5   | RO-173, RO-174         | rosters                                                                     | -                                                                           | pending |
| FR-076 | E5   | RO-230, RO-231         | self-service (planned)                                                      | -                                                                           | pending |
| FR-080 | E6   | RO-130, RO-133         | availability (planned)                                                      | -                                                                           | pending |
| FR-081 | E6   | RO-131, RO-132, RO-133 | time-off (planned)                                                          | -                                                                           | pending |
| FR-082 | E7   | RO-180, RO-181, RO-182 | swaps (planned)                                                             | -                                                                           | pending |
| FR-083 | E7   | RO-183                 | open-shifts (planned)                                                       | -                                                                           | pending |
| FR-084 | E8   | RO-190, RO-191, RO-192 | time-clock (planned)                                                        | -                                                                           | pending |
| FR-085 | E8   | RO-200, RO-201         | timesheets (planned)                                                        | -                                                                           | pending |
| FR-086 | E9   | RO-210                 | payroll (planned)                                                           | -                                                                           | pending |
| FR-087 | E9   | RO-220, RO-221, RO-222 | reports (planned)                                                           | -                                                                           | pending |

## Non-functional traceability

| NFR              | Verified by                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------ |
| NFR-001          | packages/shared/test/solve.test.ts ("160-person, 544-slot week"), `npm run bench`          |
| NFR-003          | packages/shared/test/solve.test.ts (determinism), packages/shared/test/rng.test.ts         |
| NFR-004          | packages/shared/test/zoned.test.ts, packages/shared/test/templates.test.ts                 |
| NFR-005, NFR-006 | apps/api/src/security, apps/api/test/auth.test.ts                                          |
| NFR-007          | apps/api/test/employees.test.ts, apps/api/test/rosters.test.ts (cross-tenant 404)          |
| NFR-008          | packages/shared/test/schemas.test.ts, API 422 tests                                        |
| NFR-009          | packages/shared/test/zoned.test.ts (formatter cache bound), solve iteration cap test       |
| NFR-010          | apps/api/src/modules/rosters/rosters.service.ts (row locks), apps/api/test/rosters.test.ts |
| NFR-021          | apps/api/src/config/env.ts (TRUST_PROXY parsing), apps/api/test/auth-throttling.test.ts    |
| NFR-011          | apps/api/test/platform.test.ts (request id header)                                         |
| NFR-012, NFR-013 | run.sh, .github/workflows/ci.yml                                                           |
| NFR-014          | vitest coverage thresholds per workspace                                                   |
