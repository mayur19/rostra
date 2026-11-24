# Rostra

Workforce scheduling and rostering for hospitals, retail stores and call centers, built around an
**in-house constraint solver**. Rostra turns staff contracts, skills and certifications,
availability and shift demand into a weekly roster, then explains in plain language every rule it
could not satisfy.

> Status: foundation and first vertical slice implemented (**9.8%** of the planned scope by
> estimated hours). Everything else is specified in [`docs/`](docs/README.md) and tracked in the
> [backlog](docs/planning/backlog.md); planned endpoints already exist and answer `501` with their
> ticket id.

## What works today

- **Constraint model**: 9 hard rules (coverage, skill, certification expiry, time off, overlaps,
  minimum rest, weekly maximum, consecutive days, shifts per day) and 5 soft rules (contracted
  minimum, preferred days off, night aversion, overtime, fairness), each producing an
  explainable violation with an exact penalty.
- **Solver**: most-constrained-first greedy construction followed by simulated annealing over
  reassign/swap moves with incremental per-employee scoring. Fully deterministic for a given seed
  and iteration budget. Pinned (manual) assignments are respected. A 160-person, 544-slot week
  solves in well under a second.
- **Time zones done properly**: UTC instants, Intl-only conversions, DST gaps and overlaps
  handled, so a 22:00-06:00 night is 7 or 9 real hours on transition nights.
- **API** (Fastify 5, PostgreSQL): register/login with scrypt and server-side sessions, CSRF
  double-submit, layered brute-force throttling, RBAC, audit log, employees and skills, rosters
  and shift demand, solve / evaluate / manual assignments / solver history.
- **Web** (React 18 + Vite): week grid of assignments per employee with flagged cells, open
  slots, score and labor cost, violations panel and a Generate button; planned areas visible in
  navigation with a _Planned_ badge.

## Quick start

Requirements: Node.js 22+, a local PostgreSQL 15+ server (`brew install postgresql@17` or
`sudo apt install postgresql`).

```bash
git clone https://github.com/mayur19/rostra.git && cd rostra
./run.sh            # creates .env with a random secret, installs, creates DB, migrates, seeds, starts
```

Open http://localhost:5108 and sign in as `scheduler@rostra.test` / `rostra-demo-password`
(development seed only). Open the Ward 4B roster and press **Generate schedule**.

| Command                                                                      | Purpose                                                          |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `./run.sh setup`                                                             | prerequisites, `.env`, dependencies, database, migrations, seed  |
| `./run.sh migrate` / `seed` / `reset`                                        | database maintenance                                             |
| `./run.sh test`                                                              | unit, integration (real PostgreSQL) and component tests          |
| `npm run lint && npm run format:check && npm run typecheck && npm run build` | what CI runs                                                     |
| `npm run bench`                                                              | solver benchmark (20 to 160 staff)                               |
| `npm run test:e2e`                                                           | Playwright smoke tests (after `npx playwright install chromium`) |

Default local connection: socket in `/tmp`, port 5432, current OS user, no password
(`DATABASE_URL=postgresql://localhost:5432/rostra_dev?host=/tmp`).

## Repository layout

```
apps/api         Fastify API: config, db (migrator, seed), http (envelope, auth, CSRF), modules/*
apps/web         React + Vite client: auth, layout, roster week grid
packages/shared  Domain: time zones, constraint model, evaluators, solver, zod schemas, RBAC
docs/            PRD, requirements, ADRs, design, OpenAPI, security, testing, operations, planning
e2e/             Playwright smoke specs
run.sh           local launcher
```

## Documentation

Start at [docs/README.md](docs/README.md). Highlights: [system design and solver
algorithms](docs/design/system-design.md), [ADRs](docs/adr/README.md),
[OpenAPI](docs/api/openapi.yaml), [threat model](docs/security/threat-model.md),
[roadmap](docs/planning/roadmap.md), [implementation status](docs/planning/implementation-status.md).

## License

MIT, see [LICENSE](LICENSE).
