# Implementation status

**Overall: 9.8% implemented** (110 of 1124 estimated hours), computed from
[backlog.md](backlog.md).

## How the percentage is computed

```
percent_done = sum(hours of tickets with status = done) / sum(hours of all tickets)
             = 110 / 1124 = 9.8%
```

Estimates are engineering hours including tests and documentation. A ticket counts as done
only when its code, tests and docs are merged and CI is green; partially finished work counts
as pending. The figure is recomputed whenever the backlog changes (adding RO-106 and RO-107 for
auth hardening moved it from 10.0% to 9.8%).

## By epic

| Epic | Name                            | Done (h) | Pending (h) | Total (h) |   Done % |
| ---- | ------------------------------- | -------: | ----------: | --------: | -------: |
| E0   | Foundation                      |       37 |           0 |        37 |     100% |
| E1   | Identity & access               |       15 |          73 |        88 |      17% |
| E2   | Workforce model                 |        5 |          93 |        98 |       5% |
| E3   | Demand & coverage               |        0 |         119 |       119 |       0% |
| E4   | Solver & rules                  |       43 |         182 |       225 |      19% |
| E5   | Schedule editing & publish      |       10 |         121 |       131 |       8% |
| E6   | Availability & time off         |        0 |          66 |        66 |       0% |
| E7   | Shift marketplace               |        0 |          69 |        69 |       0% |
| E8   | Time & attendance               |        0 |          93 |        93 |       0% |
| E9   | Payroll, reporting & compliance |        0 |          74 |        74 |       0% |
| E10  | Platform hardening              |        0 |         124 |       124 |       0% |
|      | **Total**                       |  **110** |    **1014** |  **1124** | **9.8%** |

## Done (milestones M0 and M1)

| Area             | What works today                                                                                                                                                                 | Evidence                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Tooling          | npm workspaces, strict TypeScript, ESLint, Prettier, `run.sh`, CI on the runner's native PostgreSQL                                                                              | `.github/workflows/ci.yml`                                                    |
| Platform         | zod-validated config (fails fast), pino logs with redaction, request ids, JSON envelope, central error handler, health and readiness                                             | `apps/api/test/platform.test.ts`                                              |
| Database         | forward-only SQL migrations with checksums; 0001 foundation, 0002 workforce, 0003 rosters                                                                                        | `apps/api/migrations/`                                                        |
| Auth             | owner registration, login/logout/me, scrypt hashes, HMAC-stored session tokens, CSRF double-submit bound to the session, layered login throttles, `TRUST_PROXY`, RBAC, audit log | `auth.test.ts`, `auth-throttling.test.ts`                                     |
| Constraint model | 9 hard + 5 soft rules with explainable violations; DST-safe zone helpers; shift template expansion                                                                               | `packages/shared/test/evaluate.test.ts`, `zoned.test.ts`, `templates.test.ts` |
| Solver           | most-constrained-first greedy + simulated annealing, incremental scoring, seeded and deterministic, pinned assignments, benchmark (`npm run bench`)                              | `solve.test.ts`, `state.test.ts`                                              |
| Slice API        | skills, employees (CRUD minus delete), rosters, shift demand, solve, schedule, evaluate, manual assignments, solver runs, constraint catalog                                     | `employees.test.ts`, `rosters.test.ts`                                        |
| Web              | login/register, shell with planned-section badges, rosters list, week grid with violations panel and Generate action, employees list                                             | `apps/web/test/*`                                                             |
| Seed             | demo hospital ward: 3 users, 3 skills, 20 staff, 68 slots over next week                                                                                                         | `apps/api/src/db/seed.ts`                                                     |

## Stubbed (registered, answer 501)

All 65 planned endpoints in [../api/openapi.yaml](../api/openapi.yaml) with `x-status: pending`
are registered in `apps/api/src/modules/pending/pending.routes.ts` and return
`501 NOT_IMPLEMENTED` with `details.ticket`. Planned web sections (Time off, Forecasting, Shift
swaps, Time clock, Timesheets, Payroll, Reports) appear in navigation with a **Planned** badge.

## Known limitations of the implemented slice

- Solving is synchronous inside the request (bounded by `SOLVER_MAX_ITERATIONS`); async jobs are RO-160.
- Rest and consecutive-day rules do not look across the roster boundary (RO-163).
- Contract terms live on the employee row; versioned contracts are RO-113.
- Rate-limit counters are per process; multi-instance needs RO-107.
- Duplicate-email registration still differs from success (no session); uniform sign-up is RO-106.
