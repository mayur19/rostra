# Rostra

[![CI](https://github.com/mayur19/rostra/actions/workflows/ci.yml/badge.svg)](https://github.com/mayur19/rostra/actions/workflows/ci.yml)

**Turn contracts, skills, availability and shift demand into a fair, rule-compliant weekly roster
in under a second, and see exactly why any rule could not be met.**

Rostra is a multi-tenant workforce scheduling platform for hospitals, retail stores and call
centers. Schedulers describe their staff (skills and certification expiry, contracted hours, rest
rules, maximum consecutive days, time off, preferences) and the shifts they need covered; an
in-house constraint solver (most-constrained-first greedy construction followed by simulated
annealing) produces the roster, and every hard or soft rule it could not satisfy is reported as a
plain-language violation with an exact penalty. Shifts are stored as UTC instants and converted
with DST-safe time-zone logic, so night shifts on clock-change nights have their real length.

> **Project status: early build.** The foundation, authentication and the core scheduling slice
> (constraint model, rule evaluators, seeded solver, rosters API and week-grid screen) are
> implemented and tested. Everything else is designed, documented and tracked in the
> [backlog](docs/planning/backlog.md): **9.8 %** of the estimated effort (110 of 1124 hours) is
> complete, per [implementation-status.md](docs/planning/implementation-status.md). Pending API
> endpoints answer `501 Not Implemented` with their ticket id, and pending screens appear in the
> navigation with a _Planned_ badge.

## Project status

| Area                                                                                            | Status         | Tickets                            |
| ----------------------------------------------------------------------------------------------- | -------------- | ---------------------------------- |
| Monorepo, config, logging, error envelope, migrations, health checks, `run.sh`, CI, docs        | ✅ Implemented | RO-001 to RO-008                   |
| Owner registration, sessions, CSRF, login throttling, RBAC, audit log                           | ✅ Implemented | RO-010 to RO-015                   |
| Constraint model, DST-safe time helpers, hard/soft rule evaluators with explanations            | ✅ Implemented | RO-020, RO-021                     |
| Greedy + simulated annealing solver, deterministic under a seed, tests and benchmark            | ✅ Implemented | RO-022, RO-023                     |
| Skills and employees API (list, create, get, update)                                            | ✅ Implemented | RO-024                             |
| Rosters, shift demand, solve, schedule, evaluate, manual assignments, solver runs               | ✅ Implemented | RO-025, RO-026                     |
| Web shell, login, roster week grid with violations, demo ward seed                              | ✅ Implemented | RO-027 to RO-029                   |
| Organization settings, invitations, roles, password reset, verified sign-up, session management | ⏳ Pending     | RO-101 to RO-106                   |
| Locations, departments, positions, versioned contracts, archive, CSV import, cert expiry        | ⏳ Pending     | RO-110 to RO-113, RO-120 to RO-122 |
| Availability patterns and time-off requests with approvals                                      | ⏳ Pending     | RO-130 to RO-133                   |
| Demand forecasting, coverage curves, shift templates                                            | ⏳ Pending     | RO-140 to RO-143, RO-150, RO-151   |
| Async solver jobs, what-if explanations, labor rules engine, carry-over, solver quality         | ⏳ Pending     | RO-160 to RO-166                   |
| Publishing, notifications, drag-and-drop editing, versions, employee self-service, iCalendar    | ⏳ Pending     | RO-170 to RO-174, RO-230, RO-231   |
| Shift swaps and open-shift board                                                                | ⏳ Pending     | RO-180 to RO-183                   |
| Kiosk punches, punch rules, timesheets                                                          | ⏳ Pending     | RO-190 to RO-192, RO-200, RO-201   |
| Payroll CSV export, fairness, labor cost and compliance reports                                 | ⏳ Pending     | RO-210, RO-220 to RO-222           |
| Shared rate-limit store, accessibility, performance, backups, metrics, i18n, E2E in CI          | ⏳ Pending     | RO-107, RO-240 to RO-246           |

## Quick start

Requirements: Node.js 22+, npm, and a local PostgreSQL 15+ server that accepts socket connections
from your OS user without a password (for example `brew install postgresql@17` or
`sudo apt install postgresql`).

```bash
./run.sh
```

This checks prerequisites, creates `.env` from `.env.example` with a random `SESSION_SECRET`,
installs dependencies, creates the `rostra_dev` database if missing, applies migrations, seeds the
demo ward when the database is empty, and starts:

- Web: http://localhost:5108
- API: http://127.0.0.1:4108 (proxied by the web dev server under `/api`)

The default connection string is `postgresql://localhost:5432/rostra_dev?host=/tmp`; tests use
`rostra_test`.

## Demo logins (development only)

These accounts are created by the development seed, are public, and must never exist in a
production database. Password for all: `rostra-demo-password`.

| Email                   | Role      | Organization               |
| ----------------------- | --------- | -------------------------- |
| `owner@rostra.test`     | Owner     | St. Jude General - Ward 4B |
| `scheduler@rostra.test` | Scheduler | St. Jude General - Ward 4B |
| `manager@rostra.test`   | Manager   | St. Jude General - Ward 4B |

Seeded data (time zone `America/New_York`): skills RN, CNA and CHARGE; 20 staff (14 full-time,
6 part-time) with preferred days off and, for 9 of them, night aversion; three mid-week time-off
blocks and two charge certifications that lapse mid-week; and one draft roster for the week starting next Monday
with 40 shifts (68 slots: day/evening/night RN, day/evening CNA, weekday charge nurse). Sign in
as the scheduler, open the roster and press **Generate schedule**.

## run.sh commands

| Command                     | Description                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `./run.sh` / `./run.sh dev` | Setup, then launch API + web with hot reload (`start` is an alias)                     |
| `./run.sh setup`            | Prerequisites, `.env` with random secret, deps, create database, migrate, seed         |
| `./run.sh migrate`          | Apply pending database migrations                                                      |
| `./run.sh seed`             | Load the demo ward (empty database only)                                               |
| `./run.sh reset [--yes]`    | Drop and recreate the schema, then migrate + seed (refused when `NODE_ENV=production`) |
| `./run.sh test`             | Unit, integration and component tests against `TEST_DATABASE_URL`                      |
| `./run.sh help`             | Show all commands                                                                      |

Other useful scripts: `npm run bench` (solver benchmark, 20 to 160 staff), `npm run test:e2e`
(Playwright smoke tests), and `npm run lint`, `format:check`, `typecheck` and `build` (what CI runs).

## Tech stack

| Layer    | Technology                                                                                   |
| -------- | -------------------------------------------------------------------------------------------- |
| API      | Node.js 22, Fastify 5, `@fastify/cookie`, TypeScript (strict), zod, pg, pino                 |
| Web      | React 18, React Router 6, Vite 6, plain CSS with design tokens                               |
| Database | PostgreSQL 15+ (17 used locally), forward-only SQL migrations with checksums                 |
| Shared   | `@rostra/shared`: time zones, constraint model, evaluators, solver, zod schemas, permissions |
| Tests    | Vitest, Testing Library + jsdom, Fastify `inject` against real PostgreSQL, Playwright        |
| Tooling  | npm workspaces, ESLint, Prettier, tsx, tsup, GitHub Actions on the runner's PostgreSQL       |

## Repository layout

```
rostra/
├── apps/
│   ├── api/                          Fastify API
│   │   ├── migrations/               0001_foundation, 0002_workforce, 0003_rosters (.sql)
│   │   ├── src/
│   │   │   ├── config/ db/ http/ security/     env, migrator + seed, envelope/auth/CSRF, limiters
│   │   │   └── modules/
│   │   │       ├── health/ auth/ audit/        foundation
│   │   │       ├── skills/ employees/          workforce slice (implemented)
│   │   │       ├── rosters/                    rosters, shifts, solve, evaluate (implemented)
│   │   │       └── pending/                    65 planned endpoints answering 501 with tickets
│   │   └── test/                     integration tests against PostgreSQL
│   └── web/                          React SPA
│       └── src/                      api/ auth/ components/ pages/ roster/ (week grid, violations)
├── packages/shared/
│   └── src/                          time/ (zoned dates), model/ (types, rules, schemas), solver/
├── e2e/                              Playwright config and smoke specs
├── docs/                             product, architecture, ADRs, design, API, security, testing, ops, planning
├── run.sh                            single entry point
└── .env.example                      placeholder configuration
```

## Documentation

Start with the [documentation index](docs/README.md). Key documents:
[PRD](docs/product/PRD.md) ·
[requirements](docs/product/requirements.md) ·
[architecture](docs/architecture/overview.md) ·
[ADRs](docs/adr/README.md) ·
[data model](docs/design/data-model.md) ·
[system design](docs/design/system-design.md) ·
[API](docs/api/README.md) ([OpenAPI](docs/api/openapi.yaml)) ·
[threat model](docs/security/threat-model.md) ·
[test strategy](docs/testing/test-strategy.md) ·
[runbook](docs/operations/runbook.md) ·
[deployment](docs/operations/deployment.md) ·
[roadmap](docs/planning/roadmap.md) ·
[backlog](docs/planning/backlog.md) ·
[implementation status](docs/planning/implementation-status.md)

## Known limitations

- Only the scheduling slice is usable end to end: staff, rosters, shift demand, solving and
  inspection. Publishing, time off, swaps, time clock and payroll are pending (see status table).
- Solving runs synchronously inside the request, bounded by `SOLVER_MAX_ITERATIONS`; background
  jobs are RO-160.
- Rest and consecutive-day rules do not look across the roster boundary yet (RO-163); contract
  terms live on the employee row until versioned contracts (RO-113).
- Login and registration throttles are held in process memory, so run a single API instance per
  database until the shared PostgreSQL store lands (RO-107, see
  [ADR-0017](docs/adr/0017-brute-force-limiter-lru-plus-count-min-sketch.md)).
- A duplicate-email registration still differs from a successful one (no session is created)
  until email-verified sign-up (RO-106).
- The Playwright smoke tests are skipped in CI because browsers are not installed there.
- No email, SMS or other third-party services by design; notifications will be in-app only.

## Contributing, security and license

- [Contributing guide](CONTRIBUTING.md): workflow, commit conventions, engineering rules.
- [Security policy](SECURITY.md): how to report vulnerabilities; security model in brief.
- [Changelog](CHANGELOG.md).
- Licensed under the [MIT License](LICENSE).
