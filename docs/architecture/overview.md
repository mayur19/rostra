# Architecture overview

Rostra is a modular monolith in an npm-workspaces repository:

| Workspace         | Responsibility                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `packages/shared` | Pure domain: time-zone helpers, constraint model, rule evaluators, solver, zod schemas, RBAC table. No I/O. |
| `apps/api`        | Fastify 5 HTTP API, PostgreSQL access (`pg`), sessions, CSRF, audit, migrations, seed.                      |
| `apps/web`        | React 18 + Vite single-page app (week grid, employees, rosters).                                            |
| `e2e`             | Playwright smoke tests.                                                                                     |

The solver lives in `packages/shared` so the same evaluator can run in the API (solve,
evaluate, validate edits) and, later, in the browser for instant drag-and-drop feedback
(RO-172) without a network round trip.

## C4 level 1: system context

```mermaid
flowchart LR
  scheduler([Scheduler / charge nurse])
  manager([Unit manager])
  employee([Employee])
  owner([Organization owner])
  payroll([Payroll officer])
  rostra[[Rostra<br/>workforce scheduling]]
  kiosk[/Time-clock kiosk browser/]
  payrollsys[(Customer payroll system)]

  scheduler -->|builds and edits rosters| rostra
  manager -->|approves, reviews cost and compliance| rostra
  employee -->|views schedule, requests time off and swaps| rostra
  owner -->|configures tenant, users, rules| rostra
  kiosk -->|PIN punches - planned| rostra
  rostra -->|payroll CSV file, downloaded by a person - planned| payroll
  payroll --> payrollsys
```

Rostra makes no outbound network calls. Email-like messages are written to an outbox
table (planned) and shown in-app; payroll leaves the system only as a downloaded CSV.

## C4 level 2: containers

```mermaid
flowchart TB
  browser[Browser<br/>React SPA :5108]
  nginx[nginx<br/>TLS, static files, reverse proxy]
  api[API process<br/>Node 22 + Fastify :4108]
  shared[[packages/shared<br/>domain + solver library]]
  pg[(PostgreSQL 15+<br/>rostra_dev / rostra_test)]
  worker[Solver worker - planned RO-160]

  browser -->|HTTPS, cookies + x-csrf-token| nginx
  nginx -->|/api/*| api
  nginx -->|/*| browser
  api --> shared
  api -->|SQL over socket/TCP| pg
  worker -.-> shared
  worker -.->|claims solver_jobs| pg
```

In development Vite serves the SPA on port 5108 and proxies `/api` to the API on 4108.

## C4 level 3: API components

```mermaid
flowchart LR
  subgraph http[http layer]
    hooks[auth hooks<br/>session lookup + CSRF]
    err[error handler<br/>envelope mapping]
    pending[pending routes<br/>501 + ticket]
  end
  subgraph modules
    health[health]
    auth[auth<br/>register/login/logout/me]
    audit[audit]
    skills[skills]
    employees[employees]
    rosters[rosters<br/>shifts, solve, schedule,<br/>evaluate, assignments]
  end
  subgraph domain[packages/shared]
    schemas[zod schemas]
    rbac[permissions]
    problem[compileProblem]
    evaluate[evaluateSolution]
    solver[solve: greedy + anneal]
  end
  db[(PostgreSQL)]

  hooks --> auth & skills & employees & rosters & audit
  rosters --> problem --> evaluate
  rosters --> solver --> evaluate
  modules --> schemas
  hooks --> rbac
  auth & audit & skills & employees & rosters --> db
```

## Module boundaries

- **Domain package is pure.** It never imports from `apps/*`, never performs I/O and exposes
  immutable results. The single intentionally mutable structure, `SearchState`, is private to
  the solver ([ADR-0007](../adr/0007-incremental-search-state.md)).
- **Modules own their tables.** `employees` owns `employees`, `employee_skills`,
  `employee_unavailability`; `rosters` owns `rosters`, `shifts`, `assignments`, `solver_runs`.
  Cross-module reads go through exported repository functions (`listAllEmployees`,
  `resolveSkillIds`), not ad-hoc SQL.
- **Tenant scoping in repositories.** Every query takes `organizationId` from the session,
  never from the request body ([ADR-0004](../adr/0004-tenant-scoping-in-repositories.md)).
- **Pending features are registered routes.** `modules/pending/pending.routes.ts` lists every
  planned endpoint with its ticket, so the live surface equals `docs/api/openapi.yaml`.

## Request lifecycle

```mermaid
sequenceDiagram
  participant C as Client
  participant F as Fastify
  participant H as preHandler hook
  participant R as Route handler
  participant S as Service / domain
  participant D as PostgreSQL
  C->>F: HTTP request (+ cookies, x-csrf-token, x-request-id?)
  F->>F: genReqId (accept safe x-request-id or new UUID)
  F->>H: run hooks
  H->>D: SELECT session by HMAC(token) where not expired and user active
  H->>H: CSRF check for POST/PUT/PATCH/DELETE (skipped for pending routes)
  H->>R: request.auth set (or null)
  R->>R: requirePermission(...) and zod parse (422 on failure)
  R->>S: call service
  S->>D: transaction (row lock where needed), writes + audit row
  S-->>R: result
  R-->>F: { data, error: null, meta? }
  F-->>C: JSON + x-request-id, nosniff, no-store headers
  Note over F: Any thrown AppError / ProblemValidationError / unknown error<br/>is mapped by the central error handler to the envelope
```

## Technology choices

| Concern          | Choice                                        | ADR                                                                                               |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Language/runtime | TypeScript strict, Node 22                    | [0001](../adr/0001-typescript-modular-monolith.md)                                                |
| HTTP             | Fastify 5 + @fastify/cookie                   | [0002](../adr/0002-fastify-and-plain-sql.md)                                                      |
| Data access      | `pg` with hand-written SQL                    | [0002](../adr/0002-fastify-and-plain-sql.md)                                                      |
| Auth             | Postgres sessions, scrypt, CSRF double submit | [0003](../adr/0003-session-auth-and-csrf.md)                                                      |
| Migrations       | In-repo forward-only runner                   | [0005](../adr/0005-forward-only-sql-migrations.md)                                                |
| Solver           | In-house greedy + simulated annealing         | [0008](../adr/0008-in-house-solver.md), [0009](../adr/0009-greedy-construction-plus-annealing.md) |
| Time             | UTC instants + Intl-only zone math            | [0012](../adr/0012-utc-instants-and-intl-time-zones.md)                                           |
