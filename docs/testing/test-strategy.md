# Test strategy

## Pyramid

| Layer                                   | Tool                                   | Where                                 | Count today | Runs in CI                   |
| --------------------------------------- | -------------------------------------- | ------------------------------------- | ----------: | ---------------------------- |
| Domain unit tests                       | Vitest                                 | `packages/shared/test`                |          69 | yes                          |
| API integration tests (real PostgreSQL) | Vitest + Fastify `inject`              | `apps/api/test`                       |          62 | yes                          |
| Component tests                         | Vitest + React Testing Library + jsdom | `apps/web/test`                       |          14 | yes                          |
| End-to-end smoke                        | Playwright                             | `e2e/`                                |           2 | skipped unless `E2E_ENABLED` |
| Benchmark                               | `npm run bench`                        | `packages/shared/src/solver/bench.ts` |     4 sizes | manual                       |

The weight sits at the bottom: the solver and evaluators are pure functions, so most behaviour is
pinned with fast, deterministic unit tests; integration tests prove the API, SQL and
transactions; a few component tests cover the grid projection and navigation.

## What is tested where

- **Time zones** (`zoned.test.ts`, `templates.test.ts`): date-key arithmetic, offsets on both DST
  transitions, gap resolved forward, overlap resolved earlier, overnight shifts of 7 h and 9 h on
  DST nights, canonical zone names and a bounded formatter cache.
- **Problem compilation** (`problem.test.ts`): every validation message, slot expansion, pins,
  night detection, static eligibility (missing, expired, unavailable).
- **Evaluators** (`evaluate.test.ts`): one focused test per constraint, exact penalties and
  messages, ordering, metrics and cost with overtime premium.
- **Incremental scoring** (`state.test.ts`): 3 000 random moves compared against full
  re-evaluation (property-style with a seeded PRNG).
- **Solver** (`solve.test.ts`): determinism, seed sensitivity, feasibility on the ward fixture,
  never worse than greedy, annealing improves a tight instance, pinned slots, impossible demand,
  a greedy trap, rest/consecutive constraints, warm start, iteration cap, and a performance
  budget (160 staff, 544 slots, < 5 s).
- **API** (`platform`, `auth`, `auth-throttling`, `employees`, `rosters`): envelope, request ids,
  501 stubs, readiness failure, config validation, CSRF, sessions, RBAC, audit, every throttle
  layer including concurrency and flooding, tenant isolation, roster solve/evaluate/assign,
  published-roster conflicts and concurrent solves.
- **Web** (`grid-model`, `components`, `client`): local-date placement, flags, open slots,
  planned badges, error mapping and CSRF header in the fetch client.

## Determinism

Solver tests pass a seed and an iteration budget, never a time limit (ADR-0010), so assertions on
exact assignments are stable across machines. Integration tests run files sequentially against
one disposable database rebuilt from migrations by `test/global-setup.ts`, which refuses to run
unless the database name contains `test`.

## Coverage

Thresholds are enforced per workspace (`npm run test:coverage`): shared 85% lines / 80% branches
(currently 100% / 88%), API 80% / 70% (currently about 95% / 93%), web 80% / 70% over the roster
components, client and navigation (currently about 90% / 90%).

## Acceptance test matrix

| Requirement area         | Acceptance check                                                 | Automated in                           |
| ------------------------ | ---------------------------------------------------------------- | -------------------------------------- |
| Generate a feasible week | Demo-like ward solves with hard = 0 and full coverage            | `solve.test.ts`, `rosters.test.ts`     |
| Reproducibility          | Same seed and budget give identical assignments (domain and API) | `solve.test.ts`, `rosters.test.ts`     |
| Explainability           | Each violation has a constraint id, penalty and sentence         | `evaluate.test.ts`                     |
| Manual edits             | Proposed edits evaluated without saving; pins survive re-solve   | `rosters.test.ts`                      |
| DST safety               | Night shifts across transitions have real durations              | `templates.test.ts`                    |
| Tenant isolation         | Foreign ids return 404; lists are empty                          | `employees.test.ts`, `rosters.test.ts` |
| Brute-force resistance   | Throttles hold under concurrency, IP rotation and store flooding | `auth-throttling.test.ts`              |
| Planned surface          | Pending endpoints return 501 with ticket ids                     | `platform.test.ts`                     |

## Running

```bash
./run.sh test                  # all workspaces against TEST_DATABASE_URL
npm test -w @rostra/shared     # domain only, no database needed
npm run test:coverage
npx playwright install chromium && npm run test:e2e   # needs ./run.sh setup first
```
