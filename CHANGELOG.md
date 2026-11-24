# Changelog

All notable changes are documented here. The format follows Keep a Changelog and the project uses
semantic versioning.

## [Unreleased]

## [0.1.0] - 2026-11-25

### Added

- Monorepo with strict TypeScript, ESLint, Prettier, `run.sh` launcher and CI on the runner's
  native PostgreSQL.
- Domain package: DST-safe time-zone helpers, shift template expansion, constraint model with 9
  hard and 5 soft rules, explainable violations, incremental search state, seeded greedy +
  simulated annealing solver, benchmark.
- API: config validation, migrations 0001-0003, JSON envelope, health/readiness, owner
  registration, sessions, CSRF, RBAC, audit log, skills, employees, rosters, shifts, solve,
  evaluate, manual assignments, solver runs; 65 planned endpoints answering 501 with ticket ids.
- Web: login/register, shell with planned sections, rosters, roster week grid with violations,
  employees.
- Demo seed: hospital ward with 20 staff and a week of demand.
- Documentation: PRD, 61 functional and 21 non-functional requirements, user stories,
  traceability, C4 architecture, 17 ADRs, system design, data model, OpenAPI 3.1, threat model,
  test strategy, runbook, deployment, roadmap, backlog, risks, glossary.

### Security

- Time-zone formatter cache keyed by canonical zone names so input spellings cannot grow memory.
- `TRUST_PROXY` replaces blanket proxy trust; required in production.
- Login throttling per IP, per IP+email, per source distinct-email budget and per email with
  progressive backoff; attempts reserved atomically; IPv6 keyed by /64.
- Bounded limiter stores with resumable sweeping; lockouts evicted while active overflow into a
  fixed-size count-min sketch (read only without a precise entry, ignored when saturated), so
  key flooding can neither lift lockouts nor block other users.
- Registration throttled per IP with a generic failure message for duplicate emails.
